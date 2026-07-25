---
type: Reference
title: Benchmark and test run flow handoff
description: Zero-context handoff mapping the end-to-end skills-library test and benchmark run flow (#24 harness, #25 bench) as of the 2026-07-17 green runs.
timestamp: 2026-07-25
---

# Handoff — the full picture of what a benchmark/test run actually does

> **For a fresh agent:** this is a zero-context handoff for the skills-library test +
> report flow (#24 harness + #25 bench). It explains, end to end, what happens when a
> run executes, where everything lives, what was deviated/fixed to get it green, and
> where the improvement seams are. Read the code as the source of truth; this is the map.

> **Scope note (2026-07-25):** everything below is a dated snapshot of the 2026-07-17
> state and is retained as such; several of its present-tense claims have since been
> overtaken. The case identity it exercises throughout (`okf-docs-setup` — §2, §3, §9)
> was retired when the `docs-setup` identity migration landed, so those commands no
> longer resolve to a skill; `tools/tests/` now holds many case directories, several per
> skill. §3's "one case per skill, `case.name === skill`" invariant is LIFTED — a case
> manifest names the skill it projects, so one skill carries sibling case variants. §7's
> cited summary and report files were removed with the other stale artifacts of that
> migration. §2's harness file map has since grown a case loader, a cross-harness
> outcome-comparison module and a static portable-contract checker, and its oracle now
> exports a full assertion evaluator rather than only `allPassed`. §10's "PR not yet
> opened" is stale — the branch shipped as PR #27. The **Governing design** bullet's
> spec and plan paths were deleted from the bundle by the same commit that added this
> handoff. For current truth read
> [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md)
> (its dated amendments) and
> [Benchmark run artifacts](/references/benchmark-run-artifacts.md).

- **Repo:** `/Users/artemveduta/coding/skills` · **Branch:** `feat/24-test-runner` (one PR ships #24 + #25 together)
- **Status (2026-07-17):** smoke + full live runs are **GREEN**, committed. `npm test` 184/184; harness unit tests 53/53.
- **Governing design:** `docs/superpowers/specs/2026-07-16-benchmark-test-report-flow-design.md` (spec) and `docs/superpowers/plans/2026-07-16-benchmark-test-report-flow.md` (the executed plan). Decisions: `docs/decisions/skill-testing-architecture.md` (#24) and `docs/decisions/benchmark-metrics-and-comparison-design.md` (#25), both with 2026-07-17 amendments recording the go-green deviations.

---

## 1. What a run actually does (end to end)

Entry point: `npm run bench -- <skill> --preset smoke|full [--trials <n>]` → `tools/benchmarks/run.mjs` `runBench()`.

1. **Resolve the preset** (`tools/benchmarks/presets.mjs`): `smoke` = harnesses `['claude-code']`, trials `1`; `full` = `['claude-code','codex','opencode']`, trials `1`. Preset owns *harness set + trial count only*.
2. **Resolve per-harness model** (`tools/benchmarks/models.mjs`): the editable knob — `claude-code→claude-opus-4-8`, `codex→gpt-5.6-sol`, `opencode→opencode-go/deepseek-v4-pro`. `runBench` builds `harnessSelections = harnesses.map(id => ({ id, model: modelFor(id) }))`.
3. **For each trial, call `runCase(skill, { harnessSelections, runsRoot, runId })`** from `tools/test-runner.mjs` (#24, wrapped — the bench imports and calls it). Per harness, runCase:
   - Creates a **disposable fixture**: `mkdtemp(os.tmpdir(), 'tr-fx-…')`, now **`git init` + baseline commit** (`tools/test-runner/fixture.mjs`), seeded with the case's `inputs` (for okf-docs-setup: a minimal `package.json`).
   - Spawns the harness CLI with **`cwd = fixture`** and a per-harness isolated profile env (`tools/test-runner/profiles.mjs`: `CLAUDE_CONFIG_DIR` / `CODEX_HOME` / opencode `XDG_*`), passing the **prompt** (`tools/tests/<skill>/prompt.md`) and **`--model`** (`tools/test-runner/drivers.mjs` `buildInvocation`). opencode additionally gets **`run --dir <fixture>`** (the fixture-escape fix).
   - Captures the harness's stdout → `transcript.json`, and writes `run.json` provenance (`id, status, model, harnessVersion, invocation, exitStatus, timedOut, skipReason`).
   - Runs the case's **deterministic assertions** (`tools/tests/<skill>/case.mjs`) against the fixture's real file state → `assertions.json`. This is the **only pass/fail oracle**.
   - Computes **`sourcesUnmodified`**: the immutability guard confirming the guarded trees (`skills docs scripts .claude` in the real repo) were byte-unchanged — proves no fixture escape.
4. **Aggregate** (`tools/benchmarks/summary.mjs`): reads each leg's `run.json` for `model`/`version`, combines with the in-memory pass verdict + `sourcesUnmodified` into the single-arm summary shape. `trialPassed(leg)` = `status==='executed' && sourcesUnmodified===true && assertions non-empty && allPassed(assertions)`.
5. **Render** (`tools/benchmarks/report.mjs`): deterministic, byte-identical markdown from the summary (no Date/git/re-run).
6. **Persist + clean up**: writes committed `tools/benchmarks/summaries/<skill>-<preset>-<runId>.json` + `reports/…md`; `rm`s each fixture (in-process callers own cleanup). Raw per-run `transcript/assertions/run.json` stay git-ignored under `tools/runs/`.

**Key design point:** the transcript is *informational only*. An agent can claim success while doing nothing (opencode literally did during the escape). The verdict is purely the deterministic assertions + `sourcesUnmodified`.

---

## 2. File map

**Bench flow (`tools/benchmarks/`, #25):** `presets.mjs` (harness set + trials), `models.mjs` (per-harness model knob), `provenance.mjs` (git timestamp/commit/dirty), `summary.mjs` (aggregate), `report.mjs` (render), `run.mjs` (`parseBenchArgs` + `runBench` + CLI). Each has a `*.test.mjs`. Committed artifacts: `summaries/`, `reports/`.

**Harness (`tools/test-runner.mjs` + `tools/test-runner/`, #24):** `runner.mjs` (spawn + preflight ladder), `drivers.mjs` (per-harness descriptors / `buildInvocation` / default models), `profiles.mjs` (`profileEnvFor` isolation env), `fixture.mjs` (`buildFixture` → git-init'd tmpdir), `oracle.mjs` (`allPassed`), `report.mjs` (`exitCodeFor`).

**Cases:** `tools/tests/<skill>/{prompt.md, case.mjs}`. Today only `okf-docs-setup`.

**Auth/provisioning:** `scripts/setup-test-profiles.sh` (verify/provision the three profiles under `~/.skills-test-profiles/`), `npm run test:auth -- <harness>`.

---

## 3. The one case today: `okf-docs-setup`

- **prompt.md:** instructs the agent to install an OKF v0.1 docs bundle into the fixture (project `FixtureProj`, npm, glob `src/**`, no subsystems), copy verbatim assets, apply placeholder substitutions, add two package.json scripts, do NOT touch validate-docs.* / CLAUDE.md.
- **case.mjs:** `inputs` = one seed `package.json`; **16 assertions** = 10 `file-exists` (docs/*, scripts/validate-docs.*, .claude/rules/*, .claude/skills/docs-*/SKILL.md), 2 `file-equals` (validate-docs.{mjs,test.mjs} byte-identical to the shipped assets), 2 `file-not-contains` (placeholders substituted), 2 `file-contains` (package.json scripts).
- **Invariant:** one case per skill, `case.name === skill` (see plan "Assumptions"). Adding a 2nd case per skill needs a case id distinct from the skill name.

---

## 4. Models & auth (the gotchas that cost the most time)

- **Model ids must be exactly what the installed CLI serves.** claude-code uses **dashed** ids (`claude-opus-4-8`, NOT dotted `claude-opus-4.8` — the original malformed default). codex `gpt-5.6-sol` needs **codex CLI ≥ 0.144** (0.139 only served 5.5/5.4). opencode needs the **`opencode-go/` provider prefix**. Change models only in `tools/benchmarks/models.mjs`.
- **Auth is per test-profile under `~/.skills-test-profiles/`.** codex/opencode use file-based `auth.json`. **claude-code auth lives inside the profile's `.claude.json`** (no separate creds file) and is now verified by `CLAUDE_CONFIG_DIR=<profile> claude auth status --json` → `"loggedIn": true` — NOT the old macOS-Keychain existence check, which false-positived from the developer's real login while a headless profile run was "Not logged in". Re-auth with `npm run test:auth -- <harness>` (interactive for claude-code).
- Runs are **local-only** (real inference + local auth), never CI.

---

## 5. The opencode fixture-escape (root cause + fix) — important

opencode's `run` does **not** confine to process cwd. It resolves a project by (a) walking UP for a `.git` dir and (b) a persistent per-profile known-projects registry (`opencode.db`). A non-git tmpdir fixture made it fall back to a **stale real-repo project** (seeded when `opencode auth login` had run with cwd = repo root) and **write into the real repo trees** while reporting fabricated success — the 2026-07-14 escape class, invisible to the live-daemon preflight (that checks a running process, not stale state).

**Fix (a deliberate, documented #24 harness change — see the skill-testing ADR 2026-07-17 amendment):**
- `tools/test-runner/drivers.mjs`: opencode args → `['run','--auto','--dir',fixtureRoot,'-m',model,prompt]`.
- `tools/test-runner/fixture.mjs`: `git init` + baseline commit each fixture so opencode binds its worktree to the fixture.
- `scripts/setup-test-profiles.sh`: run login from a throwaway cwd; new `check_opencode_no_repo_project` guard fails if the registry holds a repo-rooted project.

Full detail in the memory note `opencode-fixture-escape` and the ADR amendment.

---

## 6. Deviations from the original plan (all documented)

The committed plan/spec had `model: null` and a hard **wrap-never-modify** constraint on `tools/test-runner/`. To reach green we deliberately:
1. Added the **per-harness model knob** (`models.mjs`) instead of `model: null`.
2. **Fixed the #24 harness** (`drivers.mjs` `--dir` + `fixture.mjs` git-init) — justified as a genuine correctness/safety bug (repo damage), not a feature reach-in.
3. Switched claude-code auth to the **`auth status --json`** verdict.

All three are recorded via the docs amend-ceremony (ADR amendments dated 2026-07-17 + `docs/log.md`).

---

## 7. Current results (full run)

`overallPassRate: 1` (3/3), preset `full`, 1 trial. Every harness `status:executed, pass:true, sourcesUnmodified:true`:

| Harness | Model | Version |
|---|---|---|
| claude-code | claude-opus-4-8 | 2.1.211 |
| codex | gpt-5.6-sol | codex-cli 0.144.5 |
| opencode | opencode-go/deepseek-v4-pro | 1.18.0 |

Artifacts: `tools/benchmarks/summaries/okf-docs-setup-{smoke-1784239465898,full-1784241955543}.json` (+ matching reports).

---

## 8. Improvement seams (for "improve this")

- **Promote the opencode stale-state guard to a per-run preflight rung** in `runner.mjs` (currently only in `setup-test-profiles.sh`, so it only runs at provisioning, not before every run).
- **Confirm whether `--dir` alone suffices** vs. needing the fixture git-init (both were applied together; not isolated).
- **Multi-trial + threshold:** the `--trials` knob exists but both presets pin 1; >1 trial + a pass-rate gate gives statistical signal against flaky agents.
- **Re-enable the deferred single-arm scope** (per the benchmark ADR): the without-skill comparison arm, with/without delta, advisory regression flag, baseline promotion at release.
- **More cases/skills** (currently only `okf-docs-setup`); mind the `case.name === skill` invariant when adding a 2nd case per skill.
- **CI story:** runs are local-only (real inference + auth). A mocked/recorded-transcript path for CI is an open question.
- **Per-run model override** (CLI flag) instead of only editing `models.mjs`; the harness already supports a `--harness id=model` seam.
- **Cost:** opencode `deepseek-v4-pro` is dollar-metered — consider `deepseek-v4-flash` for smoke.
- **Provenance `dirty` flag** trips on any untracked working-tree file (e.g. the plan doc); could ignore excluded/untracked docs.

---

## 9. How to run / verify

```
npm test                                             # unit suite (184 tests)
node --test tools/test-runner/*.test.mjs             # harness units (53)
bash scripts/setup-test-profiles.sh                  # verify all 3 profiles authed (+ opencode guard)
npm run bench -- okf-docs-setup --preset smoke       # live claude-code (real inference)
npm run bench -- okf-docs-setup --preset full        # live all three (real inference)
```

Assert AC after a run: read the newest `tools/benchmarks/summaries/okf-docs-setup-<preset>-*.json` and check `overallPassRate === 1` + every harness `pass && sourcesUnmodified`.

---

## 10. Housekeeping / loose ends

- `docs/superpowers/plans/2026-07-16-benchmark-test-report-flow.md` is **untracked** (no task committed it; its sibling spec is committed). Commit or leave.
- A one-time `opencode.db.bak-pre-purge-*` backup sits in the opencode test profile (host state, not in the repo) — safe to delete.
- Branch is PR-ready; PR not yet opened (base `main`).

## Commit trail (this session, on feat/24-test-runner)
`29dcbda` presets · `c3530a9` provenance · `6d33711` summary · `c5f4baa` report · `78aae84` run+npm wiring · `79672f2` ADR single-arm amendment · `59407bc` model knob · `a007fed` honest claude-code auth · `5edfd56` **smoke AC-1** · `e3537a3` opencode login-cwd isolation + guard · `a0c83b0` **opencode --dir + git-init fixture** · `20e5a8f` **full AC-2** · `6acea0e` Task 9 Reference · `7f00d3e` skill-testing ADR (escape fix) · `c4266d2` benchmark ADR (model knob + auth).
