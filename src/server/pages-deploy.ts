/**
 * Cloudflare Pages direct-upload rail: one authenticated multipart POST -> a live URL.
 * Chosen for the MVP because it needs no container, no CI wait, and no paid plan.
 */

export type DeployFile = { path: string; content: string };

export type ManifestEntry = {
  fieldName: string;
  filename: string;
  branchPath: string;
  content: string;
};

export type UploadManifest = {
  manifest: Record<string, string>;
  entries: ManifestEntry[];
};

export type PagesEnv = {
  accountId: string;
  apiToken: string;
  project: string;
};

export class PagesError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PagesError";
  }
}

const API = "https://api.cloudflare.com/client/v4";

export function normalizePath(path: string): string {
  return path.replace(/^\.?\//, "").replace(/\\/g, "/");
}

export function mimeFor(path: string): string {
  if (/\.html?$/i.test(path)) return "text/html; charset=utf-8";
  if (/\.css$/i.test(path)) return "text/css; charset=utf-8";
  if (/\.m?js$/i.test(path)) return "text/javascript; charset=utf-8";
  if (/\.json$/i.test(path)) return "application/json";
  if (/\.svg$/i.test(path)) return "image/svg+xml";
  return "text/plain; charset=utf-8";
}

export async function sha256Hex(content: string | Uint8Array): Promise<string> {
  const bytes =
    typeof content === "string" ? new TextEncoder().encode(content) : content;
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Pages identifies uploaded assets by content hash: the manifest maps
 * "/path" -> hash, and each file is appended under a field named by its hash.
 */
export async function buildUploadManifest(
  files: DeployFile[],
  hash: (content: string) => Promise<string> = sha256Hex,
): Promise<UploadManifest> {
  const manifest: Record<string, string> = {};
  const entries: ManifestEntry[] = [];

  for (const file of files) {
    const branchPath = normalizePath(file.path);
    const fieldName = await hash(file.content);
    manifest[`/${branchPath}`] = fieldName;
    entries.push({ fieldName, filename: branchPath, branchPath, content: file.content });
  }

  return { manifest, entries };
}

type FetchLike = typeof fetch;

async function pagesRequest<T>(
  env: PagesEnv,
  path: string,
  init: RequestInit = {},
  fetchImpl: FetchLike = fetch,
): Promise<T> {
  const response = await fetchImpl(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.apiToken}`,
      ...(init.body ? {} : { "content-type": "application/json" }),
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let parsed: any = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new PagesError(`Pages API returned non-JSON (${response.status}): ${text.slice(0, 300)}`, response.status);
  }

  if (!response.ok || parsed?.success === false) {
    const detail = (parsed?.errors ?? [])
      .map((e: any) => `${e.code}: ${e.message}`)
      .join("; ");
    throw new PagesError(
      `Pages API ${init.method ?? "GET"} ${path} failed (${response.status})${detail ? ` — ${detail}` : ""}`,
      response.status,
    );
  }

  return parsed.result as T;
}

export async function ensureProject(
  env: PagesEnv,
  fetchImpl: FetchLike = fetch,
): Promise<{ name: string; created: boolean }> {
  try {
    const existing = await pagesRequest<{ name: string }>(
      env,
      `/accounts/${env.accountId}/pages/projects/${env.project}`,
      {},
      fetchImpl,
    );
    return { name: existing.name, created: false };
  } catch (error) {
    if (!(error instanceof PagesError) || error.status !== 404) throw error;
  }

  const created = await pagesRequest<{ name: string }>(
    env,
    `/accounts/${env.accountId}/pages/projects`,
    {
      method: "POST",
      body: JSON.stringify({ name: env.project, production_branch: "main" }),
    },
    fetchImpl,
  );
  return { name: created.name, created: true };
}

export type Deployment = {
  id: string;
  url?: string;
  aliases?: string[];
  latest_stage?: { name: string; status: string };
};

export async function uploadDeployment(
  env: PagesEnv,
  files: DeployFile[],
  fetchImpl: FetchLike = fetch,
  branch = "main",
): Promise<{ deployment: Deployment; manifest: Record<string, string> }> {
  const { manifest, entries } = await buildUploadManifest(files);

  const form = new FormData();
  form.append("manifest", JSON.stringify(manifest));
  // A non-production branch gives every build its own preview URL instead of
  // overwriting the project's production deployment.
  form.append("branch", branch);
  for (const entry of entries) {
    form.append(
      entry.fieldName,
      new Blob([entry.content], { type: mimeFor(entry.branchPath) }),
      entry.branchPath,
    );
  }

  const deployment = await pagesRequest<Deployment>(
    env,
    `/accounts/${env.accountId}/pages/projects/${env.project}/deployments`,
    { method: "POST", body: form },
    fetchImpl,
  );

  return { deployment, manifest };
}

export type PollResult = { ok: boolean; deployment: Deployment; stages: string[] };

export async function pollDeployment(
  env: PagesEnv,
  deploymentId: string,
  options: {
    fetchImpl?: FetchLike;
    sleepImpl?: (ms: number) => Promise<void>;
    attempts?: number;
    intervalMs?: number;
  } = {},
): Promise<PollResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleepImpl ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const attempts = options.attempts ?? 40;
  const intervalMs = options.intervalMs ?? 3000;

  let last: Deployment = { id: deploymentId };
  const seen: string[] = [];

  for (let i = 0; i < attempts; i++) {
    last = await pagesRequest<Deployment>(
      env,
      `/accounts/${env.accountId}/pages/projects/${env.project}/deployments/${deploymentId}`,
      {},
      fetchImpl,
    );
    const status = last.latest_stage?.status ?? "unknown";
    seen.push(status);

    if (status === "success") return { ok: true, deployment: last, stages: seen };
    if (status === "failure" || status === "canceled") {
      return { ok: false, deployment: last, stages: seen };
    }
    await sleep(intervalMs);
  }

  return { ok: false, deployment: last, stages: seen };
}

export async function verifyLive(
  url: string,
  options: {
    mustContain?: string;
    fetchImpl?: FetchLike;
    sleepImpl?: (ms: number) => Promise<void>;
    attempts?: number;
  } = {},
): Promise<{ ok: boolean; status: number; matched: boolean }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleepImpl ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const attempts = options.attempts ?? 6;
  let status = 0;
  let body = "";

  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetchImpl(url, { redirect: "follow" });
      status = response.status;
      if (status === 200) {
        body = await response.text();
        break;
      }
    } catch {
      status = 0;
    }
    await sleep(2000);
  }

  const matched = options.mustContain
    ? body.toLowerCase().includes(options.mustContain.toLowerCase())
    : status === 200;

  return { ok: status === 200 && matched, status, matched };
}

export type DeployResult = {
  url: string;
  deploymentId: string;
  preview?: string;
  verified: boolean;
  attempts: number;
};

export async function deployToPages(options: {
  env: PagesEnv;
  files: DeployFile[];
  branch?: string;
  mustContain?: string;
  fetchImpl?: FetchLike;
  sleepImpl?: (ms: number) => Promise<void>;
}): Promise<DeployResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  await ensureProject(options.env, fetchImpl);

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { deployment } = await uploadDeployment(
        options.env,
        options.files,
        fetchImpl,
        options.branch,
      );
      const poll = await pollDeployment(options.env, deployment.id, {
        fetchImpl,
        sleepImpl: options.sleepImpl,
      });

      if (!poll.ok) {
        throw new PagesError(
          `Deployment ${deployment.id} did not succeed (stages: ${poll.stages.join(" -> ")})`,
        );
      }

      const url =
        poll.deployment.url ??
        (poll.deployment.aliases?.length ? `https://${poll.deployment.aliases[0]}` : deployment.url);

      if (!url) throw new PagesError("Deployment succeeded but returned no URL.");

      const check = await verifyLive(url, {
        mustContain: options.mustContain,
        fetchImpl,
        sleepImpl: options.sleepImpl,
      });

      if (!check.ok) {
        throw new PagesError(
          `Live check failed for ${url} (status ${check.status}, matched=${check.matched})`,
        );
      }

      return {
        url,
        deploymentId: deployment.id,
        preview: deployment.url,
        verified: true,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new PagesError("Pages deploy failed for an unknown reason.");
}
