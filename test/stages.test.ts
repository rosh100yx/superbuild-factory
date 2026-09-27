import { describe, expect, it, vi } from "vitest";

import { OPENROUTER_URL } from "../src/server/models";
import type { ModelTarget } from "../src/server/models";
import { BriefTooVagueError, countBeats, parseOutcome, s1Brief, validateSpec } from "../src/server/stages/s1-brief";
import { SectionsInvalidError, countSections, parsePrimaryCta, s2Sections } from "../src/server/stages/s2-sections";
import { BuildOutputError, parseDelimitedFiles, s3Build, validateFiles } from "../src/server/stages/s3-build";
import { s4Taste } from "../src/server/stages/s4-taste";

const GOOD_SPEC = `Outcome: twelve qualified applications for the next Build-Scale cohort.

## The problem
Agencies ship AI slop because nobody owns taste.
- name the failure mode
- show the cost

## Who it is for
Design engineers already using AI tools.

## What changes
Four weeks of drills and real reviews.

## The offer
Twelve seats, application only.

## How to apply
One form, two minutes.`;

const GOOD_MAP = `1. Hero — state the promise (beat 1)
2. Problem — name the pain (beat 2)
3. Method — what changes in four weeks (beat 3)
4. Offer — the seats and the price (beat 4)

Primary CTA: Apply for the cohort`;

function modelResponse(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

const TARGET: ModelTarget = {
  provider: "openrouter",
  baseUrl: OPENROUTER_URL,
  keyName: "OPENROUTER_API_KEY",
  apiKey: "k",
  model: "m",
};

describe("s1Brief validation", () => {
  it("accepts a spec with an outcome and five beats", () => {
    const result = validateSpec(GOOD_SPEC);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.beats).toBe(5);
  });

  it("rejects a spec with no Outcome line", () => {
    const result = validateSpec(GOOD_SPEC.replace(/^Outcome:.*$/m, ""));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/Outcome/);
  });

  it("rejects a spec with too few beats", () => {
    const result = validateSpec("Outcome: something.\n\n## One\nx\n\n## Two\ny");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/beats/);
  });

  it("does not count the open-questions section as a beat", () => {
    expect(countBeats(`${GOOD_SPEC}\n\n## Open questions\nwhat is the price?`)).toBe(5);
  });

  it("parses the outcome", () => {
    expect(parseOutcome(GOOD_SPEC)).toMatch(/twelve qualified applications/);
  });

  it("throws BriefTooVagueError from s1Brief when the model is vague", async () => {
    const fetchImpl = vi.fn(async () => modelResponse("Here is a vague plan with no outcome."));

    await expect(
      s1Brief({
        request: "make me a site",
        project: "superbuild",
        target: TARGET,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(BriefTooVagueError);
  });

  it("returns the spec from s1Brief on a good completion", async () => {
    const fetchImpl = vi.fn(async () => modelResponse(GOOD_SPEC));
    const result = await s1Brief({
      request: "landing page for the cohort",
      project: "superbuild",
      target: TARGET,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.beats).toBe(5);
    expect(result.outcome).toMatch(/twelve/);
  });
});

describe("s2Sections", () => {
  it("counts sections and reads the CTA", () => {
    expect(countSections(GOOD_MAP)).toBe(4);
    expect(parsePrimaryCta(GOOD_MAP)).toBe("Apply for the cohort");
  });

  it("rejects a map with too few sections", async () => {
    const fetchImpl = vi.fn(async () => modelResponse("1. Hero\n\nPrimary CTA: Go"));
    await expect(
      s2Sections({ spec: GOOD_SPEC, target: TARGET, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(SectionsInvalidError);
  });

  it("rejects a map with no CTA line", async () => {
    const fetchImpl = vi.fn(async () => modelResponse("1. a\n2. b\n3. c\n4. d"));
    await expect(
      s2Sections({ spec: GOOD_SPEC, target: TARGET, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/Primary CTA/);
  });

  it("accepts a good map", async () => {
    const fetchImpl = vi.fn(async () => modelResponse(GOOD_MAP));
    const result = await s2Sections({
      spec: GOOD_SPEC,
      target: TARGET,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.sectionCount).toBe(4);
  });
});

describe("s3Build", () => {
  const delimited = `===FILE: index.html===
<!doctype html>
<html lang="en"><head><title>t</title></head><body><h1>h</h1></body></html>

===FILE: styles.css===
:root { --bg: #000; }

===FILE: app.js===
console.log(1);
`;

  it("parses three delimited files", () => {
    const files = parseDelimitedFiles(delimited);
    expect(files.map((f) => f.path)).toEqual(["index.html", "styles.css", "app.js"]);
    expect(files[0].content).toContain("<h1>h</h1>");
  });

  it("throws when there are no markers", () => {
    expect(() => parseDelimitedFiles("just some prose")).toThrow(BuildOutputError);
  });

  it("throws when a required file is missing", () => {
    expect(() =>
      validateFiles(parseDelimitedFiles("===FILE: index.html===\n<html></html>")),
    ).toThrow(/styles.css/);
  });

  it("throws on an empty file", () => {
    expect(() =>
      validateFiles([
        { path: "index.html", content: "<html></html>" },
        { path: "styles.css", content: "   " },
      ]),
    ).toThrow(/empty/);
  });

  it("survives content that would have broken a JSON contract", () => {
    const nasty = `===FILE: index.html===
<html lang="en"><script>const s = "he said \\"hi\\"";</script>

===FILE: styles.css===
body { color: red; }
`;
    const files = parseDelimitedFiles(nasty);
    expect(files[0].content).toContain('he said \\"hi\\"');
  });

  it("builds from a model completion", async () => {
    const fetchImpl = vi.fn(async () => modelResponse(delimited));
    const result = await s3Build({
      spec: GOOD_SPEC,
      sectionMap: GOOD_MAP,
      target: TARGET,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.files).toHaveLength(3);
  });
});

describe("s4Taste", () => {
  it("blocks when the required files are missing", () => {
    const out = s4Taste([{ path: "index.html", content: "<html></html>" }]);
    expect(out.report.verdict).toBe("FIX FIRST");
    expect(out.markdown).toContain("FIX FIRST");
  });
});
