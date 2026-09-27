import { describe, expect, it, vi } from "vitest";

import {
  GuardrailError,
  ModelCallError,
  OPENAI_URL,
  OPENROUTER_URL,
  callModel,
  extractJson,
  isClientProject,
  resolveModel,
  resolveProvider,
  resolveTarget,
} from "../src/server/models";
import type { ModelTarget } from "../src/server/models";

function target(over: Partial<ModelTarget> = {}): ModelTarget {
  return {
    provider: "openrouter",
    baseUrl: OPENROUTER_URL,
    keyName: "OPENROUTER_API_KEY",
    apiKey: "k",
    model: "m",
    ...over,
  };
}

const ask = [{ role: "user" as const, content: "hi" }];

describe("resolveModel", () => {
  it("allows a free model for own work", () => {
    expect(resolveModel("superbuild", "free", { FREE_PROVIDER: "openrouter" })).toBe(
      "deepseek/deepseek-v4-flash",
    );
  });

  it("uses the configured free model when provided", () => {
    expect(resolveModel("superbuild", "free", { FREE_MODEL: "custom/free" })).toBe("custom/free");
  });

  it("refuses a client project on a free model", () => {
    for (const slug of ["vanmossel", "itfamily", "denovolabs", "aidept", "xim"]) {
      expect(() => resolveModel(slug, "free", {})).toThrow(GuardrailError);
    }
  });

  it("is case- and whitespace-insensitive about client slugs", () => {
    expect(isClientProject("  ITFamily ")).toBe(true);
    expect(() => resolveModel("  ITFamily ", "free", {})).toThrow(GuardrailError);
  });

  it("allows a client project on the paid ZDR model", () => {
    expect(resolveModel("itfamily", "zdr-paid", { ZDR_MODEL: "vendor/zdr" })).toBe("vendor/zdr");
  });

  it("carries an actionable message", () => {
    expect(() => resolveModel("itfamily", "free", {})).toThrow(/ZDR-capable/);
  });
});

describe("resolveProvider", () => {
  it("honours an explicit provider", () => {
    expect(resolveProvider("free", { MODEL_PROVIDER: "openai" })).toBe("openai");
    expect(resolveProvider("free", { MODEL_PROVIDER: "mock" })).toBe("mock");
  });

  it("lets a per-policy override beat the general one", () => {
    expect(resolveProvider("zdr-paid", { MODEL_PROVIDER: "mock", ZDR_PROVIDER: "openai" })).toBe(
      "openai",
    );
    expect(resolveProvider("free", { MODEL_PROVIDER: "openai", FREE_PROVIDER: "openrouter" })).toBe(
      "openrouter",
    );
  });

  it("falls back to a provider whose key is actually present", () => {
    expect(resolveProvider("free", { OPENAI_API_KEY: "sk-live" })).toBe("openai");
    expect(resolveProvider("free", { OPENROUTER_API_KEY: "sk-live" })).toBe("openrouter");
  });

  it("falls back to mock when nothing is configured", () => {
    expect(resolveProvider("free", {})).toBe("mock");
    expect(resolveProvider("free", { OPENAI_API_KEY: "   " })).toBe("mock");
  });

  it("ignores an unrecognised provider rather than trusting it", () => {
    expect(resolveProvider("free", { MODEL_PROVIDER: "nope" })).toBe("mock");
  });
});

describe("resolveTarget", () => {
  it("pairs the model with that provider's own URL, key name and default id", () => {
    const resolved = resolveTarget("superbuild", "free", {
      MODEL_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-live",
    });

    expect(resolved.provider).toBe("openai");
    expect(resolved.baseUrl).toBe(OPENAI_URL);
    expect(resolved.keyName).toBe("OPENAI_API_KEY");
    expect(resolved.model).toBe("gpt-4.1-mini");
    expect(resolved.apiKey).toBe("sk-live");
  });

  it("defaults the model id per provider, not globally", () => {
    expect(resolveTarget("superbuild", "free", { MODEL_PROVIDER: "openrouter" }).model).toBe(
      "deepseek/deepseek-v4-flash",
    );
    expect(resolveTarget("superbuild", "free", { MODEL_PROVIDER: "openai" }).model).toBe(
      "gpt-4.1-mini",
    );
  });

  it("still refuses a client project on a free model", () => {
    expect(() => resolveTarget("itfamily", "free", { MODEL_PROVIDER: "openai" })).toThrow(
      GuardrailError,
    );
  });
});

describe("extractJson", () => {
  it("reads a fenced block", () => {
    expect(extractJson('here you go\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("reads a bare object surrounded by prose", () => {
    expect(extractJson('Sure! {"files":[{"path":"a"}]} hope that helps')).toEqual({
      files: [{ path: "a" }],
    });
  });

  it("throws when there is no JSON", () => {
    expect(() => extractJson("no json here")).toThrow(ModelCallError);
  });

  it("throws on unterminated JSON", () => {
    expect(() => extractJson('{"a": 1')).toThrow(ModelCallError);
  });
});

describe("callModel", () => {
  it("returns the completion text", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ model: "m", choices: [{ message: { content: "hello" } }] }), {
        status: 200,
      }),
    );

    const result = await callModel({
      target: target(),
      messages: ask,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.text).toBe("hello");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OPENROUTER_URL);
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer k");
  });

  it("sends the provider's own token-limit parameter", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 }),
    );

    await callModel({
      target: target({
        provider: "openai",
        baseUrl: OPENAI_URL,
        keyName: "OPENAI_API_KEY",
        model: "gpt-4.1-mini",
      }),
      messages: ask,
      maxTokens: 1234,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.max_completion_tokens).toBe(1234);
    expect(body.max_tokens).toBeUndefined();
  });

  it("throws ModelCallError with the provider status on failure", async () => {
    const fetchImpl = vi.fn(async () => new Response("rate limited", { status: 429 }));

    await expect(
      callModel({ target: target(), messages: ask, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/429/);
  });

  it("throws when the completion is empty", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "  " } }] }), { status: 200 }),
    );

    await expect(
      callModel({ target: target(), messages: ask, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/empty completion/);
  });

  it("refuses to call at all without a key, naming the right variable", async () => {
    const fetchImpl = vi.fn();

    await expect(
      callModel({
        target: target({ apiKey: "" }),
        messages: ask,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/OPENROUTER_API_KEY/);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("names the OpenAI variable when that is the provider", async () => {
    await expect(
      callModel({
        target: target({ provider: "openai", keyName: "OPENAI_API_KEY", apiKey: "" }),
        messages: ask,
        fetchImpl: vi.fn() as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it("translates a provider 401 into something actionable", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('{"error":{"message":"Missing Authentication header","code":401}}', {
          status: 401,
        }),
    );

    await expect(
      callModel({
        target: target({ apiKey: "invalid" }),
        messages: ask,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/OPENROUTER_API_KEY is set and valid/);
  });

  it("explains a 402 as a credits-or-cheaper-model problem", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":"insufficient credits"}', { status: 402 }));

    await expect(
      callModel({ target: target(), messages: ask, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/insufficient credits/);
  });

  it("explains a 404 as a provider-specific model id problem", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":"model not found"}', { status: 404 }));

    await expect(
      callModel({
        target: target({ provider: "openai", model: "deepseek/deepseek-v4-flash" }),
        messages: ask,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/Model ids are provider-specific/);
  });

  it("serves fixtures for the mock provider without touching the network", async () => {
    const fetchImpl = vi.fn();

    const result = await callModel({
      target: target({ provider: "mock", baseUrl: "mock://fixture", model: "fixture-v1" }),
      messages: [
        { role: "system", content: "You are the brief stage of a software factory." },
        { role: "user", content: "anything" },
      ],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.text).toContain("Outcome:");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
