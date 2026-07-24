// APPROVED-IMPORT case for the docs-sync migration subflow (issue #57, spec
// §docs-sync "Existing-source migration", AC2/AC4/AC5/AC7). Sibling of the
// classify/deny cases: this directory is `docs-sync-migrate` but the manifest
// projects the real `docs-sync` skill, and it seeds the IDENTICAL shared baseline
// (../_docs-sync-migration.mjs). It proves the WRITE half of the subflow after an
// approval — and, crucially, that an imported source KEEPS its existing pointer
// because deletion was NOT approved.
//
// Turn 1 (prompt.md) proposes and PAUSES; the follow-up (approve.md) supplies a
// BARE go-ahead to import. approve.md deliberately does NOT tell the skill to keep
// the note (it names no deletion and no retention) — so the note staying put is
// the skill DERIVING AC5 ("a source outside the bundle keeps its existing pointer
// unless deletion was explicitly approved"), not a dictated step. On approval the
// skill files the concept from the note (citing the source symbol, not pasting
// it), the single reconciler registers it in the subsystem index and logs one net
// Creation, and the note remains at its path so `src/gateway.js`'s pointer stays
// valid. All in the working tree — nothing staged, committed, or pushed.
import { migrationInputs, NOTE_PATH, CONCEPT_PATH } from '../_docs-sync-migration.mjs';

export default {
  skill: 'docs-sync',
  followUps: ['approve.md'],
  inputs: migrationInputs,
  assertions: [
    // AC (write path): the approved import legitimately dirties the tree, so
    // git-uncommitted proves HEAD still equals the baseline commit, nothing is
    // staged, and no remote/PR was created.
    { type: 'git-uncommitted' },

    // AC2/AC7 — the concept is filed from the note (absent at baseline), is a
    // conformant Specification, and CITES the source symbol rather than pasting
    // executable truth verbatim.
    { type: 'file-exists', path: CONCEPT_PATH },
    { type: 'file-contains', path: CONCEPT_PATH, value: 'type: Specification' },
    { type: 'file-contains', path: CONCEPT_PATH, value: 'MAX_RETRIES' },

    // AC5 — the imported source KEEPS its pointer: deletion was not approved, so
    // the note still exists at its original path (a run that deleted it, or moved
    // it into the bundle destructively, would fail this). approve.md never said
    // "keep the note", so this proves the skill derived AC5 on its own.
    { type: 'file-exists', path: NOTE_PATH },
    { type: 'file-contains', path: NOTE_PATH, value: 'note-retry-design' },

    // AC4 — only the single reconciler changes shared bookkeeping: the concept is
    // registered in its parent subsystem index and logged as one net Creation
    // (`retries.md` and its Creation are both absent from these files at baseline).
    { type: 'file-contains', path: 'docs/payments/index.md', value: 'retries.md' },
    { type: 'file-contains', path: 'docs/payments/log.md', value: '**Creation**' },
    // No operational sync entry is written on the migration path either.
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: 'docs-sync ran' },

    // Live evidence the run engaged the migration subflow.
    { type: 'output-contains', value: 'migrat' },

    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
