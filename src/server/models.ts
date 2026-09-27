import type { ModelPolicy } from "./types";

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

const DEFAULT_FREE_MODEL = "deepseek/deepseek-v4-flash";
const DEFAULT_ZDR_MODEL = "moonshotai/kimi-k3";

export function isClientProject(project: string): boolean {
  const slug = (project ?? "").trim().toLowerCase();
  return (CLIENT_SLUGS as readonly string[]).includes(slug);
}

export type ModelEnv = {
  FREE_MODEL?: string;
  ZDR_MODEL?: string;
};

export function resolveModel(
  project: string,
  policy: ModelPolicy,
  env: ModelEnv = {},
): string {
  if (isClientProject(project) && policy === "free") {
    throw new GuardrailError(
      `Refusing to build client project "${project}" on a free model. ` +
        `Client code requires a paid ZDR-capable model (policy: zdr-paid).`,
    );
  }
  if (policy === "zdr-paid") return env.ZDR_MODEL || DEFAULT_ZDR_MODEL;
  return env.FREE_MODEL || DEFAULT_FREE_MODEL;
}

export type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type CallModelOptions = {
  model: string;
  messages: ModelMessage[];
  apiKey: string;
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
  const doFetch = options.fetchImpl ?? fetch;

  // Fail fast with something actionable. "Missing Authentication header" from the
  // provider is accurate but says nothing about which key to set.
  if (!options.apiKey || !options.apiKey.trim()) {
    throw new ModelCallError(
      "No model API key configured. Set OPENROUTER_API_KEY — " +
        "`npx wrangler secret put OPENROUTER_API_KEY` for a deployed worker, " +
        "or add it to .dev.vars for local dev.",
      401,
    );
  }

  const response = await doFetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      max_tokens: options.maxTokens ?? 8000,
      temperature: options.temperature ?? 0.4,
    }),
  });

  const bodyText = await response.text();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ModelCallError(
        `Model provider rejected the credentials (${response.status}). ` +
          `Check that OPENROUTER_API_KEY is set and valid. Provider said: ${bodyText.slice(0, 200)}`,
        response.status,
      );
    }
    if (response.status === 402) {
      throw new ModelCallError(
        `Model provider says the account has insufficient credits (402) for "${options.model}". ` +
          `Either add credits, or set FREE_MODEL to a free-tier model id (check ` +
          `https://openrouter.ai/models?max_price=0) — OPENROUTER_API_KEY stays the same. ` +
          `Provider said: ${bodyText.slice(0, 200)}`,
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

  return { text, model: parsed?.model ?? options.model, usage: parsed?.usage };
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
