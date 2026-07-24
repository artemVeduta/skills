// SPLIT-WITH-APPROVED-REMOVAL case for the docs-sync migration subflow (issue
// #57, spec §docs-sync "Existing-source migration", AC6 second clause). Sibling of
// docs-sync-migrate-split-overview: this directory is
// `docs-sync-migrate-split-remove` but the manifest projects the real `docs-sync`
// skill, and both split cases seed the IDENTICAL shared baseline
// (../_docs-sync-migration-split.mjs). They differ ONLY in the approval follow-up
// and the assertions.
//
// A read-only worker classifies `notes/payments-guide.md` as a SPLIT into two
// concepts (retries + refunds Specifications). This case exercises the OTHER fork:
// the user judges the original is NOT a useful standalone entry point and approves
// REMOVING it. After the split, the note is gone and its removal is recorded as
// part of the migration. The discriminators vs the overview sibling are that the
// note is ABSENT (removed) and the run's report records the removal.
import { splitInputs, GUIDE_PATH, RETRIES_CONCEPT, REFUNDS_CONCEPT } from '../_docs-sync-migration-split.mjs';

export default {
  skill: 'docs-sync',
  followUps: ['approve.md'],
  inputs: splitInputs,
  assertions: [
    // AC (write path): the approved split + removal dirties the tree, so
    // git-uncommitted proves HEAD still equals the baseline, nothing is staged,
    // no remote/PR was created.
    { type: 'git-uncommitted' },

    // The multi-topic source is split into two conformant concepts (both absent at
    // baseline), same as the overview sibling.
    { type: 'file-exists', path: RETRIES_CONCEPT },
    { type: 'file-contains', path: RETRIES_CONCEPT, value: 'type: Specification' },
    { type: 'file-exists', path: REFUNDS_CONCEPT },
    { type: 'file-contains', path: REFUNDS_CONCEPT, value: 'type: Specification' },

    // AC6 (approved removal) — the source is REMOVED (absent), the discriminator vs
    // the overview sibling which keeps it as a stable entry point.
    { type: 'file-absent', path: GUIDE_PATH },
    // ...and its removal is recorded as part of the migration (the run reports the
    // removed source disposition, not a silent delete).
    { type: 'output-contains', value: 'remov' },

    // AC4 — the single reconciler registered BOTH new concepts in the subsystem
    // index (absent at baseline).
    { type: 'file-contains', path: 'docs/payments/index.md', value: 'retries.md' },
    { type: 'file-contains', path: 'docs/payments/index.md', value: 'refunds.md' },

    // Live evidence the run engaged the migration subflow.
    { type: 'output-contains', value: 'migrat' },

    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
