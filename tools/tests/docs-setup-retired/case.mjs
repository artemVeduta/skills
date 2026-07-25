// Upgrade case: VERSIONLESS CONVERGENCE over retired managed surfaces (issue #65,
// spec §docs-setup "Versionless convergence" / references/enforcement.md §4).
// Projects the real `docs-setup` skill.
//
// All four retired-path classes live in ONE fixture, deliberately. They are
// independent PATHS, so a failure names the exact path and the class stays
// unambiguous — while a single run is the only way to prove the discriminating
// property, which is not "proven ones are removed" or "customized ones survive"
// separately but that setup applies BOTH judgements in the SAME plan without
// generalizing either one into the other:
//
//   PROVEN by historical fingerprint  `.claude/rules/docs-authoring.md`
//     — byte-identical to the exact bytes the suite shipped for that path before
//       this contract retired it → a REMOVAL in the normal, approved plan.
//   PROVEN by managed marker          `scripts/okf-docs-lint.mjs`
//     — a retired managed tooling surface the current manifest no longer lists,
//       carrying an owner marker naming this suite → also a removal. The second
//       proof route, which a fingerprint-only implementation would miss.
//   CUSTOMIZED                        `.claude/rules/docs-maintenance.md`
//     — the retired adapter after the user edited it: matches no fingerprint,
//       carries no owner marker → a CONFLICT needing an explicit keep/remove
//       decision. The user answers KEEP, and it must survive.
//   UNCERTAIN                         `.claude/skills/docs-validate/SKILL.md`
//     — a project-local helper copy whose provenance cannot be established →
//       also a conflict, and removal would additionally require confirmed
//       canonical discovery. The user answers KEEP, and it must survive.
//   ABSENT                            `.claude/skills/docs-add/**`
//     — never present → a silent no-op. Proven by the exact-change-set assertion:
//       no path under it appears in the change set, so setup neither created nor
//       reported work for a retired path that was not there.
//
// The fixture also carries REAL PROJECT KNOWLEDGE — an accepted Decision with
// amendments, its subsystem index, and an evolved root index and log. Every one of
// them is asserted byte-identical to its baseline content, which is the
// "every OKF knowledge file is preserved byte-for-byte by setup" guarantee stated
// as an observable rather than as prose. `git-only-paths` is the robust half: the
// change set must EQUAL the two proven removals, so a cleanup pass that also
// touched a concept, an index, or a log fails by name.
//
// Enforcement is deliberately absent from this fixture (no `.github/`, no hook
// manager) so both enforcement rows are clean skips and the change set stays
// exactly the tombstone removals.
import {
  currentInstall,
  installed,
  indexMd,
  RETIRED_DOCS_AUTHORING,
  RETIRED_MANAGED_TOOLING,
  CUSTOMIZED_RETIRED_ADAPTER,
  UNCERTAIN_LOCAL_HELPER,
} from '../_setup-assets.mjs';

// An accepted project Decision with dated amendment history — the exact material
// a "cleanup" must never touch.
const PROJECT_DECISION = `---
type: Decision
title: Retry payment authorization three times
description: Retry a failed authorization up to three times with exponential backoff before surfacing a failure.
timestamp: 2026-05-04
---

# Retry payment authorization three times

## Context

Authorization failures are dominated by transient gateway timeouts.
(SENTINEL project-decision-keep-me)

## Decision

Retry up to three times with exponential backoff.

## Consequences

Worst-case authorization latency rises; transient failures stop reaching users.

# Amendments

## 2026-06-11 — Backoff base raised to 400ms

Measured gateway recovery time was longer than the original 200ms base.
(SENTINEL project-amendment-keep-me)
`;

const PAYMENTS_INDEX = `# payments

Payment authorization and settlement. (SENTINEL project-index-keep-me)

## Decisions

- [Retry payment authorization three times](/payments/decisions/payment-retries.md) - three retries with exponential backoff
`;

// The root index and log as they look after the project accumulated content.
const EVOLVED_INDEX = indexMd.replace(
  '## Subsystems\n',
  '## Subsystems\n\n- [payments](/payments/index.md) - Payment authorization and settlement (SENTINEL evolved-root-index-keep-me)\n',
);
const EVOLVED_LOG = `${installed('docs/log.md')}\n## 2026-05-04\n\n- **Creation** [Retry payment authorization three times](/payments/decisions/payment-retries.md) - three retries with exponential backoff (SENTINEL evolved-log-keep-me)\n`;

// The OKF knowledge files whose bytes setup must preserve exactly.
const KNOWLEDGE_PATHS = [
  'docs/payments/decisions/payment-retries.md',
  'docs/payments/index.md',
  'docs/index.md',
  'docs/log.md',
  'docs/conventions/documentation.md',
  'docs/references/okf.md',
];

export default {
  skill: 'docs-setup',
  followUps: ['approve.md'],
  inputs: [
    ...currentInstall(),
    // Accumulated project knowledge (NOT upgrade-managed, never a cleanup target).
    { path: 'docs/payments/decisions/payment-retries.md', content: PROJECT_DECISION },
    { path: 'docs/payments/index.md', content: PAYMENTS_INDEX },
    { path: 'docs/index.md', content: EVOLVED_INDEX },
    { path: 'docs/log.md', content: EVOLVED_LOG },
    // PROVEN by historical fingerprint.
    { path: '.claude/rules/docs-authoring.md', content: RETIRED_DOCS_AUTHORING },
    // PROVEN by managed marker.
    { path: 'scripts/okf-docs-lint.mjs', content: RETIRED_MANAGED_TOOLING },
    // CUSTOMIZED — a conflict, kept by explicit decision.
    { path: '.claude/rules/docs-maintenance.md', content: CUSTOMIZED_RETIRED_ADAPTER },
    // UNCERTAIN — a conflict, kept by explicit decision.
    { path: '.claude/skills/docs-validate/SKILL.md', content: UNCERTAIN_LOCAL_HELPER },
    // (ABSENT: nothing is seeded under `.claude/skills/docs-add/`.)
  ],
  assertions: [
    // Live evidence from turn 1: the two proven removals were listed as ordinary
    // plan rows (visible and approved, never silent), and the two unprovable ones
    // were presented as conflicts needing an explicit keep/remove decision.
    { type: 'output-contains', value: 'docs-authoring' },
    { type: 'output-contains', value: 'okf-docs-lint' },
    { type: 'output-contains', value: 'docs-maintenance' },
    { type: 'output-contains', value: 'conflict' },

    // --- only PROVEN obsolete surfaces are removed -------------------------
    { type: 'file-absent', path: '.claude/rules/docs-authoring.md' },
    { type: 'file-absent', path: 'scripts/okf-docs-lint.mjs' },

    // --- customized and uncertain surfaces survive the explicit KEEP -------
    { type: 'file-exists', path: '.claude/rules/docs-maintenance.md' },
    { type: 'file-unchanged', path: '.claude/rules/docs-maintenance.md' },
    { type: 'file-exists', path: '.claude/skills/docs-validate/SKILL.md' },
    { type: 'file-unchanged', path: '.claude/skills/docs-validate/SKILL.md' },

    // --- every OKF knowledge file is byte-preserved -------------------------
    ...KNOWLEDGE_PATHS.map((path) => ({ type: 'file-unchanged', path })),
    // Named sentinels beside the byte proofs so a failure reads as "the accepted
    // amendment history was rewritten" rather than only "a file differs".
    { type: 'file-contains', path: 'docs/payments/decisions/payment-retries.md', value: 'project-amendment-keep-me' },
    { type: 'file-contains', path: 'docs/log.md', value: 'evolved-log-keep-me' },
    { type: 'file-contains', path: 'docs/index.md', value: 'evolved-root-index-keep-me' },

    // --- the exact change set ----------------------------------------------
    // EQUALS the two proven removals. This is what proves the ABSENT class is a
    // silent no-op (nothing appears for a path that was not there), that no
    // knowledge file was touched, and that no enforcement file was invented on a
    // repository with neither capability.
    { type: 'git-only-paths', paths: ['.claude/rules/docs-authoring.md', 'scripts/okf-docs-lint.mjs'] },
    { type: 'git-uncommitted' },
    { type: 'git-hooks-untouched' },

    { type: 'portable-contract' },
  ],
};
