// Read-only CLASSIFICATION case for the docs-sync migration subflow (issue #57,
// spec §docs-sync "Existing-source migration"). Sibling of the #54/#55/#56 cases:
// this directory is `docs-sync-migrate-classify` but the manifest projects the
// real `docs-sync` skill, so one skill carries branch/bundle/compaction and this
// migration case. It proves the FIRST gate of the subflow: read-only workers
// classify the candidate and the coordinator presents a complete proposal, but
// NOTHING is written before approval.
//
// The repo has a durable design note outside the bundle (`notes/retry-design.md`)
// that a worker should classify as an import and propose filing to
// `docs/payments/specs/retries.md`. This case is SINGLE-turn: the prompt asks the
// skill to look at the candidate and tell the user the plan WITHOUT changing
// anything, so a correct run classifies + proposes + pauses. The discriminators
// are that the tree is byte-for-byte at baseline (git-unchanged), the note is
// untouched, and the proposed concept was NOT written — i.e. classification is
// genuinely read-only. The shared baseline lives in ../_docs-sync-migration.mjs.
import { migrationInputs, NOTE_PATH, CONCEPT_PATH } from '../_docs-sync-migration.mjs';

export default {
  skill: 'docs-sync',
  // Deliberately single-turn: no `followUps`. With no approval, the gate holds and
  // nothing is written — proving classification is read-only on its own.
  inputs: migrationInputs,
  assertions: [
    // AC1/AC3 headline — read-only classification: with no approval, nothing is
    // written, staged, or committed, so the tree sits EXACTLY at the baseline
    // commit. A worker that wrote a concept (or the coordinator that reconciled
    // one) during classification would fail this.
    { type: 'git-unchanged' },

    // The candidate ad-hoc doc is byte-preserved during classification.
    { type: 'file-contains', path: NOTE_PATH, value: 'note-retry-design' },

    // No concept was filed before approval — the proposed destination is absent.
    { type: 'file-absent', path: CONCEPT_PATH },

    // Live evidence the run engaged the MIGRATION subflow (not branch/bundle
    // reconciliation) — the prompt frames the work as migrating existing docs.
    { type: 'output-contains', value: 'migrat' },

    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
