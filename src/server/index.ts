import { routeAgentRequest } from "agents";

import type { Env } from "./env";
import { GuardrailError, resolveProvider, resolveTarget } from "./models";
import type { BuildBrief, DeployTarget, ModelPolicy } from "./types";
import { mimeFor } from "./pages-deploy";
import { getBuildAgent, getIndexAgent } from "./agents";

export { FactoryAgent, FactoryIndex } from "./factory-agent";
export { BuildWorkflow } from "./build-workflow";

const POLICIES: ModelPolicy[] = ["free", "zdr-paid"];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function isLocal(url: URL): boolean {
  return ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
}

function authorized(request: Request, url: URL, env: Env): boolean {
  const expected = env.FACTORY_TOKEN;
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const supplied = bearer || url.searchParams.get("token") || "";

  // An unset token opens local development only. Production must set FACTORY_TOKEN.
  if (!expected) return isLocal(url);
  return supplied.length > 0 && supplied === expected;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        freeProvider: resolveProvider("free", env),
        freeModel: env.FREE_MODEL,
        zdrProvider: resolveProvider("zdr-paid", env),
        zdrModel: env.ZDR_MODEL,
        pagesProject: env.PAGES_PROJECT,
        deployTarget: deployTargetFor(env),
      });
    }

    // Published sites are public: a build's output is meant to be viewed, so this
    // sits before the auth check, not behind it.
    const siteMatch = url.pathname.match(/^\/sites\/([^/]+)\/?(.*)$/);
    if (siteMatch && (request.method === "GET" || request.method === "HEAD")) {
      const buildId = decodeURIComponent(siteMatch[1]);
      const rest = siteMatch[2] ?? "";
      const filePath = rest.length > 0 ? rest : "index.html";
      const object = await env.ARTIFACTS.get(`sites/${buildId}/${filePath}`);
      if (!object) return new Response("not found", { status: 404 });
      return new Response(object.body, {
        headers: { "content-type": mimeFor(filePath), "cache-control": "no-store" },
      });
    }

    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/agents/")) {
      if (!authorized(request, url, env)) return json({ error: "unauthorized" }, 401);
    }

    if (url.pathname === "/api/artifact") {
      const key = url.searchParams.get("key") ?? "";
      if (!key.startsWith("builds/")) return json({ error: "invalid key" }, 400);
      const object = await env.ARTIFACTS.get(key);
      if (!object) return json({ error: "not found" }, 404);
      return new Response(object.body, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const buildMatch = url.pathname.match(/^\/api\/builds\/([^/]+)$/);
    if (buildMatch && request.method === "GET") {
      const agent = await getBuildAgent(env, decodeURIComponent(buildMatch[1]));
      return json(await agent.getState());
    }

    if (url.pathname === "/api/builds") {
      if (request.method === "GET") {
        const index = await getIndexAgent(env);
        return json({ builds: await index.list() });
      }
      if (request.method === "POST") return createBuild(request, env);
      return json({ error: "method not allowed" }, 405);
    }

    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

function deployTargetFor(env: Env): DeployTarget {
  // Widened deliberately: `wrangler types` narrows this var to its literal value.
  const configured: string = env.DEPLOY_TARGET ?? "";
  return configured === "cloudflare-pages" ? "cloudflare-pages" : "factory-r2";
}

async function createBuild(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const text = typeof body.request === "string" ? body.request.trim() : "";
  if (text.length < 20) {
    return json({ error: "Describe the request in at least 20 characters." }, 400);
  }

  const project =
    typeof body.project === "string" && body.project.trim()
      ? body.project.trim().toLowerCase()
      : "superbuild";

  const policy: ModelPolicy = POLICIES.includes(body.policy as ModelPolicy)
    ? (body.policy as ModelPolicy)
    : "free";

  const brief: BuildBrief = {
    request: text,
    project,
    policy,
    deployTarget: deployTargetFor(env),
    origin: new URL(request.url).origin,
  };

  let target;
  try {
    target = resolveTarget(project, policy, env);
  } catch (error) {
    if (error instanceof GuardrailError) return json({ error: error.message }, 400);
    throw error;
  }

  const buildId = `fct_${crypto.randomUUID().slice(0, 8)}`;

  const agent = await getBuildAgent(env, buildId);
  await agent.create({ buildId, brief });
  await agent.start({ buildId, brief });

  const index = await getIndexAgent(env);
  await index.put({
    buildId,
    request: text,
    project,
    policy,
    status: "intake",
    model: `${target.provider}:${target.model}`,
    startedAt: Date.now(),
  });

  return json(
    {
      buildId,
      provider: target.provider,
      model: target.model,
      policy,
      project,
      deployTarget: brief.deployTarget,
    },
    202,
  );
}
