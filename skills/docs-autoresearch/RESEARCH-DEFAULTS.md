# docs-autoresearch shipped defaults

This is the **single source of the shipped default values and default research
policy** for the docs-autoresearch skill. `SKILL.md` owns the fixed mechanics,
orchestration, safety rules, hard ceilings, failure behaviour, and filing — those
are **not** configurable here. This file carries only the tunable defaults a run
applies when the target repository declares no override.

A repository may lower budgets and refine preferences in a later slice through an
optional `docs/conventions/research.md`; it can never raise a budget past a hard
ceiling or weaken a safety rule. When that override file is absent, the values
below apply and the run **announces** that it used shipped defaults.

## Default write mode

**Reference enrichment.** Create or materially enrich exactly one curated
multi-source `Reference` concept. The Specification-resolution and
pre-work-reconnaissance modes are explicit, never the default.

## Fetch budget

- **Normal global cap: 20 fetch attempts per run**, counting every failure and
  every retry — not just successful bodies.
- **Recommended per-round split: 12 / 5 / 3** (Round 1 / Round 2 / Round 3).
  Unused quota moves forward only at a round boundary, never mid-round.
- A run may, with explicit user approval, take a **one-run increase up to 45**
  attempts. The next run resets to 20; the raised budget never persists.

## Round structure

| Round | Purpose | Angles / gaps | Searches |
| --- | --- | --- | --- |
| 1 | Breadth | 3–5 independent angles, one worker each | 2–3 searches per worker |
| 2 | Gaps | up to 5 material evidence gaps | at most 5 targeted searches |
| 3 | Verification (optional) | unresolved contradictions / missing decisive evidence | at most 5 targeted searches |

## Concept mutation ceiling

**At most three concepts** created or materially updated in one run, excluding
`index.md` and `log.md` bookkeeping.

## Source hierarchy

Prefer, in order:

1. **Primary evidence** — the thing itself (specs, standards, source code, filings).
2. **Authoritative analysis** — maintainers, standards bodies, domain experts.
3. **Credible secondary reporting** — established, editorially accountable outlets.
4. **Informal leads** — forums, blogs, social posts: pointers to primary sources
   only, never a high-confidence source on their own.

User-supplied sources are **mandatory seeds, not the evidence boundary** — workers
still discover and corroborate beyond them. No override can promote unsourced
material to high confidence.

## Confidence labels

Label every claim in prose with one of:

- **high** — multiple independent authoritative sources agree.
- **medium** — a single good source, or sources that partially agree.
- **low** — speculation, opinion, a single informal source, or an unverified claim.

## Freshness

Prefer sources from roughly the last two years unless the topic is foundational.
Flag a claim resting only on material older than about three years as potentially
stale in Open Questions.

## Default Reference shape

```markdown
# <Topic>

## Overview

## Key Findings

## Contradictions

## Open Questions

# Citations
```

Claims carry their confidence and citation **adjacent in the prose** — there is no
`confidence` frontmatter key. Open Questions live in the most relevant concept and
are narrowed, removed, or retained as later evidence changes their state.

## Output style

Declarative and present tense. Cite every non-obvious claim. Prefer prose plus a
citation over pasted source bodies; the run persists summaries and citations, never
raw fetched bodies.
