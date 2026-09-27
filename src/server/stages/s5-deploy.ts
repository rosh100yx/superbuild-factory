import { deployToPages } from "../pages-deploy";
import type { DeployResult, PagesEnv } from "../pages-deploy";
import type { GeneratedFile } from "../types";

/**
 * The deploy rail. Pages direct upload, then a live verify.
 * The caller (BuildWorkflow) is responsible for the SHIP verdict and the approval event —
 * this function only runs once both exist.
 */
export async function s5Deploy(input: {
  pages: PagesEnv;
  files: GeneratedFile[];
  branch?: string;
  mustContain?: string;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}): Promise<DeployResult> {
  return deployToPages({
    env: input.pages,
    files: input.files,
    branch: input.branch,
    mustContain: input.mustContain,
    fetchImpl: input.fetchImpl,
    sleepImpl: input.sleepImpl,
  });
}
