import { useCallback, useEffect, useState } from "react";
import { useAgent } from "agents/react";

import { artifact, getToken } from "../api";
import { StageRail } from "../components/StageRail";
import { TasteReport } from "../components/TasteReport";
import { ApprovalGate } from "../components/ApprovalGate";
import type { BuildState, StageId } from "../../server/types";

const STAGE_ARTIFACT: Partial<Record<StageId, keyof BuildState["artifacts"]>> = {
  S1: "spec",
  S2: "sectionMap",
  S3: "files",
  S4: "tasteReport",
};

export function BuildDetail({ buildId, onOpenLedger }: { buildId: string; onOpenLedger: () => void }) {
  const agent = useAgent<BuildState>({
    agent: "FactoryAgent",
    name: buildId,
    query: async () => ({ token: getToken() }),
  });

  const state = agent.state;
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [open, setOpen] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      try {
        const parsed = JSON.parse(String((event as MessageEvent).data));
        if (parsed?.type === "progress" && parsed.progress?.message) {
          setActivity(parsed.progress.message);
        }
        if (parsed?.type === "awaiting-approval") setActivity("awaiting your approval");
        if (parsed?.type === "shipped") setActivity(`shipped ${parsed.url ?? ""}`);
      } catch {
        // RPC frames and non-JSON traffic are not ours to render.
      }
    };
    const target = agent as unknown as EventTarget;
    target.addEventListener("message", handler);
    return () => target.removeEventListener("message", handler);
  }, [agent]);

  const viewArtifact = useCallback(
    async (title: string, key?: string) => {
      if (!key) return;
      setOpen({ title, body: "loading…" });
      try {
        setOpen({ title, body: await artifact(key) });
      } catch (error) {
        setOpen({ title, body: `failed: ${(error as Error).message}` });
      }
    },
    [],
  );

  const act = useCallback(async (method: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await agent.call(method);
    } catch (error) {
      setActionError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }, [agent]);

  const openStage = useCallback(
    (stage: StageId) => {
      if (!state) return;
      const field = STAGE_ARTIFACT[stage];
      if (!field) return;
      const value = state.artifacts[field];
      if (Array.isArray(value)) {
        for (const key of value) viewArtifact(key ?? "", key);
        return;
      }
      viewArtifact(`${stage} · ${field}`, value);
    },
    [state, viewArtifact],
  );

  if (!state) {
    return (
      <>
        <h1>
          BUILD <span className="id mono">{buildId}</span>
        </h1>
        <p className="sub">connecting to the build agent…</p>
      </>
    );
  }

  const hasArtifact = (stage: StageId) => {
    const field = STAGE_ARTIFACT[stage];
    return Boolean(field && state.artifacts[field]);
  };

  return (
    <>
      <h1 className="build-head">
        BUILD <span className="id">{state.buildId || buildId}</span>
        <span className={`pill ${state.status === "shipped" ? "ok" : state.status === "failed" ? "err" : "live"}`}>
          {state.status}
        </span>
      </h1>
      <p className="sub mono">{state.request}</p>

      <div className="row-flex" style={{ marginBottom: 18 }}>
        <span className="pill">project: {state.project}</span>
        <span className="pill">policy: {state.policy}</span>
        {state.model && <span className="pill">model: {state.model}</span>}
        {state.workflowId && <span className="pill">wf: {state.workflowId.slice(0, 12)}</span>}
      </div>

      {state.error && (
        <p className="err-text" style={{ marginBottom: 14 }}>
          {state.error}
        </p>
      )}

      <div className="card">
        <StageRail stages={state.stages} onView={openStage} hasArtifact={hasArtifact} />
      </div>

      {state.taste && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>taste review</h2>
          <TasteReport taste={state.taste} />
        </div>
      )}

      <ApprovalGate
        status={state.status}
        busy={busy}
        error={actionError}
        onApprove={() => act("approve")}
        onReject={() => act("reject")}
      />

      {state.deploy.url && (
        <div className="card ship">
          <h2 style={{ marginTop: 0 }}>ship result</h2>
          <div className="row-flex">
            <a href={state.deploy.url} target="_blank" rel="noreferrer">
              {state.deploy.url}
            </a>
            <span className="pill ok">live</span>
          </div>
          <p className="smalltext muted" style={{ marginBottom: 0 }}>
            project {state.deploy.project}
            {state.deploy.preview && state.deploy.preview !== state.deploy.url
              ? ` · preview ${state.deploy.preview}`
              : ""}
          </p>
        </div>
      )}

      {activity && (
        <p className="smalltext muted" style={{ marginTop: 14 }}>
          activity: {activity}
        </p>
      )}

      <div className="row-flex" style={{ marginTop: 18 }}>
        <button onClick={onOpenLedger}>open ledger</button>
        <button
          onClick={() => {
            window.location.reload();
          }}
        >
          reconnect
        </button>
      </div>

      {open && (
        <div className="card" style={{ marginTop: 22 }}>
          <div className="row-flex">
            <h2 style={{ margin: 0 }}>{open.title}</h2>
            <button className="small" style={{ marginLeft: "auto" }} onClick={() => setOpen(null)}>
              close
            </button>
          </div>
          <pre className="artifact">{open.body}</pre>
        </div>
      )}
    </>
  );
}
