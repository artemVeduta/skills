// DENIED-APPROVAL case for the docs-sync migration subflow (issue #57, spec
// §docs-sync "Existing-source migration", AC8). Sibling of
// docs-sync-migrate-classify: this directory is `docs-sync-migrate-deny` but the
// manifest projects the real `docs-sync` skill, and it seeds the IDENTICAL shared
// baseline (../_docs-sync-migration.mjs). Where the classify case proves the gate
// holds with no approval turn at all, this proves that an EXPLICIT denial leaves
// every source and bundle file unchanged.
//
// Turn 1 (prompt.md) asks the skill to migrate the outside-bundle note and pause
// for approval; the follow-up (deny.md) DENIES the proposal. A correct run has
// written nothing before the denial (the gate) and writes nothing after it (a
// denial is not an approval), so the tree is byte-for-byte at baseline. The
// discriminators are git-unchanged plus a source file and a bundle destination
// both proven untouched.
import { migrationInputs, NOTE_PATH, CONCEPT_PATH } from '../_docs-sync-migration.mjs';

export default {
  skill: 'docs-sync',
  followUps: ['deny.md'],
  inputs: migrationInputs,
  assertions: [
    // AC8 headline — a denied proposal leaves ALL source and bundle files
    // unchanged: the tree sits EXACTLY at the baseline commit (nothing written,
    // staged, or committed) both before the denial (the gate) and after it.
    { type: 'git-unchanged' },

    // A source file is byte-preserved after the denial...
    { type: 'file-contains', path: NOTE_PATH, value: 'note-retry-design' },
    // ...and no bundle concept was written after the denial.
    { type: 'file-absent', path: CONCEPT_PATH },

    // Live evidence the run engaged the migration subflow.
    { type: 'output-contains', value: 'migrat' },

    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
