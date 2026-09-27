import { callModel } from "../models";
import type { GeneratedFile } from "../types";
import { REQUIRED_FILES } from "../lint";

export class BuildOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuildOutputError";
  }
}

export type BuildOutput = { files: GeneratedFile[] };

/**
 * A delimited format, not JSON. Long HTML inside JSON strings is the single most
 * common failure mode for cheap models (unescaped newlines and quotes), and a
 * delimiter cannot be broken by the content it wraps.
 */
export const FILE_MARKER = "===FILE:";

const SYSTEM = `You are the build stage of a software factory.

Produce a complete, static, single-page site as three files: index.html, styles.css, app.js.

Output format — EXACTLY this, nothing else:

===FILE: index.html===
<the complete file>
===FILE: styles.css===
<the complete file>
===FILE: app.js===
<the complete file>

Hard rules:
- No markdown fences. No commentary before, between, or after the files.
- index.html: doctype, <html lang="en">, viewport meta, a non-empty <title>, exactly one <h1>,
  at least 4 <section> blocks, real copy from the spec (never lorem ipsum or placeholder text).
- styles.css: define the palette as custom properties in :root, then use them. No raw hex outside :root.
- app.js: progressive enhancement only. No inline event handlers in the HTML.
- Every <img> needs alt text. No href="#" links.
- Colours and spacing come from tokens; keep it responsive with one breakpoint.`;

export function parseDelimitedFiles(raw: string): GeneratedFile[] {
  const markerLine = new RegExp(`^${FILE_MARKER}\\s*(.+?)\\s*=*\\s*$`, "gm");
  const matches = [...raw.matchAll(markerLine)];
  if (!matches.length) {
    throw new BuildOutputError(`No "${FILE_MARKER} <path>===" markers found in model output.`);
  }

  const files: GeneratedFile[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const path = match[1].trim();
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length;
    const content = raw.slice(start, end).replace(/^\s*\n/, "").replace(/\s+$/, "\n");
    if (path) files.push({ path, content });
  }
  return files;
}

export function validateFiles(files: GeneratedFile[]): void {
  if (!files.length) throw new BuildOutputError("Model produced no files.");

  for (const required of REQUIRED_FILES) {
    if (!files.some((f) => f.path === required)) {
      throw new BuildOutputError(`Model output is missing "${required}".`);
    }
  }

  for (const file of files) {
    if (!file.content.trim()) {
      throw new BuildOutputError(`Model produced an empty "${file.path}".`);
    }
    if (/^===FILE:/m.test(file.content)) {
      throw new BuildOutputError(`"${file.path}" contains a nested file marker — output is malformed.`);
    }
  }
}

export async function s3Build(input: {
  spec: string;
  sectionMap: string;
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<BuildOutput> {
  const { text } = await callModel({
    model: input.model,
    apiKey: input.apiKey,
    fetchImpl: input.fetchImpl,
    temperature: 0.4,
    maxTokens: 16000,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `SPECIFICATION\n${input.spec}\n\nSECTION MAP\n${input.sectionMap}`,
      },
    ],
  });

  const files = parseDelimitedFiles(text);
  validateFiles(files);
  return { files };
}
