import { describe, expect, it } from "vitest";

import { lintFiles, renderTasteReport } from "../src/server/lint";
import type { GeneratedFile } from "../src/server/types";

const CLEAN_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Build Scale — ship the thing you meant</title>
</head>
<body>
  <h1>Ship the thing you meant</h1>
  <section id="problem"><h2>The problem</h2><p>AI slop ships fast and reads cheap.</p></section>
  <section id="who"><h2>Who it is for</h2><p>Design engineers at agencies.</p></section>
  <section id="change"><h2>What changes</h2><p>Four weeks of taste drills and real reviews.</p></section>
  <section id="offer"><h2>The offer</h2><p>Twelve seats, application only.</p></section>
</body>
</html>`;

const CLEAN_CSS = `:root {
  --bg: #0a0c10;
  --fg: #e7ecf2;
  --accent: #f5a524;
}
body { background: var(--bg); color: var(--fg); margin: 0; }
a { color: var(--accent); display: inline-block; padding: 8px 12px; }
section { padding: 32px 16px; max-width: 72ch; margin: 0 auto; }`;

const CLEAN_JS = `document.querySelectorAll("section").forEach(function (node) {
  node.setAttribute("data-ready", "true");
});`;

function cleanFiles(): GeneratedFile[] {
  return [
    { path: "index.html", content: CLEAN_HTML },
    { path: "styles.css", content: CLEAN_CSS },
    { path: "app.js", content: CLEAN_JS },
  ];
}

describe("lintFiles", () => {
  it("ships a clean page with zero errors", () => {
    const report = lintFiles(cleanFiles());
    expect(report.verdict).toBe("SHIP");
    expect(report.errors).toBe(0);
    expect(report.findings.filter((f) => f.severity === "error")).toEqual([]);
  });

  it("fails on a hardcoded colour in the HTML", () => {
    const files = cleanFiles().map((f) =>
      f.path === "index.html"
        ? { ...f, content: f.content.replace("<h1>", '<h1 style="color:#ff0000">') }
        : f,
    );
    const report = lintFiles(files);
    expect(report.verdict).toBe("FIX FIRST");
    expect(report.findings.some((f) => f.rule === "hardcoded-color")).toBe(true);
  });

  it("fails when a required file is missing", () => {
    const report = lintFiles(cleanFiles().filter((f) => f.path !== "styles.css"));
    expect(report.verdict).toBe("FIX FIRST");
    expect(report.findings.some((f) => f.rule === "required-file")).toBe(true);
  });

  it("fails on more than one h1", () => {
    const files = cleanFiles().map((f) =>
      f.path === "index.html"
        ? { ...f, content: f.content.replace("</body>", "<h1>Second</h1></body>") }
        : f,
    );
    const report = lintFiles(files);
    expect(report.findings.some((f) => f.rule === "single-h1" && f.severity === "error")).toBe(true);
  });

  it("fails on placeholder copy", () => {
    const files = cleanFiles().map((f) =>
      f.path === "index.html"
        ? { ...f, content: f.content.replace("AI slop ships fast and reads cheap.", "Lorem ipsum dolor sit amet.") }
        : f,
    );
    const report = lintFiles(files);
    expect(report.findings.some((f) => f.rule === "placeholder-copy")).toBe(true);
    expect(report.verdict).toBe("FIX FIRST");
  });

  it("keeps warnings from blocking a ship", () => {
    const files = cleanFiles().map((f) =>
      f.path === "styles.css" ? { ...f, content: "body { color: #333; padding: 8px 12px; }" } : f,
    );
    const report = lintFiles(files);
    expect(report.errors).toBe(0);
    expect(report.verdict).toBe("SHIP");
    expect(report.warnings).toBeGreaterThan(0);
  });

  it("reports line numbers for findings", () => {
    const report = lintFiles([
      { path: "index.html", content: CLEAN_HTML.replace("<h1>", '<h1 style="background:#abcdef">') },
      { path: "styles.css", content: CLEAN_CSS },
    ]);
    const finding = report.findings.find((f) => f.rule === "hardcoded-color");
    expect(finding?.line).toBeGreaterThan(0);
  });
});

describe("renderTasteReport", () => {
  it("renders the verdict and a findings table", () => {
    const md = renderTasteReport(lintFiles([{ path: "index.html", content: "<html></html>" }]));
    expect(md).toContain("FIX FIRST");
    expect(md).toContain("| severity | rule |");
  });
});
