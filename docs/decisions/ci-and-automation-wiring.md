---
type: Decision
title: CI and automation wiring
description: Push/PR CI runs only the free static checks and goes red solely on linter ERRORs; all inference-bearing runs stay local with no API keys or schedules in CI; the release script warns on stale benchmark summaries but proceeds.
timestamp: 2026-07-25
---

# CI and automation wiring

## Context

The [testing and benchmark architecture](/decisions/skill-testing-architecture.md)
made deterministic test runs gating-capable — the runner exits nonzero on assertion
failure — but explicitly deferred what CI actually runs, and when. The
[authoring conventions](/decisions/skill-authoring-conventions.md) likewise deferred
whether CI ever blocks on the linter, whose default invocation always exits 0, as does
the docs validator. The central force is cost: the linter and docs validator are free
pure-Node checks, but every per-skill test case is a real agent session driven through
a headless harness CLI, and per-harness contract tests multiply that across the
harness matrix — so anything CI runs beyond static checks needs model API keys in
Actions secrets and pays inference per trigger. The
[benchmark metrics decision](/decisions/benchmark-metrics-and-comparison-design.md)
already keeps benchmarks off the per-change path and has the release script promote
baselines.

## Decision

1. **Push/PR runs static checks only; red means linter ERRORs.** CI runs the skill
   linter and the docs validator on every push and pull request. The job fails only
   when the linter reports ERRORs — deterministic contract breaks such as frontmatter
   outside the allowlist, undeclared runtime skill invocations, cross-skill paths, or
   dependency cycles. Linter WARNs and all docs-validate output surface in the job
   output as advisory signal and never fail the job. Because the linter's default
   invocation always exits 0, CI derives red from ERROR presence (a strict flag or
   output parse — an implementation detail of the `tools/` linter).
2. **No inference in CI — ever.** Per-skill deterministic test cases, per-harness
   contract tests, and benchmarks run only locally via the `tools/` runner. CI holds
   no model API keys. With nothing left that a cron could usefully run, **no
   scheduled workflows exist**.
3. **"On-demand" means the local runner.** The on-demand tier from the testing
   architecture is the developer invoking the `tools/` runner — smoke preset while
   authoring cases, full preset for scores intended to be recorded — not a
   `workflow_dispatch` button.
4. **Release-time staleness guard, advisory.** Before promoting the baseline, the
   release script ([versioning policy](/decisions/versioning-and-release-policy.md))
   checks that committed full-preset summaries exist and match the current commit or
   a recent ancestor; if they are missing or stale it prints a warning and proceeds.
   The human stays the judge; the ritual never wedges.

## Alternatives

- **Nothing ever blocks (pure advisory CI)**: rejected — contract breaks like
  dependency cycles or undeclared invocations would land on main unnoticed, when
  detecting them is deterministic and free.
- **Skill test cases gate each PR**: rejected — puts agent sessions, API secrets, and
  stochastic execution on every push, exactly the per-change inference the testing
  architecture kept cheap runs free of.
- **CI-side on-demand or scheduled test runs** (`workflow_dispatch` + cron with keys
  in secrets): rejected — the drift-catching value does not justify the credential
  surface and idle cost for a solo library; local runs cover it.
- **Advisory test job on PR**: rejected — same keys and cost concern without even
  gating value in return.
- **Release script refuses on stale summaries**: rejected — every release would force
  a full benchmark run (10 sessions per case per harness), wedging the ritual.
- **No release-time check at all**: rejected — an ancient baseline gets promoted
  silently and every future comparison quietly rebases onto it.

## Consequences

- Per-change CI is instant, free, and trustworthy: red always means a deterministic
  contract break, never a stochastic test or a billing problem.
- Drift from model or harness updates is caught only when someone runs the local
  suite; the release script's staleness warning is the standing backstop nudge.
- The repo's CI surface is npm and Node only — no secrets management in Actions.
- The linter needs a CI-strict mode (exit nonzero on ERRORs) alongside its always-0
  default — a small requirement on the post-map `tools/` implementation.
- If the library outgrows solo maintenance, moving test runs into CI is an amendment
  to this decision (add keys and a `workflow_dispatch`), not a rearchitecture.

# Amendments

<!-- Append dated entries; never rewrite the decision above.
## YYYY-MM-DD — <short title>
<what changed and why; link the driving work>
-->

## 2026-07-24 — Docs validator became a strict gate

[Enforce minimal OKF errors through one strict validator contract](/decisions/okf-docs-strict-validation.md)
(#49) replaced the always-exit-0 docs validator with strict exits (`0`
clean/warnings-only, `1` hard errors, `2` malfunction), so the CI docs-validate
step now fails the job on hard bundle errors. Decision 1's "red means linter
ERRORs" widens to "red means linter ERRORs or docs-validate hard errors"; CI
remains static-only, free, and deterministic, so the cost rationale is
unchanged. The linter's own default advisory invocation is untouched.

## 2026-07-25 — The deterministic test suite is CI's third gating step

Push/PR CI runs a third gating step after the linter and the docs validator:
`npm test` (`.github/workflows/ci.yml`; the suite's file set is `package.json` →
`test`). It is the deterministic Node layer — installer and plugin-manifest tests,
the managed-channel generator checked against the committed `README.md`, the
advertised-versus-proven acceptance-matrix invariant, and test-runner and benchmark
units — so decision 1's red condition now reads "linter ERRORs, docs-validate hard
errors, or a deterministic `npm test` failure". Decision 1's rationale is unchanged:
the suite runs no model and CI still holds no keys, so per-change CI stays
static-only, free, and inference-free — decision 2 is intact. The matrix gate's
own mechanics live in
[skill testing and benchmark architecture](/decisions/skill-testing-architecture.md).
