# Benchmark Test + Report Flow — Design (#25, rescoped)

> **Status:** approved design, 2026-07-16. Ships in one pull request together with #24
> (test-runner tracer bullet + profile isolation) on `feat/24-test-runner`.
>
> - Branch: `feat/24-test-runner`.
> - Governing decisions: `docs/decisions/skill-testing-architecture.md`;
>   `docs/decisions/benchmark-metrics-and-comparison-design.md` (this spec rescopes
>   several of its numbered decisions — see §3); `docs/decisions/ci-and-automation-wiring.md`
>   (the CI-unchanged constraint, §9).
> - Builds directly on `docs/superpowers/specs/2026-07-15-test-runner-profile-isolation-design.md`
>   (#24): this spec wraps its `runCase`/`runHarness` entry point (`tools/test-runner.mjs`)
>   and reuses its `run.json` provenance shape (`writeRunJson`) unchanged.

## 1. Context and motivation

- #24 (closed) shipped the test-runner tracer bullet — fixture builder, three headless
  drivers, deterministic oracle, gating CLI, the first `okf-docs-setup` case — plus, in a
  follow-up batch, profile isolation, the four-rung preflight ladder, and `run.json`
  provenance. #24 and #25 ship together in **one** pull request on `feat/24-test-runner`.
- #24's harnesses have **never been run green live end-to-end** since the profile-isolation
  rewrite landed. The one real live attempt (2026-07-14) failed 0/16 assertions on all three
  harnesses: opencode escaped its fixture and mutated 8 committed docs files; claude and
  codex auth-failed under the then-current empty-`HOME` isolation. The profile-isolation
  work (`docs/superpowers/specs/2026-07-15-test-runner-profile-isolation-design.md`) was
  built to fix exactly that, but its live-verification step — that design's §11 "AC-1"
  (all three harnesses live green on `okf-docs-setup`), tracked as Task 12 in
  `docs/superpowers/plans/2026-07-15-test-runner-profile-isolation.md` — was never
  performed; the branch stopped one task short. **Closing that gap is a first-class goal
  of this work**, not an afterthought.
- #25 as originally written (`docs/decisions/benchmark-metrics-and-comparison-design.md`)
  is a comparative benchmark layer: paired with/without-skill trials, `smoke=1`/`full=5`
  trial-count presets, committed summary JSON, an advisory regression flag, release-script
  baseline promotion, and a deterministic report generator. This spec **rescopes #25
  substantially**, per explicit user decision — see §3 for exactly what is kept and what
  is deferred.

## 2. Goal

Ship a single-arm "run the skill's test, report the result" flow that:

1. finally exercises the harnesses live end-to-end, closing the Task 12 gap described
   above; and
2. produces a committed, deterministic report from that run.

There is no comparison arm (no without-skill run, no delta) and no trend layer (no
baseline, no regression flag) in this iteration.

## 3. Rescope: what changes from #25-as-written

`docs/decisions/benchmark-metrics-and-comparison-design.md` decided a **paired**
with/without-skill benchmark with `full` = 5 trials per arm, an advisory regression flag,
and release-time baseline promotion. This spec ships a strict subset of that shape — a
single arm, one trial per harness by default — and defers the rest. Concretely,
rescoped from that decision:

- **Without-skill comparison arms and the with/without delta are dropped.** The user does
  not want a comparison arm. Every run in this spec executes the skill **with the skill
  installed only**; there is no paired without-skill leg and therefore no delta to report.
- **The advisory regression flag is dropped.** It is inert without a comparison arm and at
  a trial count of 1 (the flag's own design required ≥2-of-5 trials to fire).
- **Baseline promotion and the release-script staleness guard are dropped.** A baseline
  needs something to compare against (a with/without delta) and a `full` preset with
  trials ≥ 2 for the flag's arithmetic to mean anything; neither holds here.
- **`full`'s trial count changes from 5 to 1.** With no comparison arm, a higher trial
  count buys reliability signal only, not comparability, so it is not needed yet (see §4).
- **Any agent-driven "read the last run's summary, propose skill changes" loop is out of
  scope.** This is a plausible future phase. This spec's only obligation toward it is
  making sure the committed artifact lives at a stable, discoverable, well-schema'd path
  (§8) so such a loop *could* be built later — building the loop itself now would be
  speculative (YAGNI).

Kept from the original decision, reused as-is: the **provenance identity set** (ISO
timestamp; library commit SHA + dirty flag; case id = skill + case name; per-harness name,
version, and model id — decision 5 of `docs/decisions/benchmark-metrics-and-comparison-design.md`),
the **commit-summary/keep-raw-artifacts-local** retention split (decision 3), and the
**deterministic report generator, no cross-case blend** principle (decision 6). All three
are carried into this spec's single-arm shape; §12 records the amendment this requires at
implementation time.

## 4. Presets

Two named presets, `smoke` and `full`, are the key design element. Both are distinguished
by **harness breadth**, and each separately carries an adjustable **trial count**:

| Preset | Harnesses | Trials | Purpose |
|---|---|---|---|
| `smoke` | `claude-code` | 1 | Fast wiring check. |
| `full` | `claude-code`, `codex`, `opencode` | 1 | Thorough hard-test — the real Task 12 milestone. |

- `smoke` runs only `claude-code`, because the 2026-07-15 findings established it is
  cwd-safe (unlike opencode, which escaped its fixture) and its isolation/auth model is
  the simplest of the three (`CLAUDE_CONFIG_DIR` only, per that design's §5,
  "Isolation model").
- `full` runs all three harnesses. This preset **is** the abandoned "all three harnesses
  live green on `okf-docs-setup`" milestone, done for real.
- A **trial**, in this single-arm spec, means one full execution of a case against one
  harness, judged once by the deterministic oracle. It is not a with/without pair — that
  concept is dropped (§3).
- Both presets, both dimensions (harness set and trial count), are defined in **a single
  config module** — the one source of truth for preset shape. Neither dimension requires
  touching flow logic to change.
- Rationale to record: at 1 trial with no comparison arm, trial count alone would make
  `smoke` and `full` identical, so **harness breadth** is what distinguishes them today.
  Trial count remains an independent, adjustable knob per preset — e.g., `full`'s trial
  count can be bumped later for reliability signal — it is just not what separates the two
  presets in this iteration.

## 5. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Where does the new flow live relative to #24's gating runner? | A new module wraps `runCase` (`tools/test-runner.mjs`); the gating runner itself is untouched — separation of concerns between "run one case once" (existing) and "run a preset's harness × trial matrix and report it" (new). |
| D2 | Where do preset definitions live? | One config module — single source of truth for both the harness set and the trial count of every preset (§4). No preset data duplicated into the flow module or the CLI. |
| D3 | Where do the committed artifacts live? | "Approach 2": summary JSON and rendered markdown report both live under `tools/benchmarks/` (§8), aligned with `scripts/release.mjs`'s existing `SUMMARIES_DIR = 'tools/benchmarks/summaries'` constant. |
| D4 | Does this add anything to CI? | No. Unchanged — local-only, per `docs/decisions/ci-and-automation-wiring.md` (§9). |
| D5 | What provenance scheme does the summary use? | The existing identity set from `docs/decisions/benchmark-metrics-and-comparison-design.md` decision 5, reused verbatim, collapsed to one arm (§3, §6). No parallel provenance scheme. |
| D6 | Does this run duplicate #24's `run.json`? | No — each trial's pass/fail and provenance come from #24's existing `run.json` shape (`writeRunJson` in `tools/test-runner.mjs`); the new summary aggregates those records rather than re-deriving them. |

## 6. Flow and components

**New — a benchmark-flow module under `tools/benchmarks/`** (exact file name and layout
are an implementation-time detail; e.g. `tools/benchmarks/run.mjs` alongside a
`tools/benchmarks/presets.mjs` config module per D2). It wraps, and never modifies, #24's
`runCase`/`runHarness` (`tools/test-runner.mjs`).

Flow, per invocation:

1. **Resolve preset → (harness set, trial count).** Look up the named preset (`smoke` or
   `full`) in the config module (§4, §5 D2).
2. **Execute.** For each harness in the resolved set, invoke the existing `runCase` the
   resolved number of `trials` times, collecting each trial's pass/fail and provenance —
   reusing `run.json` exactly as #24 already writes it (`writeRunJson`, §5 D5/D6). No new
   execution path, no new invocation-building logic.
3. **Aggregate into a committed summary JSON**, one per run, containing:
   - preset name and trial count;
   - per-harness, per-trial pass/fail marks;
   - a pass rate (per harness, and overall for the run);
   - the provenance identity set (§3): ISO timestamp; library commit SHA plus a dirty
     flag; case id (skill + case name); and, per harness, the harness name, version, and
     model id.
   - This is single-arm: there is no without-skill data anywhere in the summary (§3).
4. **Render a report.** A deterministic report generator reads the committed summary JSON
   and renders a per-case markdown report from it — rerunnable anywhere, zero inference,
   byte-identical output from identical input (verified by AC-3, §11). Per
   `docs/decisions/benchmark-metrics-and-comparison-design.md` decision 6, there is **no**
   blended cross-case score — a report is scoped to one case at a time, mirroring that
   decision's structural rule against means-hide-weak-tasks blending, even though there is
   now only one arm to not-blend.

## 7. Entry point

A new npm script, e.g.:

```
npm run bench -- <skill-name> --preset smoke|full [--trials <n>]
```

- `<skill-name>` and `--preset` are required; exactly one preset per invocation (no
  repeated `--preset`, unlike #24's repeatable `--harness` flag — the harness set here is
  derived entirely from the chosen preset, not passed independently).
- `--trials <n>` overrides the preset's trial count for this invocation only; it does not
  change the config module's defaults (§4, §5 D2) — the same override-vs-source-of-truth
  pattern #24 already uses for `--harness <id>[=<model>]` against a driver's
  `defaultModel`.
- Reuses `runCase` under the hood (§6); no new fixture, driver, or oracle logic.

## 8. Artifact homes

Decision: "Approach 2".

```
tools/benchmarks/
  summaries/   committed summary JSON, one per run (existing SUMMARIES_DIR constant,
               scripts/release.mjs) — the schema is §6 step 3.
  reports/     the deterministically-rendered per-case markdown report (§6 step 4);
               exact sub-layout is an implementation-time detail.
tools/runs/    unchanged, git-ignored: raw per-run transcripts and per-trial run.json
               (#24's existing artifact area — this spec adds no new raw-artifact home).
```

- The summary JSON and the rendered report are both **committed** to the repo; raw
  per-run transcripts stay git-ignored under `tools/runs/`, unchanged from #24.
- A thin OKF **Reference** concept in `docs/` points at these committed artifacts, so they
  are discoverable in the knowledge graph without churning it with per-run data (a
  `Reference` holds a summary and citations, per
  `docs/conventions/documentation.md`'s taxonomy — it would cite `tools/benchmarks/` by
  path rather than copy summary contents into `docs/`). Per the documentation lifecycle
  policy, `docs/superpowers/**` is excluded from the OKF bundle, so this design spec lives
  outside the bundle while the Reference itself lives inside it. **The Reference is
  created during implementation, not by this spec** — this design only requires that it
  exist and point at a stable path by the time the PR lands (§9).

## 9. CI

Unchanged. Per `docs/decisions/ci-and-automation-wiring.md`: the run spends real inference
and needs locally-provisioned, authenticated harness profiles (per
`docs/superpowers/specs/2026-07-15-test-runner-profile-isolation-design.md`), so it stays
local-only and is never wired into CI — consistent with that decision's "no inference in
CI, ever" rule. Report generation (§6 step 4) is deterministic and could in principle run
anywhere, but this spec does not add it to CI either; committing the summary JSON and
report is a manual step the developer performs after a local run, the same "commit
summaries, keep raw artifacts local" pattern as decision 3 of
`docs/decisions/benchmark-metrics-and-comparison-design.md`.

## 10. Design principles honored

- **SoC:** the new benchmark-flow module wraps #24's gating runner (`tools/test-runner.mjs`)
  and never modifies it (§5 D1, §6).
- **Single source of truth:** one config module defines both dimensions of both presets
  (§4, §5 D2); no preset data is duplicated into the CLI or the flow module.
- **KISS/YAGNI:** the explicitly-deferred list in §3 is deferred, not partially built — no
  inert regression-flag code path, no new baseline-promotion machinery. `scripts/release.mjs`'s
  existing `checkBenchmarkStaleness` stub is left untouched, per that same deferral.
- **Reuse over parallel schemes:** provenance comes from #24's existing `run.json` shape
  (`writeRunJson`) and the ADR's existing identity set (§3, §5 D5/D6) — no second
  provenance scheme is introduced.

## 11. Acceptance criteria

- **AC-1 (smoke):** a `smoke` run of the `okf-docs-setup` case on `claude-code` produces a
  committed summary JSON carrying the full provenance set (§6 step 3), plus a
  deterministically-rendered markdown report; the run's status is `executed` (not
  `skipped`), all case assertions pass, and guarded sources (`skills/ docs/ scripts/
  .claude/`, per #24's immutability guard) are unmodified.
- **AC-2 (full):** a `full` run produces the same across all three harnesses
  (`claude-code`, `codex`, `opencode`) — the real hard-test milestone (Task 12, §1): every
  harness status `executed`, all assertions pass, sources unmodified.
- **AC-3 (determinism):** the report generator reproduces byte-identical markdown from the
  same committed summary JSON, run twice, with no inference and no re-run of any harness.
- **AC-4 (discoverability):** the OKF Reference in `docs/` (§8) points at the committed
  artifacts from AC-1/AC-2.
- **AC-5 (CI):** CI is unchanged — no inference, no API keys, no schedules added anywhere
  in the CI configuration.

## 12. Docs ceremony

At implementation time this work requires:

- A dated amendment to `docs/decisions/benchmark-metrics-and-comparison-design.md`
  recording the rescope in §3 of this spec: the with/without comparison arm, the advisory
  regression flag, and baseline promotion are deferred (not implemented, not removed from
  the decision text — the decision itself is amended, never rewritten, per
  `docs/conventions/documentation.md`); `full`'s trial count is 1, not 5, in this
  iteration; the provenance identity set and the commit-summary/local-raw-artifact split
  are carried over unchanged.
- The new OKF Reference concept in `docs/` (§8), scaffolded with the `docs-add` skill,
  pointing at `tools/benchmarks/summaries/` and `tools/benchmarks/reports/`.
- A newest-first `docs/log.md` entry recording the amendment and the new Reference.
- No change to `docs/decisions/skill-testing-architecture.md` or
  `docs/decisions/ci-and-automation-wiring.md` is required by this spec — neither
  decision's text is contradicted by a single-arm, local-only flow that reuses #24's
  provenance shape.
