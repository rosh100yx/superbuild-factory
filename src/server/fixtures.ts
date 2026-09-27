import type { ModelMessage } from "./models";

/**
 * Deterministic fixtures for the `mock` provider.
 *
 * These exist for two reasons:
 *  1. the whole pipeline can be exercised with no API key at all, and
 *  2. the fixture site must PASS the deterministic lint — which makes it a live
 *     regression test that the lint is satisfiable rather than impossible.
 */

export const SPEC_FIXTURE = `Outcome: twelve qualified applications for the next Build-Scale cohort.

## The problem
Agencies ship generated work that reads cheap, because nobody owns the final judgement.
- name the failure mode in the first line
- state the cost in hours per week

## Who it is for
Design engineers at agencies who already use AI tools but ship work that fails review.

## What changes
Four weeks of taste drills, real reviews, and a published artefact at the end.

## Proof
Three cohorts, forty-one shipped surfaces, before-and-after teardowns for each.

## The offer
Twelve seats, application only, starting on the first Monday of the month.

## How to apply
One form, two minutes, no call required.

## Open questions
Team pricing for groups of five or more.`;

export const SECTIONS_FIXTURE = `1. Hero — state the promise and the primary action (beat 1)
2. Problem — name the failure mode and what it costs (beat 2)
3. Who it is for — qualify the reader (beat 3)
4. What changes — the four-week shape (beat 4)
5. Proof — cohorts and shipped surfaces (beat 5)
6. The offer — seats, terms, start date (beat 6)

Primary CTA: Apply for the cohort`;

export const CTA_FIXTURE = "Apply for the cohort";

export const INDEX_HTML_FIXTURE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Build-Scale — ship the thing you meant</title>
</head>
<body>
  <main>
    <section id="hero">
      <h1>Ship the thing you meant</h1>
      <p>Four weeks of taste drills for design engineers who already use AI tools.</p>
      <a class="cta" href="/apply">${CTA_FIXTURE}</a>
    </section>
    <section id="problem">
      <h2>The problem</h2>
      <p>Agencies ship generated work that reads cheap, because nobody owns the final judgement.</p>
    </section>
    <section id="who">
      <h2>Who it is for</h2>
      <p>Design engineers at agencies who want output that survives a client review.</p>
    </section>
    <section id="change">
      <h2>What changes</h2>
      <p>A repeatable review loop, a token discipline, and a published artefact at the end.</p>
    </section>
    <section id="proof">
      <h2>Proof</h2>
      <p>Three cohorts, forty-one shipped surfaces, before-and-after teardowns for each.</p>
    </section>
    <section id="offer">
      <h2>The offer</h2>
      <p>Twelve seats, application only, starting on the first Monday of the month.</p>
    </section>
  </main>
  <script type="module" src="./app.js"></script>
</body>
</html>
`;

export const STYLES_CSS_FIXTURE = `:root {
  --ink: #0a0c10;
  --paper: #e7ecf2;
  --accent: #f5a524;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--ink);
  color: var(--paper);
  font-family: system-ui, -apple-system, sans-serif;
}

main { max-width: 68ch; margin: 0 auto; padding: 48px 20px; }

section { padding: 40px 0; border-top: 1px solid var(--accent); }
section:first-child { border-top: none; }

h1 { font-size: 2.4rem; line-height: 1.1; margin: 0 0 12px; }
h2 { font-size: 1.05rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--accent); margin: 0 0 8px; }
p { line-height: 1.6; margin: 0; }

.cta {
  display: inline-block;
  margin-top: 16px;
  padding: 12px 20px;
  background: var(--accent);
  color: var(--ink);
  font-weight: 600;
  text-decoration: none;
}
`;

export const APP_JS_FIXTURE = `const sections = document.querySelectorAll("section");

const observer = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      entry.target.dataset.seen = "true";
    }
  });
});

sections.forEach(function (section) {
  observer.observe(section);
});
`;

export const SITE_FIXTURE = [
  { path: "index.html", content: INDEX_HTML_FIXTURE },
  { path: "styles.css", content: STYLES_CSS_FIXTURE },
  { path: "app.js", content: APP_JS_FIXTURE },
];

/**
 * Pick a fixture from the system prompt. The stages are distinguishable by their
 * own system text, so no extra plumbing is needed to tell them apart.
 */
export function fixtureFor(messages: ModelMessage[]): string {
  const system = messages.find((m) => m.role === "system")?.content ?? "";

  if (/brief stage/i.test(system)) return SPEC_FIXTURE;
  if (/sections stage/i.test(system)) return SECTIONS_FIXTURE;
  if (/build stage/i.test(system)) {
    return SITE_FIXTURE.map((f) => `===FILE: ${f.path}===\n${f.content}`).join("");
  }

  throw new Error(
    "The mock provider has no fixture for this prompt. It only serves the three " +
      "pipeline stages (brief, sections, build).",
  );
}
