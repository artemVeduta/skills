// SPLIT-KEPT-AS-OVERVIEW case for the docs-sync migration subflow (issue #57,
// spec §docs-sync "Existing-source migration", AC6 first clause). Sibling of
// docs-sync-migrate-split-remove: this directory is
// `docs-sync-migrate-split-overview` but the manifest projects the real
// `docs-sync` skill, and both split cases seed the IDENTICAL shared baseline
// (../_docs-sync-migration-split.mjs) — a single MULTI-topic ad-hoc note outside
// the bundle. They differ ONLY in the approval follow-up and the assertions.
//
// A read-only worker classifies `notes/payments-guide.md` as a SPLIT into two
// concepts (retries + refunds Specifications). This case exercises the fork where
// the user approves keeping the ORIGINAL as a stable entry point: after the split,
// the note remains at its path as a concise conformant OVERVIEW that points INTO
// the bundle at the new concepts. The discriminators are that both concepts exist
// (absent at baseline), the note still exists (a removal would fail this), and it
// now links into `specs/` (it was a standalone note at baseline, so a link into
// the bundle proves it was rewritten into an overview / entry point rather than
// left as-is).
import { splitInputs, GUIDE_PATH, RETRIES_CONCEPT, REFUNDS_CONCEPT } from '../_docs-sync-migration-split.mjs';

export default {
  skill: 'docs-sync',
  followUps: ['approve.md'],
  inputs: splitInputs,
  assertions: [
    // AC (write path): the approved split dirties the tree, so git-uncommitted
    // proves HEAD still equals the baseline, nothing is staged, no remote/PR.
    { type: 'git-uncommitted' },

    // The multi-topic source is split into two conformant concepts (both absent at
    // baseline), each citing its own source symbol rather than the note's prose.
    { type: 'file-exists', path: RETRIES_CONCEPT },
    { type: 'file-contains', path: RETRIES_CONCEPT, value: 'type: Specification' },
    { type: 'file-exists', path: REFUNDS_CONCEPT },
    { type: 'file-contains', path: REFUNDS_CONCEPT, value: 'type: Specification' },

    // AC6 (overview kept) — the source REMAINS at its path as a stable entry point
    // (a split that removed it would fail this)...
    { type: 'file-exists', path: GUIDE_PATH },
    // ...and it now points INTO the bundle at a new concept. At baseline the note
    // is standalone and links nowhere in docs/, so a link into specs/ proves it was
    // rewritten into a concise conformant overview rather than left unchanged.
    { type: 'file-contains', path: GUIDE_PATH, value: 'specs/retries.md' },

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
