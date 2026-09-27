import { useCallback, useEffect, useState } from "react";

import { api } from "../api";
import type { BuildSummary } from "../../server/factory-agent";

export function Ledger({ onOpen }: { onOpen: (buildId: string) => void }) {
  const [builds, setBuilds] = useState<BuildSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ builds: BuildSummary[] }>("/api/builds");
      setBuilds(data.builds);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <h1>Ledger</h1>
      <p className="sub">Every build, its policy, and whether it shipped.</p>

      <div className="card">
        <div className="row-flex" style={{ marginBottom: 12 }}>
          <button className="small" onClick={load}>
            refresh
          </button>
          {error && <span className="err-text">{error}</span>}
        </div>

        {builds === null ? (
          <p className="empty">loading…</p>
        ) : builds.length === 0 ? (
          <p className="empty">no builds yet — describe what you want shipped</p>
        ) : (
          <ul className="ledger">
            {builds.map((build) => (
              <li key={build.buildId}>
                <button className="small mono" onClick={() => onOpen(build.buildId)}>
                  {build.buildId}
                </button>
                <span className="req">{build.request}</span>
                <span className="row-flex">
                  <span className="pill">{build.policy}</span>
                  <span
                    className={`pill ${
                      build.status === "shipped" ? "ok" : build.status === "failed" ? "err" : ""
                    }`}
                  >
                    {build.status}
                  </span>
                  {build.url && (
                    <a href={build.url} target="_blank" rel="noreferrer" className="smalltext">
                      live
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
