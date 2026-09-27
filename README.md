# factory

**A business request goes in, a live URL comes out.**

A software factory built on Cloudflare: a durable agent turns plain English into a built, linted,
published page — with a human approval gate in the middle and an audit trail behind it.

Two things gate the deploy, and both are structural rather than conventional:

1. **A SHIP verdict** from a deterministic lint — no model in the loop, so the verdict is reproducible.
2. **An approval event** from a human. Nothing publishes without it.

## Use it as a template

```bash
npm create cloudflare@latest -- --template=rosh100yx/superbuild-factory
```

Or hit **Use this template** on GitHub. Then jump to the 60-second quickstart below — it needs no keys.

---

## Run it in 60 seconds, with no API key

```bash
npm install --include=dev
npm run dev
```

Then open the URL Vite prints, with the token appended:

```
http://localhost:5173/?token=local-dev-token
```

Describe what you want, hit **START BUILD**, watch the stages run, and press **APPROVE DEPLOY**.

There is no key to find and nothing to sign up for. Provider resolution falls back to the built-in
`mock` provider, which returns fixtures — but **everything else is real**: the durable workflow, the
deterministic lint, the approval gate, the publish, and the served URL at `/sites/<buildId>/`.

The fixtures are not throwaway. They are asserted to **pass the lint**, so they double as a live check
that the lint is satisfiable rather than impossible.

## Then point it at a real model

Set one key. The provider is detected automatically.

```bash
# .dev.vars
OPENAI_API_KEY=sk-...          # -> provider "openai"
# OPENROUTER_API_KEY=...       # -> provider "openrouter"
```

```bash
npm run dev
```

Precedence, most specific first:

| # | Setting | Notes |
|---|---|---|
| 1 | `FREE_PROVIDER` / `ZDR_PROVIDER` | per policy, so one build can differ from the next |
| 2 | `MODEL_PROVIDER` | `openai` \| `openrouter` \| `mock` |
| 3 | a key that is actually present | `OPENAI_API_KEY`, then `OPENROUTER_API_KEY` |
| 4 | `mock` | always works, needs nothing |

Model ids are **provider-specific** — `vendor/model` is an OpenRouter id and is not valid on OpenAI.
Defaults travel with the provider, so switching never leaves a dangling id behind.

## Deploy targets

| Target | What it needs | URL |
|---|---|---|
| `factory-r2` (default) | nothing extra | `/sites/<buildId>/` on the factory's own origin |
| `cloudflare-pages` | `CF_API_TOKEN` (Pages:Edit) + `CF_ACCOUNT_ID` | `<hash>.<project>.pages.dev` |

`factory-r2` exists so a fork reaches a live URL with **one credential — the model key**. Pages needs a
second, scoped token, which is why it is not the default.

## Commands

```bash
npm run dev        # vite dev server (worker + console together) — the correct way to run this
npm run check      # tsc --noEmit
npm test           # vitest
npm run build      # client -> dist/client
npm run dry-run    # wrangler deploy --dry-run, validates every binding
npm run deploy     # build + wrangler deploy
npx wrangler types # regenerate worker-configuration.d.ts after editing wrangler.jsonc
```

## Secrets

Never committed. `.dev.vars` is gitignored; production uses `wrangler secret put`.

| Secret | Needed for |
| --- | --- |
| `OPENAI_API_KEY` / `OPENROUTER_API_KEY` | a real model. Omit both to run on fixtures |
| `FACTORY_TOKEN` | console + API auth. **Unset means local-only access** |
| `CF_API_TOKEN`, `CF_ACCOUNT_ID` | only the `cloudflare-pages` target |

## Guardrails

- **Client code never touches a free model.** `src/server/models.ts` throws when a client slug
  (`vanmossel`, `itfamily`, `denovolabs`, `aidept`, `xim`) is paired with the `free` policy. An
  assertion, not a note in a document.
- **No publish without a SHIP verdict and an approval event**, enforced inside `BuildWorkflow`.
- **Free tier only.** Durable Objects, Workflows, R2, static assets. No Containers — Sandbox needs
  Docker locally plus the Workers Paid plan, so the model writes files directly instead.
- **`FACTORY_TOKEN` must be set in production.** Unset is deliberately local-dev-only.

## Gotchas, each verified the hard way

- **Run `npm run dev`, never `wrangler dev`.** The Vite plugin writes a redirected
  `dist/factory/wrangler.json` whose `main` is the last built bundle, so `wrangler dev` will happily
  serve **stale code** while appearing to work. This cost real debugging time.
- **Vite binds IPv6 `[::1]`.** `curl 127.0.0.1:PORT` fails; use `localhost:PORT`.
- **This shell exports `NODE_ENV=production`**, so a plain `npm install` silently omits every
  devDependency. Always `--include=dev`.
- **`agents/vite` default-exports its plugin** in `agents@0.24`; the published docs show a named export.
- **`WorkflowSleepDuration` is a template literal type** — `"7 days"` works, `"7d"` does not.
- **`step.do` config needs `as const`**, or the callback result degrades to a union and every property
  access fails to type.
- **`mergeAgentState` is a shallow merge** — send the whole stage map, not one stage.
- **`Agent.broadcast` takes a string**; `AgentWorkflow.broadcastToClients` stringifies for you.
- **Re-run `npx wrangler types` after any `wrangler.jsonc` change**, or new bindings will not typecheck.

## Layout

```
src/server/
  index.ts            worker entry: routing, auth, /api/builds, /api/artifact, /sites/<id>/*
  factory-agent.ts    FactoryAgent (one per build) + FactoryIndex (registry)
  build-workflow.ts   the durable pipeline and both publish gates
  models.ts           provider resolution, the model guardrail, the call
  fixtures.ts         deterministic content for the mock provider
  lint.ts             the deterministic taste lint (pure)
  selfhost.ts         the factory-r2 publish rail
  pages-deploy.ts     the cloudflare-pages rail (upload -> poll -> live verify)
  stages/             s1..s5, one file per stage
src/client/           React console: stage rail, taste report, approval gate, ledger
.flow/0001-factory-mvp/BLUEPRINT.md   the flow-first blueprint this was built from
```

## What is proven, and what is not

**Proven end to end, locally, with no credentials:** request → S1 spec → S2 section map → S3 files →
S4 lint (SHIP) → approval gate → S5 publish → live URL returning HTTP 200 with the expected copy.
The build state and the published site both survive a full server restart.

**Not yet proven:** the model call against a real provider, and the `cloudflare-pages` target. Both
need credentials. Until a build runs on a real model, treat output quality as unmeasured — the pipeline
is proven, the writing is not.
