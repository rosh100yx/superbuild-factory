import { describe, expect, it, vi } from "vitest";

import {
  PagesError,
  buildUploadManifest,
  deployToPages,
  mimeFor,
  normalizePath,
  pollDeployment,
  sha256Hex,
  verifyLive,
} from "../src/server/pages-deploy";
import type { PagesEnv } from "../src/server/pages-deploy";

const ENV: PagesEnv = { accountId: "acct", apiToken: "tok", project: "factory-sites" };
const DEPLOY_URL = "https://abc123.factory-sites.pages.dev";

function ok(result: unknown): Response {
  return new Response(JSON.stringify({ success: true, result }), { status: 200 });
}

function notFound(): Response {
  return new Response(JSON.stringify({ success: false, errors: [{ code: 8000007, message: "project not found" }] }), {
    status: 404,
  });
}

function pagesRouter(options: { liveStatus?: number; liveBody?: string; stage?: string } = {}) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (url === DEPLOY_URL) {
      return new Response(options.liveBody ?? "Apply for the cohort", {
        status: options.liveStatus ?? 200,
      });
    }
    if (url.includes("/pages/projects/factory-sites/deployments/dep1")) {
      return ok({ id: "dep1", url: DEPLOY_URL, latest_stage: { name: "deploy", status: options.stage ?? "success" } });
    }
    if (url.endsWith("/pages/projects/factory-sites/deployments") && method === "POST") {
      return ok({ id: "dep1", url: DEPLOY_URL });
    }
    if (url.endsWith("/pages/projects") && method === "POST") {
      return ok({ name: "factory-sites" });
    }
    if (url.endsWith("/pages/projects/factory-sites") && method === "GET") {
      return notFound();
    }
    throw new Error(`unexpected fetch: ${method} ${url}`);
  }) as unknown as typeof fetch;
}

describe("sha256Hex", () => {
  it("matches the known vector for 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("normalizePath", () => {
  it("strips leading slashes and ./", () => {
    expect(normalizePath("index.html")).toBe("index.html");
    expect(normalizePath("./src/a.css")).toBe("src/a.css");
    expect(normalizePath("/deep/b.js")).toBe("deep/b.js");
  });
});

describe("mimeFor", () => {
  it("maps the file types this factory emits", () => {
    expect(mimeFor("index.html")).toContain("text/html");
    expect(mimeFor("styles.css")).toContain("text/css");
    expect(mimeFor("app.js")).toContain("javascript");
  });
});

describe("buildUploadManifest", () => {
  it("keys the manifest by /path and fields by content hash", async () => {
    const { manifest, entries } = await buildUploadManifest([
      { path: "index.html", content: "<html></html>" },
      { path: "./styles.css", content: "body{}" },
    ]);

    const hash = await sha256Hex("<html></html>");
    expect(manifest["/index.html"]).toBe(hash);
    expect(manifest["/styles.css"]).toBe(await sha256Hex("body{}"));
    expect(entries[0]).toMatchObject({ fieldName: hash, filename: "index.html", branchPath: "index.html" });
    expect(Object.keys(manifest)).toHaveLength(2);
  });
});

describe("verifyLive", () => {
  it("passes on 200 with the expected copy", async () => {
    const fetchImpl = vi.fn(async () => new Response("Apply for the cohort", { status: 200 }));
    const result = await verifyLive("https://x.pages.dev", {
      mustContain: "apply for the cohort",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      attempts: 1,
    });
    expect(result.ok).toBe(true);
    expect(result.matched).toBe(true);
  });

  it("fails when the copy is absent", async () => {
    const fetchImpl = vi.fn(async () => new Response("something else", { status: 200 }));
    const result = await verifyLive("https://x.pages.dev", {
      mustContain: "apply for the cohort",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      attempts: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(200);
  });

  it("fails on a non-200", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 522 }));
    const result = await verifyLive("https://x.pages.dev", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async () => {},
      attempts: 1,
    });
    expect(result.ok).toBe(false);
  });
});

describe("pollDeployment", () => {
  it("returns ok on a successful stage", async () => {
    const result = await pollDeployment(ENV, "dep1", {
      fetchImpl: pagesRouter({ stage: "success" }),
      sleepImpl: async () => {},
    });
    expect(result.ok).toBe(true);
  });

  it("returns not-ok on a failed stage", async () => {
    const result = await pollDeployment(ENV, "dep1", {
      fetchImpl: pagesRouter({ stage: "failure" }),
      sleepImpl: async () => {},
    });
    expect(result.ok).toBe(false);
  });
});

describe("deployToPages", () => {
  const files = [
    { path: "index.html", content: "<html lang=\"en\"><h1>h</h1></html>" },
    { path: "styles.css", content: ":root { --bg: #000; }" },
  ];

  it("creates the project, uploads, polls, and verifies", async () => {
    const fetchImpl = pagesRouter();
    const result = await deployToPages({
      env: ENV,
      files,
      branch: "fct_test",
      mustContain: "Apply for the cohort",
      fetchImpl,
      sleepImpl: async () => {},
    });

    expect(result.url).toBe(DEPLOY_URL);
    expect(result.verified).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it("throws when the live check never passes", async () => {
    const fetchImpl = pagesRouter({ liveStatus: 500 });
    await expect(
      deployToPages({
        env: ENV,
        files,
        fetchImpl,
        sleepImpl: async () => {},
      }),
    ).rejects.toThrow(PagesError);
  });
});
