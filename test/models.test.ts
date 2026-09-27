import { describe, expect, it, vi } from "vitest";

import {
  GuardrailError,
  ModelCallError,
  callModel,
  extractJson,
  isClientProject,
  resolveModel,
} from "../src/server/models";

describe("resolveModel", () => {
  it("allows a free model for own work", () => {
    expect(resolveModel("superbuild", "free", {})).toBe("deepseek/deepseek-v4-flash");
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
      new Response(
        JSON.stringify({ model: "m", choices: [{ message: { content: "hello" } }], usage: {} }),
        { status: 200 },
      ),
    );

    const result = await callModel({
      model: "m",
      apiKey: "k",
      messages: [{ role: "user", content: "hi" }],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.text).toBe("hello");
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer k");
  });

  it("throws ModelCallError with the provider status on failure", async () => {
    const fetchImpl = vi.fn(async () => new Response("rate limited", { status: 429 }));

    await expect(
      callModel({
        model: "m",
        apiKey: "k",
        messages: [{ role: "user", content: "hi" }],
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/429/);
  });

  it("throws when the completion is empty", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "  " } }] }), { status: 200 }),
    );

    await expect(
      callModel({
        model: "m",
        apiKey: "k",
        messages: [{ role: "user", content: "hi" }],
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/empty completion/);
  });

  it("refuses to call at all without a key, naming the variable and not calling out", async () => {
    const fetchImpl = vi.fn();

    await expect(
      callModel({
        model: "m",
        apiKey: "",
        messages: [{ role: "user", content: "hi" }],
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/OPENROUTER_API_KEY/);

    expect(fetchImpl).not.toHaveBeenCalled();
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
        model: "m",
        apiKey: "invalid",
        messages: [{ role: "user", content: "hi" }],
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/OPENROUTER_API_KEY is set and valid/);
  });
});
