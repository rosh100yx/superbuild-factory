# AGENTS.md — factory

Software factory: **a business request goes in, a live URL comes out**, with a human approval gate in
the middle. Cloudflare Agents SDK (Durable Object + `useAgent`) + Cloudflare Workflows (durable steps).

## Shape

```
Worker  ->  /agents/factory/<buildId>   FactoryAgent (DO, state = the build)
                ->  BuildWorkflow       S1 brief -> S2 sections -> S3 build -> S4 taste -> gate -> S5 deploy
                        ->  Pages direct upload -> live URL -> verify 200
React   ->  useAgent()   live stage rail, artifacts, approve/reject
```

## Commands

```bash
npm run dev        # vite dev (worker + client)
npm run check      # tsc --noEmit
npm test           # vitest
npm run build      # client -> dist/client
npm run dry-run    # wrangler deploy --dry-run (validates bindings + syntax)
npm run deploy     # build + wrangler deploy
```

## Secrets (never commit; `.dev.vars` is gitignored)

```bash
npx wrangler secret put CF_API_TOKEN      # Pages:Edit
npx wrangler secret put CF_ACCOUNT_ID
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put FACTORY_TOKEN     # client auth
```

## Guardrails (non-negotiable)

- **Client code never touches a free model.** `src/server/models.ts` throws if a client slug is paired with
  the `free` policy. Client slugs: vanmossel, itfamily, denovolabs, aidept, xim.
- **No deploy without a SHIP verdict + an approval event.** Enforced inside `BuildWorkflow`, not by convention.
- **Free tier only.** DOs, Workflows, R2, Pages. No Containers/Sandbox.
- **Blueprint before code.** `.flow/0001-factory-mvp/BLUEPRINT.md`.

## Do not

- Do not enable `experimentalDecorators` in tsconfig — it breaks `@callable`.
- Never edit an existing DO migration tag — add a new one.

## Gotchas (each one verified the hard way, 2026-09-27)

- **Run `npm run dev`, never `wrangler dev`.** The Vite plugin writes a redirected
  `dist/factory/wrangler.json` whose `main` is the last built bundle, so `wrangler dev` silently serves
  STALE CODE while looking like it works. This cost real debugging time — a route I had just added
  appeared to not exist.
- **Vite binds IPv6 `[::1]`.** `curl 127.0.0.1:PORT` gets connection refused; use `localhost:PORT`.
- **This shell exports `NODE_ENV=production`.** `npm install` therefore *omits every devDependency* — it
  silently pruned typescript, vitest and wrangler mid-build. Always `npm install --include=dev` here.
- **Killing a background dev server needs the whole tree.** The tracked PID is a `/bin/sh -c` wrapper;
  killing it orphans `npm exec wrangler` (reparented to PID 1) which keeps respawning `workerd` and
  re-grabbing the port. Kill by command pattern instead.
- **`agents/vite` default-exports its plugin** in `agents@0.24`; the docs show a named export. Use
  `import agents from "agents/vite"` and spread the returned array.
- **`WorkflowSleepDuration` is a template literal type** — `"7 days"` works, `"7d"` does not.
- **`step.do` config must be `as const`** for the `const C extends WorkflowStepConfig` inference, or the
  callback result degrades to a union and every property access fails to type.
- **TypeScript 7 removed `baseUrl`** — `paths` resolves relative to the tsconfig.
- **Do not install `@cloudflare/workers-types`** alongside the generated `worker-configuration.d.ts`.
- **`mergeAgentState` is a shallow merge** — send the whole stage map, never one stage.
- **`Agent.broadcast` takes a string** (`JSON.stringify` yourself); `AgentWorkflow.broadcastToClients`
  stringifies for you.
- **`wrangler types` narrows a var to its literal value**, so comparing it to another string needs an
  explicit widening (`const x: string = env.VAR`) or TS reports "no overlap".
- Re-run `npx wrangler types` after ANY `wrangler.jsonc` change, or new bindings will not typecheck.
