---
type: Decision
title: Benchmark metrics and comparison design
description: Tiered smoke/full trial presets, an advisory two-of-five-trial regression flag, committed summary JSON with local raw artifacts, release-promoted baselines, an identity-set provenance schema, and per-case reports with no cross-case blend.
timestamp: 2026-07-25
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

# Amendments

<!-- Append dated entries; never rewrite the decision above.
## YYYY-MM-DD — <short title>
<what changed and why; link the driving work>
-->

## 2026-07-16 — #25 rescoped to a single-arm run + report flow

Rescoped per `docs/superpowers/specs/2026-07-16-benchmark-test-report-flow-design.md`
(§3), shipped on `feat/24-test-runner` with #24. Deferred, not removed from the
decision text above:

- The paired **with/without-skill comparison arm** (the paired-trial shape fixed by
  the [testing and benchmark architecture](/decisions/skill-testing-architecture.md)
  and carried into decision 1's presets) and its with/without **delta** (the
  paired-delta half of decision 6) — every run is single-arm, skill-installed only.
- The **advisory ≥2-of-5-trial regression flag** (decision 2) — inert without a
  comparison arm and at a trial count of 1.
- **Baseline promotion at release** (decision 4) and the release-script staleness
  guard — a baseline needs a delta and trials ≥ 2 to mean anything;
  `scripts/release.mjs`'s `checkBenchmarkStaleness` stub is left untouched.
- **`full`'s trial count is 1, not 5** (decision 1), in this iteration; harness
  breadth (not trial count) distinguishes `smoke` from `full` for now. Trial count
  remains an adjustable per-preset knob.

Carried over unchanged: the **provenance identity set** (decision 5), the
**commit-summary / keep-raw-artifacts-local** retention split (decision 3), and the
**deterministic per-case report generator with no cross-case blend** (the kept half
of decision 6) — now sourced from #24's `run.json` (`writeRunJson` in
`tools/test-runner.mjs`) plus a run-level git identity, and written to
`tools/benchmarks/summaries/` + `tools/benchmarks/reports/`.

## 2026-07-17 — per-harness model knob + honest claude-code auth

- **Per-harness model knob.** Live runs now pin a model per harness from a single
  map, `tools/benchmarks/models.mjs` (`MODELS`/`modelFor`): `claude-code` →
  `claude-opus-4-8`, `codex` → `gpt-5.6-sol`, `opencode` →
  `opencode-go/deepseek-v4-pro`. These ids are threaded into `runCase` via
  `harnessSelections {id, model}` (the override channel #24 already supports:
  `runHarness` resolves `model ?? driver.defaultModel`). This OVERRODE the plan's
  original `model: null` for every selection (Task 5), which would have fallen
  back to each driver's baked-in default — including claude-code's malformed
  dotted default id `claude-opus-4.8` (`tools/test-runner/drivers.mjs`). Models
  are an easily-editable knob, expected to be edited before a run rather than
  hard-coded per call site; kept in its own file, separate from
  `tools/benchmarks/presets.mjs`, because model choice is a per-harness axis
  shared across presets, not a per-preset dimension.
- **Honest claude-code auth verification.** The claude-code test-profile auth
  check in `scripts/setup-test-profiles.sh` switched from a global
  macOS-Keychain existence check — a false positive, since Keychain material can
  exist while the profile itself is logged out — to the CLI's own verdict:
  `claude auth status --json` against the profile's `CLAUDE_CONFIG_DIR`, gated
  on its `loggedIn` field rather than its exit code.

## 2026-07-25 — `drivers.mjs` default-id citation superseded (#63)

The 2026-07-17 amendment above cites "claude-code's malformed dotted default id
`claude-opus-4.8` (`tools/test-runner/drivers.mjs`)". That was accurate when
written; the #63 acceptance-matrix work has since reconciled the drift — the
Claude driver's pinned default in `tools/test-runner/drivers.mjs` is now the
canonical hyphenated `claude-opus-4-8`. The dated sentence stays intact as
history, but a reader following its parenthetical live-file pointer should note
that the file no longer holds the dotted id. See the 2026-07-25 "Model drift
reconciled" note in
[Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md).
Driven by #63.

## 2026-07-25 — What the retained raw artifact set actually contains

Decision 3's retention SPLIT is unchanged — summary JSON committed, raw artifacts kept
local under a git-ignored runs directory. What that raw set contains is narrower in one
respect and wider in two:

- **Resulting fixture state is not retained, and cannot be.** A fixture is an
  ephemeral out-of-repo `os.tmpdir()` directory and both callers destroy it: the
  benchmark flow removes each leg's fixture as soon as that leg's provenance record
  has been read (`runBench` in `tools/benchmarks/run.mjs`), and the runner CLI removes
  every fixture after reporting (`main` in `tools/test-runner.mjs`). Nothing copies
  fixture state elsewhere first, so decision 3's enumeration over-claimed on this
  item. The post-mortem value it was reaching for is carried by the per-assertion
  results, which record what each assertion observed in the fixture before it was
  destroyed.
- **Per-leg and per-run records the decision predates.** Each executed leg retains its
  session transcripts — turn 1 plus one numbered file per later resumed turn, the #48
  plan/approval seam — its per-assertion results, and its structured provenance
  record. A run that declares cross-harness outcome comparison additionally retains a
  run-level comparison record, because that equivalent/diverged verdict gates the exit
  code and a gating verdict must stay attributable after the run. See `runHarness` and
  `runCase` in `tools/test-runner.mjs`.

The 2026-07-16 "carried over unchanged" note above restates decision 3's wording and so
inherits the same fixture-state over-claim; the retention split it carries over is
otherwise accurate.
