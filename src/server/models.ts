import type { ModelPolicy } from "./types";
import { fixtureFor } from "./fixtures";

/**
 * The guardrail from the workspace AGENTS.md, expressed as an assertion instead of a note:
 * client code never touches a free or stealth model.
 */
export const CLIENT_SLUGS = [
  "vanmossel",
  "itfamily",
  "denovolabs",
  "aidept",
  "xim",
] as const;

export class GuardrailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardrailError";
  }
}

export class ModelCallError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ModelCallError";
  }
}

/**
 * Model ids are PROVIDER-SPECIFIC: an OpenRouter id like "vendor/model" is not a
 * valid OpenAI model, and vice versa. Defaults therefore travel with the provider,
 * so switching provider never leaves a dangling model id behind.
 */
export const DEFAULT_MODELS: Record<Provider, { free: string; zdr: string }> = {
  openai: { free: "gpt-4.1-mini", zdr: "gpt-4.1" },
  openrouter: { free: "deepseek/deepseek-v4-flash", zdr: "moonshotai/kimi-k3" },
  mock: { free: "fixture-v1", zdr: "fixture-v1" },
};

export function isClientProject(project: string): boolean {
  const slug = (project ?? "").trim().toLowerCase();
  return (CLIENT_SLUGS as readonly string[]).includes(slug);
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export type Provider = "openrouter" | "openai" | "mock";

export const PROVIDERS: Record<
  Provider,
  { baseUrl: string; keyName: string; chatParam: "max_tokens" | "max_completion_tokens" }
> = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    keyName: "OPENROUTER_API_KEY",
    chatParam: "max_tokens",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    keyName: "OPENAI_API_KEY",
    chatParam: "max_completion_tokens",
  },
  mock: {
    baseUrl: "mock://fixture",
    keyName: "MOCK_KEY",
    chatParam: "max_tokens",
  },
};

export const OPENROUTER_URL = PROVIDERS.openrouter.baseUrl;
export const OPENAI_URL = PROVIDERS.openai.baseUrl;

export type ModelEnv = {
  FREE_MODEL?: string;
  ZDR_MODEL?: string;
  MODEL_PROVIDER?: string;
  FREE_PROVIDER?: string;
  ZDR_PROVIDER?: string;
  OPENROUTER_API_KEY?: string;
  OPENAI_API_KEY?: string;
  MOCK_KEY?: string;
};

export type ModelTarget = {
  provider: Provider;
  baseUrl: string;
  keyName: string;
  apiKey: string;
  model: string;
};

export function resolveModel(project: string, policy: ModelPolicy, env: ModelEnv = {}): string {
  if (isClientProject(project) && policy === "free") {
    throw new GuardrailError(
      `Refusing to build client project "${project}" on a free model. ` +
        `Client code requires a paid ZDR-capable model (policy: zdr-paid).`,
    );
  }

  const provider = resolveProvider(policy, env);
  if (policy === "zdr-paid") {
    return env.ZDR_MODEL || DEFAULT_MODELS[provider].zdr;
  }
  return env.FREE_MODEL || DEFAULT_MODELS[provider].free;
}

/**
 * Provider resolution, most specific first:
 *   1. FREE_PROVIDER / ZDR_PROVIDER  (per policy)
 *   2. MODEL_PROVIDER
 *   3. a real provider whose key is actually present
 *   4. mock — so a fresh clone runs the entire pipeline with no credentials
 */
export function resolveProvider(policy: ModelPolicy, env: ModelEnv = {}): Provider {
  const explicit = (
    (policy === "zdr-paid" ? env.ZDR_PROVIDER : env.FREE_PROVIDER) ??
    env.MODEL_PROVIDER ??
    ""
  )
    .trim()
    .toLowerCase();

  if (explicit === "openai" || explicit === "openrouter" || explicit === "mock") {
    return explicit;
  }

  if (env.OPENAI_API_KEY?.trim()) return "openai";
  if (env.OPENROUTER_API_KEY?.trim()) return "openrouter";
  return "mock";
}

export function resolveTarget(
  project: string,
  policy: ModelPolicy,
  env: ModelEnv = {},
): ModelTarget {
  const provider = resolveProvider(policy, env);
  const model = resolveModel(project, policy, env);
  const { baseUrl, keyName } = PROVIDERS[provider];

  const apiKey =
    provider === "mock"
      ? "fixture"
      : ((env as Record<string, string | undefined>)[keyName] ?? "");

  return { provider, baseUrl, keyName, apiKey, model };
}

// ---------------------------------------------------------------------------
// The call
// ---------------------------------------------------------------------------

export type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CallModelOptions = {
  target: ModelTarget;
  messages: ModelMessage[];
  maxTokens?: number;
  temperature?: number;
  fetchImpl?: typeof fetch;
};

export type CallModelResult = {
  text: string;
  model: string;
  usage?: unknown;
};

export async function callModel(options: CallModelOptions): Promise<CallModelResult> {
  const { target } = options;

  // The mock provider needs no key, no network, and no credits. It exists so the entire
  // pipeline is runnable from a fresh clone — and so CI can exercise every stage.
  if (target.provider === "mock") {
    return {
      text: fixtureFor(options.messages),
      model: target.model,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }

  const doFetch = options.fetchImpl ?? fetch;

  // Fail fast with something actionable. "Missing Authentication header" from the
  // provider is accurate but says nothing about which key to set.
  if (!target.apiKey || !target.apiKey.trim()) {
    throw new ModelCallError(
      `No API key configured for provider "${target.provider}". Set ${target.keyName} — ` +
        `\`npx wrangler secret put ${target.keyName}\` for a deployed worker, ` +
        `or add it to .dev.vars for local dev.`,
      401,
    );
  }

  const limitParam = PROVIDERS[target.provider].chatParam;
  const body: Record<string, unknown> = {
    model: target.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.4,
  };
  // Newer OpenAI models reject `max_tokens`; OpenRouter models reject nothing here.
  if (options.maxTokens !== undefined) body[limitParam] = options.maxTokens;

  const response = await doFetch(target.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${target.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const bodyText = await response.text();

  if (!response.ok) {
    const provider = target.provider;
    const keyName = target.keyName;

    if (response.status === 401 || response.status === 403) {
      throw new ModelCallError(
        `${provider} rejected the credentials (${response.status}). ` +
          `Check that ${keyName} is set and valid. Provider said: ${bodyText.slice(0, 200)}`,
        response.status,
      );
    }
    if (response.status === 402) {
      throw new ModelCallError(
        `${provider} says the account has insufficient credits (402) for "${target.model}". ` +
          `Either add credits, or point FREE_MODEL at a cheaper/free model id — ${keyName} stays the same. ` +
          `Provider said: ${bodyText.slice(0, 200)}`,
        response.status,
      );
    }
    if (response.status === 404) {
      throw new ModelCallError(
        `${provider} has no model "${target.model}" (404). Model ids are provider-specific — ` +
          `an OpenRouter id like "vendor/model" is not valid on OpenAI. Provider said: ${bodyText.slice(0, 200)}`,
        response.status,
      );
    }
    throw new ModelCallError(
      `Model call failed (${response.status}): ${bodyText.slice(0, 500)}`,
      response.status,
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new ModelCallError(`Model returned non-JSON: ${bodyText.slice(0, 300)}`);
  }

  const text: string =
    parsed?.choices?.[0]?.message?.content ??
    parsed?.choices?.[0]?.text ??
    "";

  if (!text.trim()) {
    throw new ModelCallError("Model returned an empty completion.");
  }

  return { text, model: parsed?.model ?? target.model, usage: parsed?.usage };
}

/**
 * Models like to wrap JSON in prose or fences. Pull the first JSON object/array out.
 */
export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();

  const start = candidate.search(/[[{]/);
  if (start === -1) {
    throw new ModelCallError("No JSON found in model output.");
  }

  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  const end = candidate.lastIndexOf(close);
  if (end <= start) {
    throw new ModelCallError("Unterminated JSON in model output.");
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch (error) {
    throw new ModelCallError(
      `Invalid JSON from model: ${(error as Error).message}`,
    );
  }
}
