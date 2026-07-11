---
type: Decision
title: Benchmark metrics and comparison design
description: Tiered smoke/full trial presets, an advisory two-of-five-trial regression flag, committed summary JSON with local raw artifacts, release-promoted baselines, an identity-set provenance schema, and per-case reports with no cross-case blend.
timestamp: 2026-07-11
---

# Benchmark metrics and comparison design

## Context

The [testing and benchmark architecture](/decisions/skill-testing-architecture.md)
fixed the benchmark shape — paired with/without-skill trials driven by headless harness
CLIs, provenance on every score, never a per-change gate — and explicitly deferred the
numbers: trial counts, thresholds, retention, baseline policy, and reporting. The
[survey](/references/agent-skill-testing-landscape.md) binds three warnings: reports
must retain individual trials; a single stochastic failure must not be disguised as a
regression; and a score without model, harness, and snapshot identity is not
comparable. Cost anchors the design: one paired trial is two full agent sessions, so a
5-trial case is 10 sessions per harness before any cross-model comparison.

## Decision

1. **Trial counts — two named presets.** A benchmark run is either `smoke` (1 paired
   trial — a cheap check that a case's wiring works) or `full` (5 paired trials — the
   mode for scores intended to be compared or recorded). Every recorded score names
   its preset; only full-preset summaries are comparable and promotable to baseline.

2. **Regression flag — advisory, two of five trials.** A full run flags a case as a
   regression when its with-skill pass rate falls at least 2 trials (≥40 points)
   below the baseline's. A single stochastic failure never flags. The flag is a
   report label only — benchmarks never gate, per the architecture decision.

3. **Retention — commit summaries, keep raw artifacts local.** The runner writes full
   raw artifacts (session transcripts, resulting fixture state, per-assertion
   results) to a git-ignored runs directory under `tools/`; the per-run summary JSON
   — scores, per-trial marks, deltas, flags, provenance, preset — is committed to the
   repo. Committed summaries are the only shared truth; anything derived from them is
   regenerable.

4. **Baseline update — explicit promotion at release.** The cross-run baseline is a
   full-preset summary promoted as part of the release ritual owned by the `scripts/`
   release script ([versioning policy](/decisions/versioning-and-release-policy.md)),
   so each release tag carries the baseline the next cycle compares against. A run
   never becomes the yardstick silently. The within-run baseline needs no policy — it
   is always the fresh without-skill arm of the same paired trial.

5. **Provenance schema — a required identity set.** Every recorded summary requires:
   ISO timestamp; library commit SHA plus a dirty flag (and the release tag when on
   one); case id (skill plus case name); preset and trial count; and per arm, the
   harness name with version and the model id. All other fields (token counts,
   durations, cost estimates) are optional extras, since what harness CLIs expose
   differs.

6. **Aggregation and reporting — per-case table, no blend.** Within a case, trials
   aggregate to a pass rate per arm plus the paired delta. Across cases there is no
   blended score — the survey's means-hide-weak-tasks warning made structural. A
   deterministic generator renders a markdown report from the committed summaries:
   one row per case showing per-trial marks, with/without pass rates, delta,
   regression flag, and advisory judge scores.

## Alternatives

- **Fixed trial count (3 or 5) for every run**: rejected — either debugging a new
  case costs 10 sessions, or all recorded scores sit on 3-trial variance.
- **Adaptive N until confidence intervals separate**: rejected — the most machinery
  to build and explain, at odds with the trimmed-harness philosophy.
- **Any pass-rate drop flags**: rejected — at 5 trials a single stochastic failure
  triggers it, training the reader to ignore flags.
- **Statistical significance test for the flag**: rejected — at N=5 it almost never
  fires and adds the most explanatory burden.
- **No thresholds at all**: rejected — every report would need eyeballing; nothing
  surfaces regressions.
- **Commit raw artifacts**: rejected — MBs per run, and transcripts can capture
  environment details that should not be published.
- **External-only or local-only result storage**: rejected — cross-snapshot trend
  comparison then depends on an expiring external store, or dies with local cleanup.
- **Latest-run-wins or per-model floating baselines**: rejected — one anomalous run
  silently rebases every future comparison.
- **Manual baseline pin disconnected from releases**: rejected — easy to forget;
  stale baselines make reports compare against ancient history.
- **Provenance as only the architecture's trio (model, harness, snapshot)**: rejected
  — omits preset and case identity, both load-bearing for comparability here.
- **Required resource-usage provenance**: rejected — couples the schema to whatever
  usage data each harness CLI happens to expose.
- **Headline blended score across cases**: rejected — exactly the mean the survey
  warns about.
- **JSON-only, no report generator**: rejected — every comparison becomes manual
  work.

## Consequences

- Benchmark cost is bounded and predictable: a full run is 10 agent sessions per case
  per harness; smoke runs make case authoring cheap.
- The repo grows a few KB per recorded run; raw material survives locally for
  post-mortems without bloating history.
- The release ritual gains a step: promoting the current full-preset summary to
  baseline belongs to the release script.
- Regression detection is trustworthy but coarse — 20-point granularity at N=5;
  tightening it means raising the full preset's trial count via amendment.
- The report generator is a small deterministic tool over committed JSON — rerunnable
  anywhere, no inference cost.

## Amendments

<!-- Append dated entries; never rewrite the decision above.
## YYYY-MM-DD — <short title>
<what changed and why; link the driving work>
-->
