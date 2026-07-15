# Orchestrator Run Analytics — #24 Test-Runner Tracer Bullet

> Meta-report of how the `feat/24-test-runner` implementation was executed under the
> **orchestrator** skill: what the control plane did vs. delegated, how many sub-agents ran,
> which models, and whether a dynamic workflow was used. Date: 2026-07-15.
> Companion: `2026-07-15-test-runner-e2e-findings-and-fixes.md`.

---

## 1. Mode & mechanism

- **Skill:** `orchestrator` (activated at session start; the current session acted as control
  plane only for the whole run).
- **Delegation mechanism:** **Sub-agents via the `Agent` tool** — **NOT** the dynamic `Workflow`
  tool.
- **Topology:** flat (no sub-agent spawned children). **Sequential** dispatch for the 13
  build/verify tasks, with a **single parallel pair** at the end (cleanup ∥ investigation).
- **Approval gates:** 4 `AskUserQuestion` rounds (9 questions total) before/at each scope change.

### Why sub-agents, not a dynamic Workflow
The orchestrator harness table prefers a dynamic workflow when available, and it *was* available.
It was deliberately **not** used, and the user approved this, because:
1. **Per-task review checkpoints.** `executing-plans` wants verification between tasks; the
   control plane inspected each worker's test evidence + commit hash before dispatching the next.
   A deterministic end-to-end workflow would have removed those human-visible checkpoints.
2. **Sequential git commits in one shared working tree.** Every task commits to the same branch;
   concurrent workflow agents in a shared tree would race on `git`. Sequential sub-agents keep a
   clean, linear history (one commit per task).
3. **Adaptive replanning.** The live e2e leg surfaced a defect mid-run; the control plane stopped,
   re-planned, and opened new approval gates — easier to steer turn-by-turn than to encode up front.

---

## 2. Agent roster

13 sub-agents total. Models: **9 Sonnet 5**, **4 Opus 4.8**. All `general-purpose`, flat topology.

| # | Worker | Scope | Model | Outcome | Sub-agent tokens | Tool uses | Duration |
|---|---|---|---|---|---:|---:|---:|
| 1 | A | Task 1 — drivers | Sonnet | ✅ `e1fadbe` | 53,515 | 13 | 71.8s |
| 2 | B | Task 2 — fixture | Sonnet | ✅ `2ba9fd3` | 54,495 | 11 | 75.6s |
| 3 | C | Task 3 — oracle | Sonnet | ✅ `7775d99` | 51,575 | 10 | 57.7s |
| 4 | D | Task 4 — case-loader | Sonnet | ✅ `727891c` | 50,258 | 10 | 53.2s |
| 5 | E | Task 5 — okf case | Sonnet | ✅ `04bbd67` | 51,542 | 12 | 60.3s |
| 6 | F | Task 6 — runner/executor | Sonnet | ✅ `600ae75` | 55,919 | 10 | 59.8s |
| 7 | G | Task 7 — report/exit-code | Sonnet | ✅ `12dc838` | 56,789 | 13 | 67.9s |
| 8 | H | Task 8 — CLI integration | **Opus** | ✅ `570e12c` | 68,911 | 20 | 178.0s |
| 9 | I | Task 9 — linter WARN | Sonnet | ✅ `780bd81` | 47,466 | 18 | 86.1s |
| 10 | J | Task 10 — docs reconciliation | **Opus** | ✅ `d5f14df` | 67,365 | 18 | 118.2s |
| 11 | K | Final verify + live e2e | **Opus** | ⚠ found defect | 55,656 | 21 | 678.1s |
| 12 | Cleanup | kill daemon + verify tree | Sonnet | ✅ clean | 24,577 | 12 | 33.3s |
| 13 | Investigate | isolation research (read-only) | **Opus** | ✅ design proposal | 77,660 | 28 | 470.8s |

### Totals
- **Sub-agent tokens:** **715,728** (Sonnet 446,136 across 9; Opus 269,592 across 4).
- **Tool uses:** 196.
- **Cumulative agent runtime:** ~2,011 s (~33.5 min) of agent work (wall-clock lower — the last
  two ran in parallel).
- Averages: Sonnet ≈ 49.6k tok / agent; Opus ≈ 67.4k tok / agent.

---

## 3. Model-selection rationale

Chosen per the orchestrator's "cheapest capable model" rule:

- **Sonnet 5 (mechanical TDD transcription):** Tasks 1–7 and 9 shipped complete source + exact
  test commands in the plan — the worker's job was verbatim application + running the stated
  verifications + one commit. Sonnet reliably handles precise edits (incl. edits to existing
  `package.json` / `lint-skills.mjs` / `.gitignore`) with TDD gates catching drift. The cleanup
  worker (targeted `kill` + `git` verification) was also mechanical → Sonnet.
- **Opus 4.8 (integration / judgment / research):**
  - Task 8 — wires six modules, owns the `HarnessResult` tagged-union contract that must stay in
    sync, runs the full suite (higher blast radius).
  - Task 10 — a *gated* judgment call ("did the build materially diverge from the ADR?") plus the
    docs update ceremony.
  - Final verification — interprets a live, ambiguous e2e (auth vs. permission vs. skill failure).
  - Investigation — open-ended research + design synthesis across two CLIs' behavior.

**Reasoning-effort note:** the `Agent` tool exposes a per-agent *model* override but **not** a
separate reasoning-effort control — disclosed to the user rather than claimed. (A dynamic
`Workflow` would have exposed per-agent `effort`; it was not used, see §1.)

---

## 4. Control-plane vs. delegated boundary

**Done directly by the control plane (allowed: clarify, discover, plan, approve, coordinate,
synthesize):**
- Read the plan spec + the `docs-authoring` rule (understanding the request).
- Built and revised the delegation plan; ran the 4 approval gates.
- Maintained the task tracker (11 build tasks + 2 remediation tasks).
- Verified each worker's evidence (test output, commit hash, `git status`) between dispatches.
- Synthesized status reports and the two hand-off documents (see note below).

**Delegated to sub-agents (never done directly):** all file creation/editing, all test runs, all
`git` operations (incl. branch creation), the live inference e2e, the read-only isolation
research, and process cleanup.

**One deliberate in-session exception:** the two hand-off Markdown docs
(`…-findings-and-fixes.md` and this analytics doc) were **authored by the control plane**, not
delegated. Rationale: they are *synthesis* artifacts — the orchestrator's defined role is to
"synthesize the final answer from returned results and evidence," and this analytics doc is
self-knowledge only the control plane holds. Delegating would have required embedding the entire
finished content in a worker prompt (authoring it anyway) with added transcription-error surface
and zero quality gain. All task-*domain* work stayed delegated.

---

## 5. Timeline of approval gates & replanning

1. **Gate 1 — initial delegation plan.** Presented mechanism/workers/flow/runtime/rationale; asked
   3 questions (branch target, sequential vs. parallel, how to handle the inference leg).
   Decisions: new branch off `feat/docs`; sequential; run the e2e leg.
2. **Sequential build.** Workers A→J dispatched one at a time; control plane verified each commit.
   Task 8's inference-only Step 10 was intentionally *split out* of the build worker.
3. **Gate 2 — after live e2e failure.** Worker K surfaced the opencode escape + auth failures.
   Control plane STOPPED (per `executing-plans`: don't push through a blocker) and asked 3
   questions (cleanup, opencode approach, prove-PASS). Decisions: clean up; harden opencode; user
   can auth via subscription.
4. **Parallel remediation.** Cleanup ∥ read-only investigation (the only concurrent dispatch).
5. **Gate 3 — proposed fix.** Presented root causes + fix; asked 2 questions (claude auth model;
   opencode hardening depth). Decisions: inherit host auth; gate + preflight + defense-in-depth.
6. **Gate 4 — codex.** User asked "what about codex?"; asked 1 question. Decision: fix codex too.
7. **Pivot.** Before implementing fixes, the user redirected to produce these hand-off docs and
   defer implementation/verification to a fresh brainstorming session.

---

## 6. Observations / lessons

- **The gate did its job.** The one defect that reached a live run (opencode escape) was caught by
  the deterministic immutability guard and gated FAIL — the "defense-in-depth atop the out-of-repo
  fixture" the plan argued for paid off with real, committed files at stake.
- **Prescriptive plans delegate cheaply.** Because the plan carried full source + exact
  verifications, mechanical tasks ran on Sonnet at ~50k tokens each with zero discrepancies — the
  TDD red→green gates made each worker self-checking.
- **Inference-only steps must be isolated.** Splitting Task 8 Step 10 out of the build worker kept
  the entire build path inference-free and CI-safe; the single inference leg was run last, under
  its own gate, and is where the real-world integration problems surfaced (as intended).
- **"Verification" is not "tests pass."** Phase A was 132/132 green, yet the live e2e exposed that
  two of three harnesses never authenticated and the third escaped isolation — problems no unit
  test could catch. The costly, judgment-heavy Opus verification/investigation pair earned their
  tokens.
