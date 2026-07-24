// Reversal-GATE case for docs-sync (issue #55, spec §docs-sync "compaction",
// branch mode, AC7 first clause). Sibling of docs-sync-supersede: this directory
// is `docs-sync-reversal-gate` but the manifest projects the real `docs-sync`
// skill. It shares the exact token-store baseline with the write-path case (the
// accepted "store tokens in PostgreSQL" decision that rejected Redis, plus the
// unstaged source reversal to Redis — see ../_docs-sync-token-store.mjs).
//
// This case proves the half the write-path case CANNOT: that docs-sync
// RECOGNIZES the material reversal ON ITS OWN and refuses to reconcile it
// silently, WITHOUT being told to pause. It is a SINGLE turn (no follow-up): the
// prompt merely asks to reconcile in branch mode against `master` — the SAME
// "go ahead and reconcile" framing as the docs-sync-reconcile write case, and it
// names neither "supersede" nor "reversal" nor "confirm". A model that just
// follows instructions (the #54 reconcile behaviour) would silently rewrite the
// accepted decision to say Redis; the AC7 rule requires it to instead pause for
// confirmation. So the discriminators below are: (1) the accepted decision is
// NOT silently edited (selected-postgres retained, not superseded), (2) no
// replacement decision and no Deprecation are written before confirmation, and
// (3) the single-turn output shows the skill surfaced the supersession — proof
// of autonomous recognition, since `output` here is turn-1 stdout only.
import { tokenStoreInputs, STORAGE_PATH, REPLACEMENT_PATH } from '../_docs-sync-token-store.mjs';

export default {
  skill: 'docs-sync',
  // Deliberately single-turn: no `followUps`. The pause must be the skill's own,
  // not a scripted "wait for my go-ahead".
  inputs: tokenStoreInputs,
  assertions: [
    // AC8 — the gate legitimately leaves Git untouched: whether the skill paused
    // with no writes or wrote only a proposal, HEAD still equals the baseline,
    // nothing is staged, and no remote/PR exists.
    { type: 'git-uncommitted' },

    // AC7 (no silent edit) — the accepted decision is UNCHANGED without
    // confirmation: its original selected alternative is retained and it was NOT
    // marked superseded. A model that silently reconciled the reversal (the
    // anti-pattern) would have rewritten or superseded it here.
    { type: 'file-contains', path: STORAGE_PATH, value: 'selected-postgres' },
    { type: 'file-not-contains', path: STORAGE_PATH, value: 'status: superseded' },

    // AC7 (requires confirmation) — nothing that belongs to the supersession is
    // written before the user confirms: no replacement decision is filed...
    { type: 'file-absent', path: REPLACEMENT_PATH },
    // ...and no Deprecation is logged.
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: '**Deprecation**' },
    // The already-merged Creation entry is left exactly as it was (AC4).
    { type: 'file-contains', path: 'docs/payments/log.md', value: 'target-log-creation' },

    // AC3 — no operational sync/debt entry is written on the gate path either.
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: 'docs-sync ran' },
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: '**Noted**' },

    // Autonomous recognition — this is a SINGLE turn, so `output` is turn-1 stdout
    // only (test-runner joins turns). The prompt names neither "supersede" nor
    // "reversal", so the skill raising a supersession here is proof it recognized
    // the reversal on its own rather than following a dictated procedure.
    { type: 'output-contains', value: 'supersed' },

    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
