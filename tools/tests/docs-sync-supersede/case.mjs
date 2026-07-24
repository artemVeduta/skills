// Supersession WRITE case for docs-sync (issue #55, spec §docs-sync
// "compaction", branch mode). Sibling of the compaction case: this directory is
// `docs-sync-supersede` but the manifest projects the real `docs-sync` skill
// (via `skill` below). Where docs-sync-compact proves ordinary drafting residue
// folds silently into the accepted net state, this proves the WRITE half of the
// ONE change that crosses the accepted-state boundary and must NOT be a silent
// edit: a material REVERSAL of a Decision's selected alternative (AC7). The
// AUTONOMOUS half — that the skill RECOGNIZES the reversal on its own and
// refuses to reconcile it silently, before any confirmation — is proven by the
// single-turn docs-sync-reversal-gate sibling; together they prove AC7's two
// clauses (requires confirmation; then a linked supersession, not a silent edit).
//
// The branch reverses an accepted decision — "store payment tokens in
// PostgreSQL" — by switching the source (`src/token-store.js`) to Redis. Redis
// is the alternative the original decision explicitly REJECTED, so this changes
// the selected alternative: a reversal, not an ordinary refinement. On the
// confirmed path docs-sync must create a LINKED SUPERSESSION — mark the old
// decision `status: superseded` + `superseded_by`, file a replacement decision,
// retain the old content, and log one Deprecation — rather than editing the
// accepted record in place.
//
// The confirmation gate uses the plan/approval seam (like docs-add-approve):
// turn 1 (prompt.md) proposes and PAUSES; the follow-up (confirm.md) supplies a
// BARE go-ahead. confirm.md deliberately does NOT dictate the supersession
// MECHANISM (it names only the user-owned replacement PATH — as docs-add directs
// its target); the skill must DERIVE supersede-vs-edit, the link, retaining the
// old content, and the single Deprecation. So the state assertions below test
// what the SKILL taught, not a procedure the user spelled out. The shared
// token-store baseline (accepted PostgreSQL decision + the unstaged Redis
// reversal) lives in ../_docs-sync-token-store.mjs, seeded verbatim by the
// reversal-gate sibling too.
import { tokenStoreInputs, STORAGE_PATH, REPLACEMENT_PATH } from '../_docs-sync-token-store.mjs';

export default {
  skill: 'docs-sync',
  followUps: ['confirm.md'],
  inputs: tokenStoreInputs,
  assertions: [
    // Headline (AC8, write path after confirmation): the supersession dirties the
    // tree, so git-uncommitted proves HEAD still equals the baseline commit,
    // nothing is staged, and no remote/PR was created.
    { type: 'git-uncommitted' },

    // AC7 — linked supersession, NOT a silent edit. The old decision is marked
    // superseded and linked to the replacement...
    { type: 'file-contains', path: STORAGE_PATH, value: 'status: superseded' },
    { type: 'file-contains', path: STORAGE_PATH, value: 'superseded_by' },
    { type: 'file-contains', path: STORAGE_PATH, value: 'token-store-redis.md' },
    // ...and the original selected alternative is RETAINED in the superseded
    // record (it was not silently rewritten to say Redis). confirm.md never told
    // the skill to keep the content, so this proves the skill DERIVED the retain.
    { type: 'file-contains', path: STORAGE_PATH, value: 'selected-postgres' },

    // AC7 — a replacement Decision is created (not an in-place rewrite), it is
    // live (no superseded status), and it records the new selected alternative.
    { type: 'file-exists', path: REPLACEMENT_PATH },
    { type: 'file-contains', path: REPLACEMENT_PATH, value: 'type: Decision' },
    { type: 'file-contains', path: REPLACEMENT_PATH, value: 'Redis' },
    { type: 'file-not-contains', path: REPLACEMENT_PATH, value: 'status: superseded' },

    // AC7 — the supersession is recorded as one Deprecation in the nearest log.
    // confirm.md does not use the words "supersede", "deprecation", or "link", so
    // the Deprecation entry is the skill's own bookkeeping, not a dictated step.
    { type: 'file-contains', path: 'docs/payments/log.md', value: '**Deprecation**' },
    // The already-merged Creation entry survives (AC4).
    { type: 'file-contains', path: 'docs/payments/log.md', value: 'target-log-creation' },

    // AC3 — no operational sync/debt entry even on the supersession path.
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: 'docs-sync ran' },
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: '**Noted**' },

    // Corroborating live evidence the run engaged supersession semantics. NOTE:
    // `output` is every turn's stdout joined (test-runner), so on this write path
    // this cannot ISOLATE turn-1 recognition — that proof lives in the
    // single-turn docs-sync-reversal-gate sibling. Here it only confirms the
    // confirmed run reached a supersession (confirm.md itself never says it).
    { type: 'output-contains', value: 'supersed' },

    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
