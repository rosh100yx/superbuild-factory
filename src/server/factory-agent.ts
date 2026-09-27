import { Agent, callable } from "agents";
import type { Connection } from "agents";

import type { Env } from "./env";
import type { BuildBrief, BuildState } from "./types";
import { failActiveStage, initialState, initialStages } from "./types";
import { resolveModel } from "./models";
import { getIndexAgent } from "./agents";

export type BuildSummary = {
  buildId: string;
  request: string;
  project: string;
  policy: string;
  status: string;
  model?: string;
  url?: string;
  startedAt: number;
  endedAt?: number;
};

export type IndexState = { builds: BuildSummary[] };

const PLACEHOLDER: BuildState = {
  buildId: "",
  request: "",
  project: "",
  policy: "free",
  status: "intake",
  stages: initialStages(),
  artifacts: {},
  deploy: {},
  startedAt: 0,
};

/**
 * One Durable Object per build. The state IS the build: stages, artifacts, deploy
 * result. Because it is SQLite-backed and broadcast on change, the console never
 * has to poll and the build survives an eviction mid-flight.
 */
export class FactoryAgent extends Agent<Env, BuildState> {
  initialState: BuildState = PLACEHOLDER;

  @callable()
  async create(params: { buildId: string; brief: BuildBrief }): Promise<{ buildId: string; model: string }> {
    const model = resolveModel(params.brief.project, params.brief.policy, this.env);
    this.setState(initialState(params.buildId, params.brief, model));
    return { buildId: params.buildId, model };
  }

  @callable()
  async start(params: { buildId: string; brief: BuildBrief }): Promise<{ workflowId: string }> {
    const workflowId = await this.runWorkflow("BUILD_WORKFLOW", {
      buildId: params.buildId,
      brief: params.brief,
    });
    this.setState({ ...this.state, workflowId });
    await this.syncIndex();
    return { workflowId };
  }

  @callable()
  async approve(): Promise<void> {
    const id = this.state.workflowId;
    if (!id) throw new Error("This build has no workflow to approve.");
    await this.approveWorkflow(id, { reason: "approved from console" });
  }

  @callable()
  async reject(reason?: string): Promise<void> {
    const id = this.state.workflowId;
    if (!id) throw new Error("This build has no workflow to reject.");
    await this.rejectWorkflow(id, { reason: reason ?? "rejected from console" });
  }

  validateStateChange(next: BuildState, _source: Connection | "server"): void {
    if (next.status === "shipped" && !next.deploy?.url) {
      throw new Error("Illegal state: cannot be `shipped` without a deploy URL.");
    }
  }

  async onWorkflowProgress(
    _workflowName: string,
    _workflowId: string,
    progress: unknown,
  ): Promise<void> {
    this.broadcast(JSON.stringify({ type: "progress", progress }));
  }

  async onWorkflowComplete(
    _workflowName: string,
    _workflowId: string,
    result?: unknown,
  ): Promise<void> {
    this.broadcast(JSON.stringify({ type: "complete", result }));
    await this.syncIndex();
  }

  async onWorkflowError(
    _workflowName: string,
    _workflowId: string,
    error: string,
  ): Promise<void> {
    // A failed build must not leave a stage spinning.
    const stages = failActiveStage(this.state.stages, error);
    this.setState({ ...this.state, stages, status: "failed", error, endedAt: Date.now() });
    await this.syncIndex();
  }

  private async syncIndex(): Promise<void> {
    if (!this.state.buildId) return;
    const index = await getIndexAgent(this.env);
    await index.put({
      buildId: this.state.buildId,
      request: this.state.request,
      project: this.state.project,
      policy: this.state.policy,
      status: this.state.status,
      model: this.state.model,
      url: this.state.deploy?.url,
      startedAt: this.state.startedAt,
      endedAt: this.state.endedAt,
    });
  }
}

/**
 * A single registry instance ("index") so the ledger is one read instead of a scan
 * across every build DO.
 */
export class FactoryIndex extends Agent<Env, IndexState> {
  initialState: IndexState = { builds: [] };

  @callable()
  async put(summary: BuildSummary): Promise<void> {
    const rest = this.state.builds.filter((b) => b.buildId !== summary.buildId);
    this.setState({ builds: [summary, ...rest].slice(0, 200) });
  }

  @callable()
  async list(): Promise<BuildSummary[]> {
    return this.state.builds;
  }
}
