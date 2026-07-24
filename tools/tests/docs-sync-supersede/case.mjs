// Supersession case for docs-sync (issue #55, spec §docs-sync "compaction",
// branch mode). Sibling of the compaction case: this directory is
// `docs-sync-supersede` but the manifest projects the real `docs-sync` skill
// (via `skill` below). Where docs-sync-compact proves ordinary drafting residue
// folds silently into the accepted net state, this proves the ONE change that
// crosses the accepted-state boundary and must NOT be a silent edit: a material
// REVERSAL of a Decision's selected alternative (AC7).
//
// The branch reverses an accepted decision — "store payment tokens in
// PostgreSQL" — by switching the source (`src/token-store.js`) to Redis. Redis
// is the alternative the original decision explicitly REJECTED, so this changes
// the selected alternative: a reversal, not an ordinary refinement. docs-sync
// must (1) require explicit user confirmation before acting, and (2) on
// confirmation create a LINKED SUPERSESSION — mark the old decision
// `status: superseded` + `superseded_by`, file a replacement decision, and log
// one Deprecation — rather than editing the accepted record in place.
//
// The confirmation gate is expressed with the plan/approval seam (like
// docs-add-approve): turn 1 (prompt.md) proposes and PAUSES; the follow-up
// (confirm.md) confirms and names the replacement path, so the supersession is
// only written after an explicit go-ahead. The source reversal is UNSTAGED
// working-tree drift over a clean baseline (buildFixture seeds `uncommitted`
// after the baseline commit), so merge-base(master, HEAD) is the baseline and
// the branch diff is exactly that reversal.
import { scaffold } from '../_docs-sync-assets.mjs';

const STORAGE_PATH = 'docs/payments/decisions/token-store.md';
// The confirm follow-up directs this exact replacement path, so the assertions
// can check the linked supersession deterministically (the user owns the path;
// docs-add-approve directs its target the same way).
const REPLACEMENT_PATH = 'docs/payments/decisions/token-store-redis.md';

// The accepted decision on the TARGET (baseline): store tokens in PostgreSQL,
// with Redis listed as the REJECTED alternative. `status` is live (not
// superseded). The decision cites the `TOKEN_STORE` symbol so the reconciler
// knows exactly where the current-truth source lives.
const STORAGE_DECISION =
  '---\n' +
  'type: Decision\n' +
  'title: Payment token storage\n' +
  'description: Where the gateway stores payment tokens between charge attempts.\n' +
  'timestamp: 2026-07-18\n' +
  '---\n\n' +
  '# Payment token storage\n\n' +
  '## Context\n\n' +
  'The gateway must persist payment tokens between charge attempts.\n\n' +
  '## Decision\n\n' +
  'Store payment tokens in PostgreSQL, alongside the existing charge tables. (SENTINEL selected-postgres)\n\n' +
  'The active store is selected by the `TOKEN_STORE` symbol in `src/token-store.js`.\n\n' +
  '## Alternatives\n\n' +
  '- **Redis.** Rejected: tokens must survive a cache flush and need durable, transactional storage.\n\n' +
  '## Consequences\n\n' +
  'Token reads share the primary database connection pool.\n\n' +
  '# Amendments\n\n' +
  '<!-- Append dated entries; never rewrite accepted history. -->\n';

const PAYMENTS_INDEX =
  '# payments\n\nPayment processing subsystem.\n\n## Decisions\n\n' +
  '- [Payment token storage](/payments/decisions/token-store.md) - where tokens are persisted\n';
const DECISIONS_INDEX =
  '# payments decisions\n\nDurable payment decisions.\n\n' +
  '- [Payment token storage](/payments/decisions/token-store.md) - where tokens are persisted\n';

const PAYMENTS_LOG =
  '## 2026-07-18\n\n- **Creation** — payment token storage decision filed. (SENTINEL target-log-creation)\n';
const ROOT_LOG = '## 2026-07-10\n\n- **Creation** — payments subsystem baseline.\n';

export default {
  skill: 'docs-sync',
  followUps: ['confirm.md'],
  inputs: [
    ...scaffold,
    // Committed baseline: the accepted decision + source consistent with it.
    { path: 'docs/payments/index.md', content: PAYMENTS_INDEX },
    { path: 'docs/payments/decisions/index.md', content: DECISIONS_INDEX },
    { path: STORAGE_PATH, content: STORAGE_DECISION },
    { path: 'docs/log.md', content: ROOT_LOG },
    { path: 'docs/payments/log.md', content: PAYMENTS_LOG },
    { path: 'src/token-store.js', content: "export const TOKEN_STORE = 'postgres';\n" },
    // The branch's material reversal: the source now selects Redis (the rejected
    // alternative), left UNSTAGED so it is the whole branch diff from the
    // merge-base. The docs still say PostgreSQL until docs-sync reconciles.
    {
      path: 'src/token-store.js',
      content: "export const TOKEN_STORE = 'redis'; // switched from postgres\n",
      uncommitted: true,
    },
  ],
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
    // record (it was not silently rewritten to say Redis).
    { type: 'file-contains', path: STORAGE_PATH, value: 'selected-postgres' },

    // AC7 — a replacement Decision is created (not an in-place rewrite), it is
    // live (no superseded status), and it records the new selected alternative.
    { type: 'file-exists', path: REPLACEMENT_PATH },
    { type: 'file-contains', path: REPLACEMENT_PATH, value: 'type: Decision' },
    { type: 'file-contains', path: REPLACEMENT_PATH, value: 'Redis' },
    { type: 'file-not-contains', path: REPLACEMENT_PATH, value: 'status: superseded' },

    // AC7 — the supersession is recorded as one Deprecation in the nearest log.
    { type: 'file-contains', path: 'docs/payments/log.md', value: '**Deprecation**' },
    // The already-merged Creation entry survives (AC4).
    { type: 'file-contains', path: 'docs/payments/log.md', value: 'target-log-creation' },

    // AC3 — no operational sync/debt entry even on the supersession path.
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: 'docs-sync ran' },
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: '**Noted**' },

    // Live evidence the run recognized the reversal and engaged supersession
    // semantics (the turn-1 prompt names neither "supersede" nor "reversal").
    { type: 'output-contains', value: 'supersed' },

    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
