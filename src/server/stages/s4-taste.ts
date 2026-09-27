import { lintFiles, renderTasteReport } from "../lint";
import type { TasteReport } from "../lint";
import type { GeneratedFile } from "../types";

export type TasteOutput = { report: TasteReport; markdown: string };

/**
 * FORGE phase 1, ported: deterministic, binary, no model in the loop.
 * A build cannot reach the deploy gate without SHIP.
 */
export function s4Taste(files: GeneratedFile[]): TasteOutput {
  const report = lintFiles(files);
  return { report, markdown: renderTasteReport(report) };
}
