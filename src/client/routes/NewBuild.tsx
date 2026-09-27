import { useState } from "react";

import { api } from "../api";
import type { ModelPolicy } from "../../server/types";

const EXAMPLE = `A landing page for superbuild.agency's Build-Scale training.
Audience: design engineers at agencies who already use AI tools but ship sloppy work.
Goal: get 12 qualified applications for the next cohort.
Beats: the problem (AI slop), who it's for, what changes in 4 weeks, proof, the offer, how to apply.`;

export function NewBuild({ onCreated }: { onCreated: (buildId: string) => void }) {
  const [request, setRequest] = useState("");
  const [project, setProject] = useState("superbuild");
  const [policy, setPolicy] = useState<ModelPolicy>("free");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ buildId: string }>("/api/builds", {
        method: "POST",
        body: JSON.stringify({ request, project, policy }),
      });
      onCreated(result.buildId);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <h1>New build</h1>
      <p className="sub">
        Describe the outcome. The factory writes the spec, maps the sections, builds the files, lints
        them, then stops and waits for you before anything goes live.
      </p>

      <form className="card" onSubmit={submit}>
        <label htmlFor="request">Request</label>
        <textarea
          id="request"
          value={request}
          placeholder={EXAMPLE}
          onChange={(event) => setRequest(event.target.value)}
        />
        <p className="smalltext muted" style={{ marginTop: 8 }}>
          {request.trim().length} / 20 characters minimum
        </p>

        <div className="grid2" style={{ marginTop: 16 }}>
          <div>
            <label htmlFor="project">Project</label>
            <input
              id="project"
              value={project}
              onChange={(event) => setProject(event.target.value)}
            />
            <p className="smalltext muted" style={{ marginTop: 8 }}>
              Client slugs (vanmossel, itfamily, denovolabs, aidept, xim) force a paid ZDR model.
            </p>
          </div>
          <div>
            <label htmlFor="policy">Model policy</label>
            <select
              id="policy"
              value={policy}
              onChange={(event) => setPolicy(event.target.value as ModelPolicy)}
            >
              <option value="free">free — own work only</option>
              <option value="zdr-paid">zdr-paid — required for client code</option>
            </select>
          </div>
        </div>

        <div className="row-flex" style={{ marginTop: 18 }}>
          <button
            className="primary"
            type="submit"
            disabled={busy || request.trim().length < 20}
          >
            {busy ? "starting…" : "START BUILD"}
          </button>
          <button type="button" onClick={() => setRequest(EXAMPLE)}>
            use example
          </button>
        </div>

        {error && (
          <p className="err-text" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}
      </form>
    </>
  );
}
