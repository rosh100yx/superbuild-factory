# Position scan — Cloudflare software factory

_Evidence retrieved 2026-09-27. “Inferred” means the conclusion is mine; product facts and collision counts come from the linked primary sources._

- **Recommendation: `durable-factory`.** It names the strongest technical wedge, says cleanly on video, and both `rosh100yx/durable-factory` and the unscoped/scoped npm names returned 404.
- **Biggest collision risk: `software-factory`.** GitHub search returned **1,006** repository-name matches, a GitHub organization already uses the phrase, and npm `software-factory` is an active package at **0.2.4**. Do not use it as the repo name.
- **Category verdict: saturated.** I found **12 distinct direct or broad-overlap prompt-to-build products/factories**; the uncommon combination is not AI code generation, orchestration, durability, or review alone—it is **a zero-credential, free-tier Cloudflare template whose publish path structurally requires deterministic lint and then human approval**.

## 1. PRIOR ART

### Saturation count: 12 distinct direct/broad-overlap products — **saturated**

These address “describe software/site → generate/build → preview or deploy,” rather than merely supplying an LLM API:

1. [Bolt.new](https://github.com/stackblitz/bolt.new) — hosted prompt-to-full-stack app builder; browser execution and speed are the wedge.
2. [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) — open-source, provider-flexible Bolt fork; 19,916 GitHub stars when retrieved.
3. [Lovable](https://lovable.dev/) — hosted full-stack MVP builder, commonly paired with Supabase; not a self-hosted durable Cloudflare pipeline.
4. [v0](https://v0.dev/) — design-forward React/UI generation and Vercel distribution; not a fixed resumable factory with mandatory gates.
5. [Replit Agent](https://replit.com/ai) — integrated IDE, runtime, database, and deployment; platform-hosted rather than a free-tier template.
6. [Base44](https://base44.com/) — hosted natural-language app builder; closed platform rather than open Cloudflare infrastructure.
7. [Create](https://www.create.xyz/) — prompt-to-app product; hosted builder rather than auditable workflow template.
8. [Dyad](https://github.com/dyad-sh/dyad) — local/private open-source builder; 21,600 stars, but its wedge is local control/BYOK, not durable edge execution.
9. [Cloudflare VibeSDK](https://github.com/cloudflare/vibesdk) — the closest architectural alternative: Durable Object workspace, agent loop, dynamic previews, browser verification, and Cloudflare deployment; 5,400 stars. Its own setup says production previews need Workers Paid/Workers for Platforms plus credentials.
10. [software-factory on npm](https://www.npmjs.com/package/software-factory) — issue/repo input to code, validation, Render deploy, and PR through SuperPlane; needs SuperPlane, GitHub, and Render credentials.
11. [Vercel Eve software-factory template](https://github.com/vercel-labs/eve-software-factory-template) — agent software-factory template; 1,137 stars when retrieved.
12. [Super Simple Software Factory](https://github.com/disler/super-simple-software-factory) — deterministic orchestration around bounded coding agents; 898 stars when retrieved, but it is a repo workflow rather than this zero-key site-publishing rail.

### A. AI app/site builders — **saturated**

- **Bolt.new / bolt.diy:** fastest route from prompt to editable full-stack app; no evidence retrieved of the exact mandatory deterministic-lint-then-human-publish sequence.
- **Lovable:** hosted full-stack MVP experience and low-friction UX; not free-tier self-hosted infrastructure.
- **v0:** UI quality and Vercel-native distribution; narrower on UI and tied to Vercel’s ecosystem.
- **Replit Agent:** all-in-one coding environment and hosting; the platform owns the runtime.
- **Dyad:** local privacy and user control; not crash-resumable cloud execution.
- **Cloudflare VibeSDK:** richer and more capable than this artifact, and the closest substitute; production setup is heavier and paid, while its workflow is iterative agent verification rather than two mandatory publish gates.

**Actually uncommon here:** **both gates being structural publish preconditions—reproducible non-model lint first, explicit human approval second.**

### B. Agent frameworks / orchestration — **saturated**

- [LangGraph JS](https://github.com/langchain-ai/langgraphjs) — resilient agents expressed as graphs; 3,320 stars.
- [CrewAI](https://github.com/crewAIInc/crewAI) — role-playing agent crews; 59,087 stars.
- [Mastra](https://github.com/mastra-ai/mastra) — TypeScript framework spanning agents, workflows, evals, and application plumbing; 28,364 stars.
- [AutoGen](https://github.com/microsoft/autogen) — Microsoft’s general multi-agent programming framework; 61,186 stars.
- [OpenAI Agents SDK](https://github.com/openai/openai-agents-js) — lightweight handoffs, tools, guardrails, and tracing; 3,862 stars.
- [Cloudflare Agents](https://github.com/cloudflare/agents) — persistent Durable Object agents with workflows and human-in-the-loop approval; 5,700 stars. This is a substrate used by the artifact, not a competing finished factory.
- [Temporal](https://github.com/temporalio/temporal) — production-grade durable execution with worker fleets; 23,315 stars.
- [Inngest](https://github.com/inngest/inngest) — event-driven stateful step functions across serverless/edge; 5,894 stars.
- [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) — TypeScript durable jobs and AI workflows on managed or self-hosted workers; 16,422 stars.

**Actually uncommon here:** **a complete, useful build→lint→approve→publish run with no model key, no external deployment credential, and no container.** Framework examples usually demonstrate primitives, not a zero-signup product loop.

### C. AI codegen with a quality gate / reviewer loop — **crowded**

- [ShipGate](https://www.npmjs.com/package/shipgate) — formal intent specifications and deterministic SHIP/NO-SHIP verification; npm 2.1.0, but it does not provide this site factory or human publish event.
- [Shipward](https://github.com/albertoclemente/shipward) — runs a developer-selected command before an agent can move a card; local tracker/memory, not durable publishing.
- [agent-review-loop](https://github.com/sourds42/agent-review-loop) — deterministic lint/tests before LLM review, escalating to a human on failure.
- [agent-loops](https://github.com/mixxan05/agent-loops) — worker/verifier loops with hard gates, retries, and human escalation.
- [aislop](https://github.com/marketplace/aislop-ai-code-quality-gate) — deterministic rule-based gate for AI-generated pull requests.
- [CodeRabbit quality-gate guidance](https://www.coderabbit.ai/guides/ai-generated-code-quality-gate) — independent AI review and pre-merge policy checks; model review remains part of the value.

**Actually uncommon here:** **the deterministic verdict and the later human event both live inside the resumable deployment workflow, so bypassing either prevents publication—not merely merge or card movement.**

### D. Durable execution / workflow engines — **crowded**

Primary alternatives are [Temporal](https://github.com/temporalio/temporal), [Inngest](https://github.com/inngest/inngest), [Trigger.dev](https://github.com/triggerdotdev/trigger.dev), [Cloudflare Workflows](https://developers.cloudflare.com/workflows/), [Upstash Workflow](https://upstash.com/docs/workflow/basics/how), and [AWS Step Functions](https://aws.amazon.com/step-functions/). A 2026 comparison found at least six serious engines; retries, waits, events, and crash recovery are standard category capabilities.

**Actually uncommon here:** **one Durable Object as each build’s durable state combined with a five-stage Workflow, R2 artifact/deploy rail, and free-tier/no-container constraint in one installable Cloudflare template.** Durability alone is not differentiation.

### Market-size/share proxy — no invented search volume

- **TAM proxy:** 12 direct/broad-overlap builders/factories found, plus dedicated Product Hunt categories for website builders, AI coding agents, and AI workflow automation. Observable open-source demand is at least **46,916 stars across only Dyad (21.6k), bolt.diy (19,916), and VibeSDK (5.4k)**. Stars overlap and are not users or revenue.
- **SAM proxy:** the Cloudflare-native/open-source slice has one dominant direct reference, VibeSDK at **5.4k stars / 1.3k forks**, while Cloudflare Agents—the substrate—has **5.7k stars / 738 forks**. The artifact’s lighter free-tier/no-key niche is visibly much smaller; no install count was available.
- **SOM proxy today:** **0 public repo stars, 0 verified template installs, and no published npm package**, because the candidate repo does not yet exist. A share percentage would be fiction. The first meaningful signal is template clones/completed mock runs, not raw page views.

## 2. POSITIONING STATEMENT

**For design engineers, indie builders, agency developers, and agent tinkerers who need prompt-to-page automation they can trust and run without paid infrastructure, `durable-factory` is the open-source Cloudflare software factory that resumes every build and publishes only after deterministic lint and human approval, unlike Cloudflare VibeSDK.**

Proof:

1. **Durable:** one Durable Object holds each build’s state; five Workflow stages retry and resume after eviction or restart.
2. **Structurally gated:** deterministic `SHIP / FIX FIRST`, then a separate approval event; deployment code is unreachable without both.
3. **Zero-credential first run:** mock fixtures exercise the real workflow and publish into the project’s own R2-backed `/sites/<id>/` rail.

Alternative wedges:

- **VibeSDK:** richer iterative builder and dynamic preview platform on Cloudflare.
- **Dyad:** private, local, open-source app generation.
- **Bolt/bolt.diy:** speed, browser execution, and broad full-stack generation.
- **Shipward:** local trust through machine-run checks before task completion.
- **Ours:** **price** free-tier; **speed** one template command and a zero-key run; **taste** deterministic lint; **audience** builders who want inspectable infrastructure; **distribution** Cloudflare template.

**Defensible edge:** the architecture and demo discipline are distinctive, but there is **no durable moat yet**. Open source makes the bundle copyable. The edge becomes defensible only through trusted lint rules, fixture coverage, restart proofs, excellent docs, and Cloudflare-template mindshare.

## 3. NAME SHORTLIST

Collision checks covered: the fixed-owner URL `github.com/rosh100yx/<name>`, the bare GitHub org URL, GitHub repository-name search, the unscoped npm registry name, and `@rosh100yx/<name>`. A registry/GitHub 404 means available at retrieval time, not reserved.

1. **`durable-factory` — literal/descriptive.** Fits the primary property: the build survives restart. Demo line: **“Durable Factory picked this build back up after I killed the server.”** Boring-but-searchable; that is a strength. Install: `npm create cloudflare@latest -- --template=rosh100yx/durable-factory`.
2. **`gated-factory` — literal/descriptive.** Names the two non-bypassable publish gates. Demo line: **“Gated Factory won’t publish until lint and I both say yes.”** Boring-but-searchable. Install: `npm create cloudflare@latest -- --template=rosh100yx/gated-factory`.
3. **`publishmill` — manufacturing metaphor.** The mill turns a request into a published page, while “publish” states the output. Demo line: **“I’ll run this through Publishmill and approve the result.”** Memorable and reasonably searchable. Install: `npm create cloudflare@latest -- --template=rosh100yx/publishmill`.
4. **`resumill` — abstract/coined + manufacturing metaphor.** “Resume” + “mill” encodes resumable manufacturing. Demo line: **“Resumill resumes at the stage that failed.”** Memorable, but spelling and pronunciation need teaching. Install: `npm create cloudflare@latest -- --template=rosh100yx/resumill`.
5. **`approval-forge` — manufacturing metaphor.** Leads with the human control point, then the making metaphor. Demo line: **“Approval Forge built it, but it can’t go live until I approve.”** Searchable, slightly bureaucratic. Install: `npm create cloudflare@latest -- --template=rosh100yx/approval-forge`.
6. **`mock-to-live` — literal/descriptive.** Owns the zero-credential proof: fixtures in, real live URL out. Demo line: **“Mock to Live runs the whole pipeline without a single API key.”** Highly searchable, but undersells real-provider use. Install: `npm create cloudflare@latest -- --template=rosh100yx/mock-to-live`.
7. **`shipwhen` — verb-first.** The name asks the product’s central question: ship when lint passes and a human approves. Demo line: **“ShipWhen only ships when both gates clear.”** Memorable-but-less-searchable because it reads like ordinary prose. Install: `npm create cloudflare@latest -- --template=rosh100yx/shipwhen`.
8. **`software-factory` — literal/descriptive.** Perfect category comprehension, disastrous ownership. Demo line: **“This software factory turns a brief into a live page.”** Boring and effectively unsearchable amid 1,006 GitHub name matches. Install: `npm create cloudflare@latest -- --template=rosh100yx/software-factory`.

**Position:** for an open-source template that must be found, **boring-but-searchable wins**. Use a distinctive descriptive compound, not an opaque coinage. `durable-factory` gives search engines both the differentiator and category.

| name | strategy | fit | GitHub taken? | npm taken? | sayability | searchable? |
|---|---|---|---|---|---|---|
| **durable-factory** | literal/descriptive | restart-safe state + workflow | No exact org or `rosh100yx` repo; 2 unrelated substring matches | No; unscoped and scoped returned 404 | Excellent | **High** |
| **gated-factory** | literal/descriptive | deterministic + human gates | No exact org or `rosh100yx` repo; 1 substring match | No; unscoped and scoped returned 404 | Excellent | **High** |
| **publishmill** | manufacturing metaphor | request milled into published output | No org, fixed-owner repo, or repo-name match | No; unscoped and scoped returned 404 | Good | Medium-high |
| **resumill** | coined/metaphor | resumable mill | No exact org or fixed-owner repo; only `resumills-client` matched search | No; unscoped and scoped returned 404 | Fair | Medium |
| **approval-forge** | manufacturing metaphor | human approval before publish | No exact org or fixed-owner repo; search returned only substrings | No; unscoped and scoped returned 404 | Good | High |
| **mock-to-live** | literal/descriptive | zero-key fixture to real URL | No exact org or fixed-owner repo; 3 substring matches | No; unscoped and scoped returned 404 | Excellent | High |
| **shipwhen** | verb-first | ships only when both gates clear | No exact org or fixed-owner repo; 2 old `shipwhen-*` repos | No; unscoped and scoped returned 404 | Excellent | Low-medium |
| **software-factory** | literal/descriptive | exact category | **Yes:** org taken; 1,006 repo-name matches; fixed-owner path free | **Yes:** unscoped 0.2.4; scoped availability not ownership of the words | Excellent | **Low** |

## 4. RANKING

1. **durable-factory**
2. **gated-factory**
3. **publishmill**
4. **mock-to-live**
5. **approval-forge**
6. **resumill**
7. **shipwhen**
8. **software-factory**

**Recommendation — `durable-factory`:** durability is the hardest property competitors cannot imply with ordinary prompt-to-app marketing, and the descriptive compound is currently clean across the checked fixed-owner GitHub and npm paths.

**Runner-up — `gated-factory`:** it communicates the trust model faster than any metaphor, but “gated” can sound restrictive and says nothing about restart survival—the deeper engineering proof.

## 5. RISKS

- **`software-factory`: kill.** Generic, crowded, existing GitHub org, active npm package, and direct new software-factory projects from Vercel and others. Scoped npm would not solve discoverability.
- **`durable-factory`: moderate naming risk.** “Durable” is used by [Durable AI](https://x.com/DurableAI), an AI business/website builder. The compound is descriptive, but trademark clearance is still required before brand investment.
- **`gated-factory`: low legal, medium tone risk.** “Gated” foregrounds restriction rather than creative output.
- **`publishmill`: low observed collision, medium comprehension risk.** It could sound like publishing/print tooling rather than software generation.
- **`resumill`: low observed collision, high spelling risk.** People may hear “resume mill” or “résumé mill.”
- **`approval-forge`: medium semantic risk.** “Forge” is heavily used in developer tooling; “approval” can imply enterprise bureaucracy.
- **`mock-to-live`: medium positioning risk.** Excellent demo title, weak umbrella brand once real providers become the norm.
- **`shipwhen`: medium search risk.** Natural-language phrase, and two old `shipwhen-*` GitHub repos already exist.
- **Hostile connotations:** none found among the shortlist.
- **Legal status:** repository/npm checks are not trademark searches and are not legal clearance.

### Artifact skill/taste standing

**Provisional composite: 3.10/5 · tied 9th–10th of 11 measurements including this artifact · no percentile claim.** Cohort: the 10 dated public/agency measurements in `superbuild-agency/_orchestration/taste-scores.csv`, anchored by `linear.app` at 4.63 and `bootstrap-agency` at 1.42. Specific marker: the source shows a coherent tokenized operations console with clear status hierarchy, stage rail, deterministic report, and approval gate, but the presentation relies heavily on generic dark cards, pills, monospace labels, and inline utility styles and lacks a rendered generated-site preview. That places it around the existing 3.10 “competent but card-heavy” marker, not the 3.73+ polished band. **Inferred and source-only:** no full rubric sheet or rendered screenshot was available, so this is not a formal visual score.

## Sources

- [Cloudflare VibeSDK repository](https://github.com/cloudflare/vibesdk)
- [Cloudflare Agents repository](https://github.com/cloudflare/agents)
- [Dyad repository](https://github.com/dyad-sh/dyad)
- [bolt.diy repository](https://github.com/stackblitz-labs/bolt.diy)
- [GitHub repository-name search: software-factory](https://api.github.com/search/repositories?q=software-factory%20in:name)
- [npm registry: software-factory](https://registry.npmjs.org/software-factory)
- [npm registry: ShipGate](https://registry.npmjs.org/shipgate)
- [Shipward repository](https://github.com/albertoclemente/shipward)
- [Agent review loop](https://github.com/sourds42/agent-review-loop)
- [Agent loops](https://github.com/mixxan05/agent-loops)
- [Temporal](https://github.com/temporalio/temporal)
- [Inngest](https://github.com/inngest/inngest)
- [Trigger.dev](https://github.com/triggerdotdev/trigger.dev)
- [2026 durable workflow comparison](https://upstash.com/blog/durable-workflow-engines-compared-every-major-option-in-2026)
- [Product Hunt AI coding agents category](https://www.producthunt.com/categories/ai-coding-agents)
- [Product Hunt AI workflow automation category](https://www.producthunt.com/categories/ai-workflow-automation)
- [Product Hunt website builders category](https://www.producthunt.com/categories/website-builders)

## WHAT I COULD NOT VERIFY

I could not verify Google/YouTube search volume, closed-product install counts or revenue, Cloudflare template install counts, social-handle/domain availability, or trademark clearance. X search returned only sparse indexed results, and no Instagram evidence was available. GitHub/npm availability is a point-in-time check and can change immediately. Real-provider output quality and the Cloudflare Pages rail remain unproven according to the artifact’s README; the no-key mock/R2 path is the demonstrated path. The taste score is source-only because no rendered screenshot or full rubric dimensions were present.

**Verdict — BUILD.** The broad category is saturated, but the exact reference implementation is worth shipping under **`durable-factory`**: not as “another AI website builder,” but as the smallest inspectable proof that prompt-to-publish can be resumable, deterministic at the quality gate, human-controlled at release, and runnable without credentials or paid infrastructure.
