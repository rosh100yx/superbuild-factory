import type { GeneratedFile } from "./types";

export type Finding = {
  rule: string;
  severity: "error" | "warn";
  file: string;
  line?: number;
  message: string;
};

export type TasteReport = {
  verdict: "SHIP" | "FIX FIRST";
  errors: number;
  warnings: number;
  findings: Finding[];
  checkedAt: string;
};

export const REQUIRED_FILES = ["index.html", "styles.css"];

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const PLACEHOLDER_PATTERNS: Array<[RegExp, string]> = [
  [/lorem ipsum/i, "lorem ipsum filler copy"],
  [/\bTODO\b/, "TODO left in output"],
  [/\bFIXME\b/, "FIXME left in output"],
  [/coming soon/i, "'coming soon' placeholder"],
  [/\bplaceholder\b/i, "'placeholder' text"],
];

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function codeFiles(files: GeneratedFile[]): GeneratedFile[] {
  return files.filter((f) => /\.(html|js|jsx|ts|tsx)$/i.test(f.path));
}

/**
 * Deterministic taste lint — Phase 1 of FORGE's two-phase gate, ported.
 * Binary and testable on purpose: no model in the loop, so the verdict is reproducible.
 */
export function lintFiles(
  files: GeneratedFile[],
  now: () => string = () => new Date().toISOString(),
): TasteReport {
  const findings: Finding[] = [];
  const byPath = new Map(files.map((f) => [f.path, f]));

  const push = (f: Omit<Finding, "severity"> & { severity?: Finding["severity"] }) =>
    findings.push({ severity: "error", ...f } as Finding);

  for (const required of REQUIRED_FILES) {
    if (!byPath.has(required)) {
      push({
        rule: "required-file",
        file: required,
        message: `missing required file "${required}"`,
      });
    }
  }

  for (const file of files) {
    if (!file.content.trim()) {
      push({
        rule: "empty-file",
        file: file.path,
        message: "file is empty",
      });
    } else if (file.content.trim().length < 120) {
      push({
        rule: "thin-file",
        severity: "warn",
        file: file.path,
        message: `file is suspiciously small (${file.content.trim().length} chars)`,
      });
    }

    for (const [pattern, label] of PLACEHOLDER_PATTERNS) {
      const match = file.content.match(pattern);
      if (match) {
        push({
          rule: "placeholder-copy",
          file: file.path,
          line: lineOf(file.content, match.index ?? 0),
          message: label,
        });
      }
    }
  }

  for (const file of codeFiles(files)) {
    const matches = [...file.content.matchAll(HEX)].slice(0, 5);
    for (const match of matches) {
      push({
        rule: "hardcoded-color",
        file: file.path,
        line: lineOf(file.content, match.index ?? 0),
        message: `hardcoded colour ${match[0]} — colours belong in styles.css as tokens`,
      });
    }
  }

  const html = byPath.get("index.html");
  if (html) {
    const c = html.content;

    if (!/<html[^>]*\slang=/i.test(c)) {
      push({ rule: "html-lang", file: "index.html", message: "`<html lang>` is missing" });
    }
    if (!/name=["']viewport["']/i.test(c)) {
      push({ rule: "viewport", file: "index.html", message: "viewport meta tag is missing" });
    }
    if (!/<title>\s*\S+/i.test(c)) {
      push({ rule: "title", file: "index.html", message: "<title> is missing or empty" });
    }

    const h1s = [...c.matchAll(/<h1[\s>]/gi)];
    if (h1s.length === 0) {
      push({ rule: "single-h1", file: "index.html", message: "no <h1> on the page" });
    } else if (h1s.length > 1) {
      push({
        rule: "single-h1",
        file: "index.html",
        message: `${h1s.length} <h1> tags — exactly one is allowed`,
      });
    }

    const sections = [...c.matchAll(/<section[\s>]/gi)].length;
    if (sections < 4) {
      push({
        rule: "beats",
        severity: "warn",
        file: "index.html",
        message: `only ${sections} <section> blocks — a landing page needs at least 4 beats`,
      });
    }

    const imgs = [...c.matchAll(/<img\b[^>]*>/gi)];
    const noAlt = imgs.filter((m) => !/\salt=/i.test(m[0]));
    if (noAlt.length) {
      push({
        rule: "img-alt",
        severity: "warn",
        file: "index.html",
        message: `${noAlt.length} <img> without alt text`,
      });
    }

    const inlineHandlers = [...c.matchAll(/\son(click|load|submit|change)=/gi)];
    if (inlineHandlers.length) {
      push({
        rule: "inline-handler",
        severity: "warn",
        file: "index.html",
        message: `${inlineHandlers.length} inline event handler(s) — wire these in app.js`,
      });
    }

    const deadLinks = [...c.matchAll(/href=["']#["']/gi)];
    if (deadLinks.length) {
      push({
        rule: "dead-link",
        severity: "warn",
        file: "index.html",
        message: `${deadLinks.length} href="#" link(s)`,
      });
    }
  }

  const css = byPath.get("styles.css");
  if (css) {
    const importants = [...css.content.matchAll(/!important/g)].length;
    if (importants > 2) {
      push({
        rule: "important-overuse",
        severity: "warn",
        file: "styles.css",
        message: `${importants} !important declarations`,
      });
    }
    if (!/--[a-z0-9-]+\s*:/i.test(css.content)) {
      push({
        rule: "no-tokens",
        severity: "warn",
        file: "styles.css",
        message: "no CSS custom properties — define the palette as tokens in :root",
      });
    }
    const bodyWithoutRoot = css.content.replace(/:root\s*{[^}]*}/gi, "");
    const strayHex = [...bodyWithoutRoot.matchAll(HEX)].length;
    if (strayHex > 8) {
      push({
        rule: "stray-hex",
        severity: "warn",
        file: "styles.css",
        message: `${strayHex} raw hex values outside :root — use the tokens`,
      });
    }
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warn").length;

  return {
    verdict: errors === 0 ? "SHIP" : "FIX FIRST",
    errors,
    warnings,
    findings,
    checkedAt: now(),
  };
}

export function renderTasteReport(report: TasteReport): string {
  const lines = [
    `# Taste review`,
    ``,
    `**Verdict: ${report.verdict}** — ${report.errors} error(s), ${report.warnings} warning(s)`,
    ``,
  ];

  if (!report.findings.length) {
    lines.push("No findings. Clean.");
    return lines.join("\n");
  }

  lines.push("| severity | rule | file:line | message |", "| --- | --- | --- | --- |");
  for (const f of report.findings) {
    const loc = f.line ? `${f.file}:${f.line}` : f.file;
    lines.push(`| ${f.severity} | ${f.rule} | ${loc} | ${f.message} |`);
  }
  return lines.join("\n");
}
