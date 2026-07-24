// Shared token-store baseline for the two AC7 (reversal) docs-sync cases: the
// write-path supersession (docs-sync-supersede) and the autonomous gate
// (docs-sync-reversal-gate). Both seed the SAME repository — an accepted
// "store tokens in PostgreSQL" Decision that explicitly rejected Redis, plus an
// unstaged source reversal that flips the store to Redis — and differ ONLY in
// the prompt (one is told to pause + confirms; the other merely asks to
// reconcile in a single turn) and the assertions. Extracting the byte-identical
// fixture (Fowler: Duplicated Code) keeps the reversal scenario a single-site
// edit and stops the two cases from silently drifting apart. Mirrors
// _docs-sync-assets.mjs.
import { scaffold } from './_docs-sync-assets.mjs';

export const STORAGE_PATH = 'docs/payments/decisions/token-store.md';
// The conventional replacement path a supersession would file. Both cases pin
// this so the write-path case can assert the linked replacement deterministically
// (the user owns the path, exactly as docs-add directs its target) and the gate
// case can assert the replacement is ABSENT until confirmation.
export const REPLACEMENT_PATH = 'docs/payments/decisions/token-store-redis.md';

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

// The full ordered input list both cases spread verbatim: the shared scaffold,
// the accepted decision + its index/log entries + the source consistent with it
// at the committed baseline, then the branch's material reversal as UNSTAGED
// working-tree drift (buildFixture seeds `uncommitted` after the baseline
// commit), so merge-base(master, HEAD) is the baseline and the branch diff is
// exactly that reversal. The docs still say PostgreSQL until docs-sync acts.
export const tokenStoreInputs = [
  ...scaffold,
  { path: 'docs/payments/index.md', content: PAYMENTS_INDEX },
  { path: 'docs/payments/decisions/index.md', content: DECISIONS_INDEX },
  { path: STORAGE_PATH, content: STORAGE_DECISION },
  { path: 'docs/log.md', content: ROOT_LOG },
  { path: 'docs/payments/log.md', content: PAYMENTS_LOG },
  { path: 'src/token-store.js', content: "export const TOKEN_STORE = 'postgres';\n" },
  {
    path: 'src/token-store.js',
    content: "export const TOKEN_STORE = 'redis'; // switched from postgres\n",
    uncommitted: true,
  },
];
