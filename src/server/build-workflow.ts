import { AgentWorkflow, WorkflowRejectedError } from "agents/workflows";
import type { AgentWorkflowEvent, AgentWorkflowStep } from "agents/workflows";

import type { FactoryAgent } from "./factory-agent";
import type { Env } from "./env";
import type { BuildParams, BuildState, StageId, StageRecord } from "./types";
import { initialStages } from "./types";
import { resolveModel } from "./models";
import { s1Brief } from "./stages/s1-brief";
import { s2Sections, parsePrimaryCta } from "./stages/s2-sections";
import { s3Build } from "./stages/s3-build";
import { s4Taste } from "./stages/s4-taste";
import { s5Deploy } from "./stages/s5-deploy";

export type BuildProgress = {
  step?: StageId;
  status?: "pending" | "running" | "complete" | "error";
  message?: string;
  percent?: number;
};

export type BuildResult = {
  verdict: "SHIPPED" | "FIX FIRST" | "REJECTED";
  url?: string;
};

const RETRY = {
  retries: { limit: 3, delay: "2 seconds", backoff: "exponential" },
} as const;

const PERCENT: Record<StageId, number> = { S1: 0.15, S2: 0.3, S3: 0.6, S4: 0.8, S5: 1 };

/**
 * The durable spine. Every stage is a `step.do`, so a cold start, an eviction, or a
 * provider wobble resumes rather than restarting — the thing the file-based bus could
 * never do.
 *
 * Two preconditions gate the deploy, and both are structural rather than conventional:
 * a SHIP verdict from the deterministic lint, and an approval event from the operator.
 */
export class BuildWorkflow extends AgentWorkflow<FactoryAgent, BuildParams, BuildProgress, Env> {
  async run(
    event: AgentWorkflowEvent<BuildParams>,
    step: AgentWorkflowStep,
  ): Promise<BuildResult> {
    const env = this.env;
    const { buildId, brief } = event.payload;

    // Throws GuardrailError if a client project is paired with a free model.
    const model = resolveModel(brief.project, brief.policy, env);
    const apiKey = env.OPENROUTER_API_KEY;

    const stages: Record<StageId, StageRecord> = initialStages();
    const artifacts: BuildState["artifacts"] = {};

    const record = async (id: StageId, patch: Partial<StageRecord>) => {
      stages[id] = { ...stages[id], ...patch };
      await step.mergeAgentState({ stages });
    };

    const say = async (id: StageId, status: BuildProgress["status"], message: string) => {
      await this.reportProgress({ step: id, status, message, percent: PERCENT[id] });
    };

    await step.mergeAgentState({ status: "running", model });

    // ---- S1 brief -----------------------------------------------------------
    await record("S1", { status: "running" });
    await say("S1", "running", "drafting the specification");
    const s1 = await step.do("s1-brief", RETRY, async () => {
      const t0 = Date.now();
      const out = await s1Brief({
        request: brief.request,
        project: brief.project,
        model,
        apiKey,
      });
      return { out, ms: Date.now() - t0 };
    });
    const specKey = `builds/${buildId}/spec.md`;
    await step.do("s1-persist", async () => {
      await env.ARTIFACTS.put(specKey, s1.out.spec);
    });
    artifacts.spec = specKey;
    await record("S1", { status: "done", note: `${s1.out.beats} beats`, ms: s1.ms });

    // ---- S2 sections --------------------------------------------------------
    await record("S2", { status: "running" });
    await say("S2", "running", "mapping narrative beats to sections");
    const s2 = await step.do("s2-sections", RETRY, async () => {
      const t0 = Date.now();
      const out = await s2Sections({ spec: s1.out.spec, model, apiKey });
      return { out, ms: Date.now() - t0 };
    });
    const sectionMapKey = `builds/${buildId}/section-map.md`;
    await step.do("s2-persist", async () => {
      await env.ARTIFACTS.put(sectionMapKey, s2.out.sectionMap);
    });
    artifacts.sectionMap = sectionMapKey;
    const cta = parsePrimaryCta(s2.out.sectionMap) ?? undefined;
    await record("S2", {
      status: "done",
      note: `${s2.out.sectionCount} sections`,
      ms: s2.ms,
    });

    // ---- S3 build -----------------------------------------------------------
    await record("S3", { status: "running" });
    await say("S3", "running", "generating the site files");
    const s3 = await step.do("s3-build", RETRY, async () => {
      const t0 = Date.now();
      const out = await s3Build({
        spec: s1.out.spec,
        sectionMap: s2.out.sectionMap,
        model,
        apiKey,
      });
      return { out, ms: Date.now() - t0 };
    });
    await step.do("s3-persist", async () => {
      for (const file of s3.out.files) {
        await env.ARTIFACTS.put(`builds/${buildId}/site/${file.path}`, file.content, {
          httpMetadata: { contentType: "text/plain; charset=utf-8" },
        });
      }
    });
    artifacts.files = s3.out.files.map((f) => `builds/${buildId}/site/${f.path}`);
    await record("S3", {
      status: "done",
      note: `${s3.out.files.length} files`,
      ms: s3.ms,
    });

    // ---- S4 taste (deterministic, no model) ---------------------------------
    await record("S4", { status: "running" });
    await say("S4", "running", "linting tokens, structure and copy");
    const s4 = await step.do("s4-taste", async () => {
      const t0 = Date.now();
      const out = s4Taste(s3.out.files);
      return { out, ms: Date.now() - t0 };
    });
    const tasteKey = `builds/${buildId}/taste-review.md`;
    await step.do("s4-persist", async () => {
      await env.ARTIFACTS.put(tasteKey, s4.out.markdown);
    });
    artifacts.tasteReport = tasteKey;
    await record("S4", {
      status: "done",
      note: `${s4.out.report.verdict} · ${s4.out.report.errors} error(s)`,
      ms: s4.ms,
    });

    await step.mergeAgentState({
      artifacts,
      taste: {
        verdict: s4.out.report.verdict,
        errors: s4.out.report.errors,
        warnings: s4.out.report.warnings,
        findings: s4.out.report.findings.slice(0, 25),
      },
    });

    // ---- gate: no SHIP verdict, no deploy -----------------------------------
    if (s4.out.report.verdict !== "SHIP") {
      await record("S5", { status: "pending", note: "blocked by taste review" });
      await step.mergeAgentState({
        status: "blocked",
        error: `${s4.out.report.errors} lint error(s) — see taste review`,
        endedAt: Date.now(),
      });
      await step.reportComplete({ verdict: "FIX FIRST" } satisfies BuildResult);
      return { verdict: "FIX FIRST" };
    }

    // ---- gate: no approval event, no deploy ---------------------------------
    await record("S5", { status: "awaiting-approval", note: "awaiting approval" });
    await step.mergeAgentState({ status: "awaiting-approval" });
    await say("S5", "pending", "awaiting your approval to deploy");
    this.broadcastToClients({ type: "awaiting-approval", buildId });

    try {
      await this.waitForApproval<{ approved: boolean }>(step, { timeout: "7 days" });
    } catch (error) {
      if (error instanceof WorkflowRejectedError) {
        await step.mergeAgentState({ status: "rejected", endedAt: Date.now() });
        await step.reportComplete({ verdict: "REJECTED" } satisfies BuildResult);
        return { verdict: "REJECTED" };
      }
      throw error;
    }

    // ---- S5 deploy ----------------------------------------------------------
    await record("S5", { status: "running", note: "deploying" });
    await say("S5", "running", "uploading to Cloudflare Pages");
    const s5 = await step.do("s5-deploy", RETRY, async () => {
      const t0 = Date.now();
      const result = await s5Deploy({
        pages: {
          accountId: env.CF_ACCOUNT_ID,
          apiToken: env.CF_API_TOKEN,
          project: env.PAGES_PROJECT,
        },
        files: s3.out.files,
        branch: buildId,
        mustContain: cta,
      });
      return { result, ms: Date.now() - t0 };
    });

    await record("S5", { status: "done", note: "live", ms: s5.ms });
    await step.mergeAgentState({
      status: "shipped",
      deploy: {
        url: s5.result.url,
        preview: s5.result.preview,
        project: env.PAGES_PROJECT,
        at: Date.now(),
      },
      endedAt: Date.now(),
    });
    await step.reportComplete({
      verdict: "SHIPPED",
      url: s5.result.url,
    } satisfies BuildResult);
    this.broadcastToClients({ type: "shipped", buildId, url: s5.result.url });

    return { verdict: "SHIPPED", url: s5.result.url };
  }
}
