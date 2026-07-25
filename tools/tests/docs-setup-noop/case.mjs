// No-op / idempotent-rerun case for docs-setup (issue #53; extended for the
// NEITHER enforcement cell in #65). Projects the real `docs-setup` skill. The
// fixture is a repository ALREADY at the current managed state: canonical
// `scripts/validate-docs.mjs` and its test byte-identical to the shipped assets,
// both `docs:validate` package scripts, a complete and current `docs/` bundle, the
// marked AGENTS.md router, and the exact CLAUDE.md shim. Nothing is missing and
// nothing differs.
//
// This is the single behavioral proof of three acceptance criteria at once:
//   (a) exact byte-current managed files are NO-OPS;
//   (b) a rerun over an already-current installation is IDEMPOTENT — it produces a
//       no-change plan; and
//   (c) NEITHER enforcement surface is available — no GitHub evidence of any kind
//       (no `.github/` tree and, like every fixture, no remote) and no hook manager
//       configuration at all — so BOTH are reported skips. That is the fourth cell
//       of the enforcement matrix, and this fixture is exactly it: adding a
//       separate "neither" case would duplicate this one's inputs to assert the
//       same git-unchanged outcome.
//
// It is a single read-only turn (no follow-up): docs-setup audits, recomputes
// state, classifies the target as current, and reports a no-change plan without
// writing anything. The headline oracle assertion is git-unchanged: on a current
// target the fixture stays EXACTLY at its baseline commit — the strongest proof
// that a rerun mutates nothing, invents no enforcement surface, and touches no Git
// state.
//
// Assets are read and per-install-substituted (date/project/pm) through the shared
// pure helper so the fixture is a genuinely current install; the helper declares no
// assertions, which this case still owns, and the install date is computed at build
// time (not hardcoded) so the no-op proof reproduces on any calendar day.
import { currentInstall, WORKFLOW_DEST, PREPUSH } from '../_setup-assets.mjs';

export default {
  skill: 'docs-setup',
  // No follow-up: a current target is a no-op, so there is nothing to approve —
  // turn 1 audits, classifies current, reports a no-change plan, and writes
  // nothing.
  followUps: [],
  // Every managed file present and current; no `.github/` tree and no hook manager
  // configuration, so the repository has NEITHER enforcement capability.
  inputs: currentInstall(),
  assertions: [
    // Live evidence: turn 1 recomputed state and classified the target as
    // current with a NO-CHANGE plan (idempotent rerun).
    { type: 'output-contains', value: 'no-change' },
    // Both enforcement surfaces were reported as skips naming what was looked for
    // — absence of evidence is a reported skip, never a prompt and never a guess.
    { type: 'output-contains', value: 'skip' },
    { type: 'output-contains', value: 'GitHub' },
    { type: 'output-contains', value: 'Husky' },
    // Headline: on a current target NOTHING is written — the fixture stays
    // EXACTLY at its baseline commit (no writes, no staging, no commit, no
    // remote). This proves the no-op classification, idempotency, AND that
    // neither enforcement surface was invented without the capability for it.
    { type: 'git-unchanged' },
    // Named explicitly so a failure says WHICH surface was wrongly created.
    { type: 'file-absent', path: WORKFLOW_DEST },
    { type: 'file-absent', path: PREPUSH },
    // And the missing capability was not worked around with native git plumbing.
    { type: 'git-hooks-untouched' },
    { type: 'portable-contract' },
  ],
};
