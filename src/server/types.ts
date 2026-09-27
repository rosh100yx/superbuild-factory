export type StageId = "S1" | "S2" | "S3" | "S4" | "S5";

export const STAGE_IDS: StageId[] = ["S1", "S2", "S3", "S4", "S5"];

export const STAGE_LABELS: Record<StageId, string> = {
  S1: "brief",
  S2: "sections",
  S3: "build",
  S4: "taste",
  S5: "deploy",
};

export type StageStatus =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "awaiting-approval";

export type StageRecord = {
  status: StageStatus;
  note?: string;
  ms?: number;
};

export type BuildStatus =
  | "intake"
  | "running"
  | "awaiting-approval"
  | "shipped"
  | "failed"
  | "rejected"
  | "blocked";

export type ModelPolicy = "free" | "zdr-paid";

export type DeployTarget = "cloudflare-pages";

export type GeneratedFile = { path: string; content: string };

export type BuildBrief = {
  request: string;
  project: string;
  policy: ModelPolicy;
  deployTarget: DeployTarget;
};

export type BuildParams = { buildId: string; brief: BuildBrief };

export type BuildState = {
  buildId: string;
  request: string;
  project: string;
  policy: ModelPolicy;
  status: BuildStatus;
  stages: Record<StageId, StageRecord>;
  taste?: {
    verdict: "SHIP" | "FIX FIRST";
    errors: number;
    warnings: number;
    findings: Array<{ rule: string; severity: string; file: string; line?: number; message: string }>;
  };
  artifacts: {
    spec?: string;
    sectionMap?: string;
    files?: string[];
    tasteReport?: string;
  };
  deploy: {
    url?: string;
    project?: string;
    preview?: string;
    at?: number;
  };
  model?: string;
  workflowId?: string;
  error?: string;
  startedAt: number;
  endedAt?: number;
};

export function initialStages(): Record<StageId, StageRecord> {
  return {
    S1: { status: "pending" },
    S2: { status: "pending" },
    S3: { status: "pending" },
    S4: { status: "pending" },
    S5: { status: "pending" },
  };
}

export function initialState(
  buildId: string,
  brief: BuildBrief,
  model: string,
): BuildState {
  return {
    buildId,
    request: brief.request,
    project: brief.project,
    policy: brief.policy,
    status: "intake",
    stages: initialStages(),
    artifacts: {},
    deploy: {},
    model,
    startedAt: Date.now(),
  };
}

/**
 * A build that errored must not leave a stage spinning. Without this, the console
 * shows `failed` next to a stage still marked `running` — a rail that lies about a
 * run that already stopped.
 */
export function failActiveStage(
  stages: Record<StageId, StageRecord>,
  reason: string,
): Record<StageId, StageRecord> {
  const next = { ...stages };
  const active = STAGE_IDS.find(
    (id) => next[id].status === "running" || next[id].status === "awaiting-approval",
  );
  if (active) {
    next[active] = { ...next[active], status: "failed", note: reason.slice(0, 160) };
  }
  return next;
}
