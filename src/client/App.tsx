import { useCallback, useEffect, useState } from "react";

import { api, getToken, setToken } from "./api";
import { NewBuild } from "./routes/NewBuild";
import { BuildDetail } from "./routes/BuildDetail";
import { Ledger } from "./routes/Ledger";

type View = { name: "new" } | { name: "build"; id: string } | { name: "ledger" };

function parseLocation(): View {
  const path = window.location.pathname;
  const build = path.match(/^\/build\/([^/]+)/);
  if (build) return { name: "build", id: decodeURIComponent(build[1]) };
  if (path.startsWith("/ledger")) return { name: "ledger" };
  return { name: "new" };
}

function pathFor(view: View): string {
  if (view.name === "build") return `/build/${view.id}`;
  if (view.name === "ledger") return "/ledger";
  return "/";
}

type Health = { ok: boolean; freeModel?: string; zdrModel?: string; pagesProject?: string };

export function App() {
  const [view, setView] = useState<View>(() => parseLocation());
  const [token, setTokenValue] = useState(getToken());
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    const onPop = () => setView(parseLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    api<Health>("/api/health")
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));
  }, [token]);

  const go = useCallback((next: View) => {
    window.history.pushState({}, "", pathFor(next));
    setView(next);
  }, []);

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          FACTORY<span className="dim"> / request in, deployed app out</span>
        </div>
        <nav>
          <button className={view.name === "new" ? "on" : ""} onClick={() => go({ name: "new" })}>
            new build
          </button>
          <button className={view.name === "ledger" ? "on" : ""} onClick={() => go({ name: "ledger" })}>
            ledger
          </button>
        </nav>
        <div className="top-right">
          <input
            placeholder="paste token + Enter"
            aria-label="Factory token"
            title="FACTORY_TOKEN, stored in localStorage"
            defaultValue={token}
            style={{ width: 180 }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              const value = (event.target as HTMLInputElement).value.trim();
              setToken(value);
              setTokenValue(value);
            }}
          />
          <span className={`pill ${token ? "ok" : "err"}`}>{token ? "token set" : "no token"}</span>
          <span className={`pill ${health?.ok ? "ok" : "err"}`}>
            {health?.ok ? health.freeModel : "offline"}
          </span>
        </div>
      </header>

      <main>
        {view.name === "new" && <NewBuild onCreated={(id) => go({ name: "build", id })} />}
        {view.name === "build" && (
          <BuildDetail buildId={view.id} onOpenLedger={() => go({ name: "ledger" })} />
        )}
        {view.name === "ledger" && <Ledger onOpen={(id) => go({ name: "build", id })} />}
      </main>
    </div>
  );
}
