import { deployToPages } from "../pages-deploy";
import type { PagesEnv } from "../pages-deploy";
import { publishSite, sitePath, siteUrl, verifyPublished } from "../selfhost";
import type { SiteEnv } from "../selfhost";
import type { DeployTarget, GeneratedFile } from "../types";

export type DeployOutcome = {
  target: DeployTarget;
  url: string;
  verified: boolean;
  attempts: number;
  deploymentId?: string;
  preview?: string;
};

/**
 * The deploy rail. The caller (BuildWorkflow) is responsible for the SHIP verdict and
 * the approval event — this only runs once both exist.
 *
 * Two targets:
 *   factory-r2      self-hosted in the factory's own bucket, served at /sites/<id>/.
 *                   Needs no extra credential, so a fork runs end to end with one key.
 *   cloudflare-pages  a real Pages project. Needs a scoped API token.
 */
export async function s5Deploy(input: {
  target: DeployTarget;
  buildId: string;
  files: GeneratedFile[];
  site: SiteEnv;
  pages?: PagesEnv;
  origin?: string;
  branch?: string;
  mustContain?: string;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}): Promise<DeployOutcome> {
  if (input.target === "factory-r2") {
    await publishSite(input.site, input.buildId, input.files);

    const check = await verifyPublished(input.site, input.buildId, input.mustContain);
    if (!check.ok) {
      throw new Error(
        check.found
          ? "Published site did not contain the expected call to action."
          : "Published site has no index.html in R2.",
      );
    }

    return {
      target: "factory-r2",
      url: input.origin ? siteUrl(input.origin, input.buildId) : sitePath(input.buildId),
      verified: true,
      attempts: 1,
    };
  }

  if (!input.pages) {
    throw new Error("The cloudflare-pages target needs CF_API_TOKEN and CF_ACCOUNT_ID.");
  }

  const result = await deployToPages({
    env: input.pages,
    files: input.files,
    branch: input.branch,
    mustContain: input.mustContain,
    fetchImpl: input.fetchImpl,
    sleepImpl: input.sleepImpl,
  });

  return {
    target: "cloudflare-pages",
    url: result.url,
    verified: result.verified,
    attempts: result.attempts,
    deploymentId: result.deploymentId,
    preview: result.preview,
  };
}
