import { callModel } from "../models";

export class BriefTooVagueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BriefTooVagueError";
  }
}

export type BriefOutput = { spec: string; beats: number; outcome: string };

export const MIN_BEATS = 5;

const SYSTEM = `You are the brief stage of a software factory.

Turn a business request into an execution-ready specification. You do not write code.

Rules:
- Output GitHub-flavoured markdown only. No preamble, no fences.
- The FIRST non-blank line must be exactly: Outcome: <one sentence, the measurable result>
- Then exactly one "## " section per narrative beat, in scroll order, at least 5 of them.
- Each beat states its job in one line, then 1-3 concrete content requirements.
- Name the audience explicitly in the first beat.
- No adjectives that cannot be verified ("stunning", "seamless", "world-class").
- If the request is too vague to specify, still produce the best structure you can, but say what is missing
  under a final "## Open questions" section.`;

export function countBeats(spec: string): number {
  const lines = spec.split("\n");
  const headings = lines.filter((l) => /^##\s+\S/.test(l) && !/^##\s+open questions/i.test(l));
  const numbered = lines.filter((l) => /^\d+\.\s+\S/.test(l));
  return Math.max(headings.length, numbered.length);
}

export function parseOutcome(spec: string): string | null {
  const match = spec.match(/^\s*\**Outcome\**\s*:\s*(.+)$/im);
  return match ? match[1].trim() : null;
}

export type SpecValidation =
  | { ok: true; beats: number; outcome: string }
  | { ok: false; reason: string };

export function validateSpec(spec: string): SpecValidation {
  if (!spec.trim()) return { ok: false, reason: "spec is empty" };
  const outcome = parseOutcome(spec);
  if (!outcome) {
    return { ok: false, reason: "no explicit `Outcome:` line" };
  }
  const beats = countBeats(spec);
  if (beats < MIN_BEATS) {
    return { ok: false, reason: `only ${beats} narrative beats (need at least ${MIN_BEATS})` };
  }
  return { ok: true, beats, outcome };
}

export async function s1Brief(input: {
  request: string;
  project: string;
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<BriefOutput> {
  const { text } = await callModel({
    model: input.model,
    apiKey: input.apiKey,
    fetchImpl: input.fetchImpl,
    temperature: 0.3,
    maxTokens: 4000,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Project: ${input.project}\n\nRequest:\n${input.request}`,
      },
    ],
  });

  const validation = validateSpec(text);
  if (!validation.ok) {
    throw new BriefTooVagueError(
      `Brief rejected at S1: ${validation.reason}. Rephrase the request with a clear audience, ` +
        `a measurable outcome, and at least ${MIN_BEATS} concrete beats.`,
    );
  }

  return { spec: text, beats: validation.beats, outcome: validation.outcome };
}
