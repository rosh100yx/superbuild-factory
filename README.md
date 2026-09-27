# factory

**A business request goes in, a live URL comes out.**

The software factory. It turns a plain-English request into a built, linted, and deployed page, with a
human approval gate in the middle and a durable audit trail behind it.

This is the runtime that FORGE was missing: durable state, a clock, and a front door.

## The flow

```
POST /api/builds  ->  FactoryAgent (Durable Object, state = the build)
                        |
                        +-- BuildWorkflow  (durable, retried steps)
                        |     S1 brief     request  -> spec
                        |     S2 sections  spec     -> section map
                        |     S3 build     map      -> files -> R2
                        |     S4 taste     deterministic lint -> SHIP | FIX FIRST
                        |     gate         waitForApproval (7 days)
                        |     S5 deploy    Pages upload -> live URL -> verify 200
                        |
React console  <-  useAgent()  live stage rail, artifacts, approve/reject
```

Two things gate the deploy, and both are structural rather than conventional:

1. **A SHIP verdict** from the deterministic lint (no model in the loop, reproducible).
2. **An approval event** from you. Nothing reaches production without it.

## Commands

```bash
npm run dev        # vite dev server (worker + console together)
npm run check      # tsc --noEmit
npm test           # vitest — 50 tests over the pure modules
npm run build      # client -> dist/client
npm run dry-run    # wrangler deploy --dry-run, validates every binding
npm run deploy     # build + wrangler deploy
npx wrangler types # regenerate worker-configuration.d.ts after editing wrangler.jsonc
```

## First run

```bash
cp .env.example .dev.vars          # then fill it in
npm install --include=dev
npx wrangler r2 bucket create factory-artifacts
npm run dev
```

Open the dev URL with `?token=<FACTORY_TOKEN>` once; it is stored in `localStorage` from then on.

## Secrets

Never committed. `.dev.vars` is gitignored; production values go through `wrangler secret put`.

| Secret | Purpose |
| --- | --- |
| `CF_API_TOKEN` | Cloudflare API token with **Pages:Edit** |
| `CF_ACCOUNT_ID` | account that owns the Pages project |
| `OPENROUTER_API_KEY` | model calls (free models for own work, paid ZDR for client) |
| `FACTORY_TOKEN` | console + API auth. **Unset means local-only access** |

## Guardrails

- **Client code never touches a free model.** `src/server/models.ts` throws if a client slug
  (`vanmossel`, `itfamily`, `denovolabs`, `aidept`, `xim`) is paired with the `free` policy. This is an
  assertion, not a note in a document.
- **No deploy without a SHIP verdict and an approval event**, enforced inside `BuildWorkflow`.
- **Free tier only.** Durable Objects, Workflows, R2, Pages. No Containers — Sandbox needs Docker locally
  and the Workers Paid plan, so the model writes files directly instead.
- **`FACTORY_TOKEN` must be set in production.** Unset is local-dev-only by design.

## Gotchas found while building this (all verified)

- **This shell exports `NODE_ENV=production`**, which makes `npm install` *omit every devDependency* — it
  silently pruned `typescript`, `vitest`, and `wrangler` mid-session. Always use
  `npm install --include=dev` here, or unset `NODE_ENV`.
- **`agents/vite` default-exports its plugin** in `agents@0.24`. The published docs show a named export;
  that is wrong for this version. Import is `import agents from "agents/vite"`.
- **`WorkflowSleepDuration` is a template literal type** — `"7 days"` is valid, `"7d"` is not.
- **TypeScript 7 removed `baseUrl`** — `paths` is resolved relative to the tsconfig instead.
- **`wrangler types` supersedes `@cloudflare/workers-types`** — that package should not be installed
  alongside the generated runtime types.

## Layout

```
src/server/
  index.ts            worker entry: routing, auth, /api/builds, /api/artifact
  factory-agent.ts    FactoryAgent (per build) + FactoryIndex (registry)
  build-workflow.ts   the durable pipeline and both deploy gates
  models.ts           model policy guardrail + provider call
  lint.ts             deterministic taste lint (pure)
  pages-deploy.ts     Pages direct upload -> poll -> live verify (pure-ish, injectable fetch)
  stages/             s1..s5, one file per stage
src/client/           React console: stage rail, taste report, approval gate, ledger
.flow/0001-factory-mvp/BLUEPRINT.md   the flow-first blueprint this was built from
```

## Not built yet (deliberately)

Sandbox-isolated builds, the visual render-judge, D1 cross-build analytics, multi-page builds, real
accounts. See `.flow/0001-factory-mvp/BLUEPRINT.md` § 1.7 for why each was cut.
