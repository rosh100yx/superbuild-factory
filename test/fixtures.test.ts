import { describe, expect, it } from "vitest";

import {
  APP_JS_FIXTURE,
  CTA_FIXTURE,
  SECTIONS_FIXTURE,
  SITE_FIXTURE,
  SPEC_FIXTURE,
  fixtureFor,
} from "../src/server/fixtures";
import { MIN_SECTIONS, countSections, parsePrimaryCta } from "../src/server/stages/s2-sections";
import { MIN_BEATS, countBeats, parseOutcome, validateSpec } from "../src/server/stages/s1-brief";
import { parseDelimitedFiles, validateFiles } from "../src/server/stages/s3-build";
import { s4Taste } from "../src/server/stages/s4-taste";
import { publishSite, sitePath, sitePrefix, siteUrl, verifyPublished } from "../src/server/selfhost";
import type { SiteEnv } from "../src/server/selfhost";

/** Minimal in-memory stand-in for the R2 binding. */
function fakeBucket() {
  const store = new Map<string, { content: string; contentType?: string }>();

  return {
    store,
    put: async (key: string, value: string, options?: { httpMetadata?: { contentType?: string } }) => {
      store.set(key, { content: String(value), contentType: options?.httpMetadata?.contentType });
    },
    get: async (key: string) => {
      const found = store.get(key);
      if (!found) return null;
      return {
        text: async () => found.content,
        body: found.content,
        httpMetadata: { contentType: found.contentType },
      };
    },
  } as unknown as R2Bucket & { store: Map<string, { content: string; contentType?: string }> };
}

describe("mock fixtures are internally coherent", () => {
  it("the spec fixture passes S1 validation", () => {
    const result = validateSpec(SPEC_FIXTURE);
    expect(result.ok).toBe(true);
    expect(countBeats(SPEC_FIXTURE)).toBeGreaterThanOrEqual(MIN_BEATS);
    expect(parseOutcome(SPEC_FIXTURE)).toMatch(/twelve qualified applications/);
  });

  it("the sections fixture passes S2 validation", () => {
    expect(countSections(SECTIONS_FIXTURE)).toBeGreaterThanOrEqual(MIN_SECTIONS);
    expect(parsePrimaryCta(SECTIONS_FIXTURE)).toBe(CTA_FIXTURE);
  });

  it("the site fixture PASSES the deterministic lint", () => {
    const { report } = s4Taste(SITE_FIXTURE);
    expect(report.findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(report.verdict).toBe("SHIP");
  });

  it("the CTA appears in the built HTML, so the deploy can verify against it", () => {
    const html = SITE_FIXTURE.find((f) => f.path === "index.html")!;
    expect(html.content).toContain(CTA_FIXTURE);
  });

  it("the build fixture round-trips through the delimited parser", () => {
    const raw = fixtureFor([
      { role: "system", content: "You are the build stage of a software factory." },
      { role: "user", content: "spec and section map" },
    ]);
    const files = parseDelimitedFiles(raw);
    expect(files.map((f) => f.path)).toEqual(["index.html", "styles.css", "app.js"]);
    expect(() => validateFiles(files)).not.toThrow();
  });

  it("routes each stage prompt to its own fixture", () => {
    expect(
      fixtureFor([{ role: "system", content: "You are the brief stage of a software factory." }]),
    ).toBe(SPEC_FIXTURE);
    expect(
      fixtureFor([{ role: "system", content: "You are the sections stage of a software factory." }]),
    ).toBe(SECTIONS_FIXTURE);
  });

  it("refuses to invent a fixture it does not have", () => {
    expect(() => fixtureFor([{ role: "system", content: "Something else" }])).toThrow(
      /no fixture/i,
    );
  });

  it("app.js is a real module, not an empty file", () => {
    expect(APP_JS_FIXTURE.trim().length).toBeGreaterThan(120);
  });
});

describe("self-host deploy rail", () => {
  it("builds stable paths and URLs", () => {
    expect(sitePrefix("fct_abc")).toBe("sites/fct_abc/");
    expect(sitePath("fct_abc")).toBe("/sites/fct_abc/");
    expect(sitePath("fct_abc", "/styles.css")).toBe("/sites/fct_abc/styles.css");
    expect(siteUrl("http://localhost:5173", "fct_abc")).toBe("http://localhost:5173/sites/fct_abc/");
    expect(siteUrl("https://factory.example.com/", "fct_abc")).toBe(
      "https://factory.example.com/sites/fct_abc/",
    );
  });

  it("writes every file under the build's prefix, with a content type", async () => {
    const bucket = fakeBucket();

    const { keys } = await publishSite({ ARTIFACTS: bucket } as SiteEnv, "fct_abc", SITE_FIXTURE);

    expect(keys).toEqual([
      "sites/fct_abc/index.html",
      "sites/fct_abc/styles.css",
      "sites/fct_abc/app.js",
    ]);
    expect(bucket.store.get("sites/fct_abc/styles.css")?.contentType).toContain("text/css");
  });

  it("verifies a published site by reading index.html back", async () => {
    const bucket = fakeBucket();
    await publishSite({ ARTIFACTS: bucket } as SiteEnv, "fct_abc", SITE_FIXTURE);

    const check = await verifyPublished({ ARTIFACTS: bucket } as SiteEnv, "fct_abc", CTA_FIXTURE);
    expect(check).toEqual({ ok: true, found: true, matched: true });
  });

  it("fails verification when the expected copy is absent", async () => {
    const bucket = fakeBucket();
    await publishSite({ ARTIFACTS: bucket } as SiteEnv, "fct_abc", SITE_FIXTURE);

    const check = await verifyPublished(
      { ARTIFACTS: bucket } as SiteEnv,
      "fct_abc",
      "this text is not on the page",
    );
    expect(check.ok).toBe(false);
    expect(check.matched).toBe(false);
  });

  it("fails verification when nothing was published", async () => {
    const check = await verifyPublished({ ARTIFACTS: fakeBucket() } as SiteEnv, "missing");
    expect(check).toEqual({ ok: false, found: false, matched: false });
  });
});
