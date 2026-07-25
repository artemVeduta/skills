---
type: Convention
title: Skill-contract recognition tests
description: How a skill whose implementation is instruction prose gets deterministic CI coverage, what that tier may assert, and why a recognition pass is never behavioral evidence.
timestamp: 2026-07-25
---

# Skill-contract recognition tests

A skill's implementation **is** its instruction prose. There is no compiled artifact to
assert against, so the clauses a skill commits to — a refusal, an approval gate, an
ownership boundary, a budget, a mode split — are enforceable only by reading the skill
itself. This repository therefore runs a **recognition tier** beside its behavioral one:
deterministic Node suites that live with the central case definitions in
`tools/test-runner/`, named for the skill or case family they cover
(`<case>-case.test.mjs`), reached by the `test` script in `package.json`, and gated by
CI's `npm test` step (see
[CI and automation wiring](/decisions/ci-and-automation-wiring.md)). They spawn no
harness and spend no inference.

The tier is easy to mistake for the behavioral oracle it deliberately is not. The
[testing architecture](/decisions/skill-testing-architecture.md) fixes deterministic
assertions on resulting repository state as the only pass/fail oracle for a *skill run*,
and the acceptance contract's cross-harness equivalence requirement compares observable
outcomes rather than prose (see
[Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md)). Neither
statement is relaxed here. A recognition suite makes no claim about what a harness did; it claims
only that the contract a live case is meant to exercise is still present to be exercised.

## Rules

1. **A skill whose contract lives in prose carries a recognition suite.** Every canonical
   skill under `skills/` has one, kept next to the case definitions rather than inside the
   skill, so no test material ships to an install.
2. **What the tier may assert.** Three things only: that the skill's own `SKILL.md`
   still states a named contract commitment; that its central case definitions load and
   declare the expected shape and targets (`loadCase` in
   `tools/test-runner/case-loader.mjs`); and that the projected pack still satisfies the
   static shared-reader contract (`checkPortableContract` in
   `tools/test-runner/static-contract.mjs`). It must not assert repository outcomes —
   proving an outcome requires running a harness.
3. **A recognition pass is never behavioral evidence.** A distribution cell becomes
   advertised only when its deterministic packaging evidence *and* a genuine live
   attestation both exist; the recognition tier is neither of those, and the parity gate
   (`tools/acceptance/matrix.mjs`) does not read it as evidence for any cell. Live proof
   comes from a recorded run of the matching case through the test-runner CLI.
4. **Contract prose and its recognition assertion co-change.** Rewording, moving, or
   removing a clause a suite recognizes updates that suite in the same change. The
   assertion is the record that the clause was deliberate.
5. **Never weaken an assertion to clear a red build.** A recognition failure means either
   the prose lost a commitment (restore it) or the commitment moved on purpose (update the
   assertion and say so in the change). Deleting the assertion silently retires acceptance
   evidence for a contract clause, which is a decision, not a cleanup.

## Rationale

The recognition tier exists because the alternative is worse in both directions. Without
it, a reword can quietly drop an approval gate or a budget ceiling and nothing fails until
someone spends inference on a live run — and live runs are developer-invoked, not
per-change. With it treated as behavioral proof, the opposite failure appears: a cell looks
verified when nothing has actually executed. Separating the tiers keeps each honest, which
is why rule 3 is stated as a prohibition rather than a caveat.

Keeping the suites with the case definitions rather than under `skills/` follows the
central-cases rule of the [testing architecture](/decisions/skill-testing-architecture.md).
Keeping them inference-free is what lets them gate every push at all — the constraint that
also fixes CI as static-only.
