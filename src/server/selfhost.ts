import { mimeFor } from "./pages-deploy";
import type { GeneratedFile } from "./types";

/**
 * The self-host deploy rail: publish the generated site into the factory's own R2
 * bucket and serve it from the Worker at /sites/<buildId>/.
 *
 * Why this exists: Cloudflare Pages needs a scoped API token, which means a fork of
 * this project cannot reach a live URL with only a model key. Self-hosting removes
 * that second credential, so "bring your own key" is genuinely one key.
 */

export type SiteEnv = { ARTIFACTS: R2Bucket };

export function sitePrefix(buildId: string): string {
  return `sites/${buildId}/`;
}

export function sitePath(buildId: string, filePath = ""): string {
  return `/sites/${buildId}/${filePath.replace(/^\//, "")}`;
}

export function siteUrl(origin: string, buildId: string): string {
  return `${origin.replace(/\/+$/, "")}${sitePath(buildId)}`;
}

export async function publishSite(
  env: SiteEnv,
  buildId: string,
  files: GeneratedFile[],
): Promise<{ keys: string[] }> {
  const keys: string[] = [];

  for (const file of files) {
    const key = `${sitePrefix(buildId)}${file.path.replace(/^\//, "")}`;
    await env.ARTIFACTS.put(key, file.content, {
      httpMetadata: { contentType: mimeFor(file.path) },
    });
    keys.push(key);
  }

  return { keys };
}

/**
 * Verify by reading the published entry point back out of R2. Deliberately a
 * read-back rather than an HTTP fetch: a Workflow fetching its own Worker URL is
 * awkward and flaky, and the thing that must be true is that the bytes are stored
 * and addressable — which /sites/ then serves.
 */
export async function verifyPublished(
  env: SiteEnv,
  buildId: string,
  mustContain?: string,
): Promise<{ ok: boolean; found: boolean; matched: boolean }> {
  const object = await env.ARTIFACTS.get(`${sitePrefix(buildId)}index.html`);
  if (!object) return { ok: false, found: false, matched: false };

  const body = await object.text();
  const matched = mustContain
    ? body.toLowerCase().includes(mustContain.toLowerCase())
    : true;

  return { ok: matched, found: true, matched };
}
