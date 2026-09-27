import { callModel } from "../models";
import type { ModelTarget } from "../models";

export class SectionsInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SectionsInvalidError";
  }
}

export type SectionsOutput = { sectionMap: string; sectionCount: number };

export const MIN_SECTIONS = 4;

const SYSTEM = `You are the sections stage of a software factory.

Given a specification, produce the section map for a single landing page.

Rules:
- Output markdown only. No preamble, no fences.
- One numbered line per section: "1. <SectionName> — <editorial job> (<beat #>)"
- At least 4 sections. Order them as the reader scrolls.
- The first section is the hero and must carry the primary call to action.
- Every section must name the beat it serves.
- After the list, add a line: "Primary CTA: <label>"`;

export function countSections(sectionMap: string): number {
  return sectionMap
    .split("\n")
    .filter((l) => /^\d+\.\s+\S/.test(l.trim())).length;
}

export function parsePrimaryCta(sectionMap: string): string | null {
  const match = sectionMap.match(/^\s*Primary CTA\s*:\s*(.+)$/im);
  return match ? match[1].trim() : null;
}

export async function s2Sections(input: {
  spec: string;
  target: ModelTarget;
  fetchImpl?: typeof fetch;
}): Promise<SectionsOutput> {
  const { text } = await callModel({
    target: input.target,
    fetchImpl: input.fetchImpl,
    temperature: 0.3,
    maxTokens: 4000,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: input.spec },
    ],
  });

  const sectionCount = countSections(text);
  if (sectionCount < MIN_SECTIONS) {
    throw new SectionsInvalidError(
      `S2 produced ${sectionCount} sections; at least ${MIN_SECTIONS} are required.`,
    );
  }
  if (!parsePrimaryCta(text)) {
    throw new SectionsInvalidError("S2 produced no `Primary CTA:` line.");
  }

  return { sectionMap: text, sectionCount };
}
