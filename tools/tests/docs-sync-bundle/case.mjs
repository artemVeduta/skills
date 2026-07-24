// Bundle-wide AUDIT + REPAIR case for docs-sync (issue #56, spec §docs-sync
// "Bundle-wide reconciliation"). Sibling of the #54/#55 cases: this directory is
// `docs-sync-bundle` but the manifest projects the real `docs-sync` skill (via
// `skill` below), so one skill carries the branch-mode gate/reconcile/compaction
// cases and this bundle-wide case. Where branch sync reconciles only what a
// branch's diff touched, this proves the SECOND mode: an audit of the COMPLETE
// current bundle that repairs every kind of drift.
//
// The whole bundle is COMMITTED at the baseline — there is NO uncommitted drift.
// So merge-base(master, HEAD) is the baseline commit and a BRANCH sync would
// compute an EMPTY diff and repair nothing; only a bundle-wide audit catches
// drift that lives entirely in already-committed state. The bundle carries three
// distinct, committed-but-stale defects a bundle-wide audit must repair:
//
//   1. STALE EXPLANATION — the retries Specification still says "three times" and
//      cites no symbol, but `src/gateway.js` has `MAX_RETRIES = 5`. The audit must
//      rewrite it to cite the current symbol/value (AC: stale explanations).
//   2. MISSING CONCEPT — `src/refunds.js` exists but NOTHING documents it. The
//      audit must file a refunds Specification (AC: missing concepts / omissions).
//   3. SHARED-BOOKKEEPING + LIFECYCLE DRIFT — the `currency` Decision file exists
//      on disk but is absent from its parent decisions `index.md` and has no
//      `log.md` entry. The audit must register it and record its lifecycle (AC:
//      omissions, lifecycle drift, shared-bookkeeping drift).
//
// NO UNRELATED-DRIFT CATEGORY (the discriminator vs branch mode): the retries
// spec and the currency Decision were already wrong at the baseline and untouched
// by any branch, so branch sync would report them SEPARATELY and leave them
// byte-preserved. Bundle-wide mode instead REPAIRS them — the whole bundle is in
// scope, nothing is deferred as "unrelated". The assertions prove the stale
// sentinel is gone (repaired, not deferred).
//
// The shared bundle scaffold (routing pair, runnable validator, root/conventions
// skeleton, policy) lives in ../_docs-sync-assets.mjs (Fowler: Duplicated Code);
// only the distinguishing concept content, source, logs, and index overrides are
// here. Everything is committed, so the audit's repairs dirty the working tree
// without a commit → git-uncommitted.
import { scaffold } from '../_docs-sync-assets.mjs';

const RETRIES_PATH = 'docs/payments/specs/retries.md';
const REFUNDS_PATH = 'docs/payments/specs/refunds.md';
const CURRENCY_PATH = 'docs/payments/decisions/currency.md';
const DECISIONS_INDEX_PATH = 'docs/payments/decisions/index.md';

// Defect #1 — a STALE Specification: the OLD retry count, no source symbol, and a
// sentinel whose survival would mean the audit did not repair it. It is stale vs
// the committed `src/gateway.js` (five), so only a whole-bundle audit catches it.
const STALE_RETRIES =
  '---\n' +
  'type: Specification\n' +
  'title: Payment retry policy\n' +
  'description: How the payment gateway retries a failed charge.\n' +
  'timestamp: 2026-07-10\n' +
  '---\n\n' +
  '# Payment retry policy\n\n' +
  'The gateway retries a failed charge up to three times before giving up. (SENTINEL stale-retry-count)\n';

// Defect #3 — a conformant `currency` Decision present ON DISK but UNREGISTERED:
// its parent decisions index does not list it and the log has no entry for it.
const CURRENCY_DECISION =
  '---\n' +
  'type: Decision\n' +
  'title: Settlement currency\n' +
  'description: Which currency the gateway settles a cross-border charge in.\n' +
  'timestamp: 2026-07-11\n' +
  '---\n\n' +
  '# Settlement currency\n\n' +
  '## Context\n\n' +
  'Cross-border charges arrive in many presentment currencies but must settle in one.\n\n' +
  '## Decision\n\n' +
  'Settle every charge in the merchant account currency, converting at capture time. (SENTINEL currency-decision)\n\n' +
  '## Consequences\n\n' +
  'The gateway records the presentment currency and the applied conversion rate on each charge.\n';

// The subsystem index at baseline: it links the retries spec and the decisions
// sub-index, but the decisions sub-index (below) omits `currency`, and nothing
// links a refunds concept (it does not yet exist).
const PAYMENTS_INDEX =
  '# payments\n\n' +
  'Payment processing subsystem.\n\n' +
  '## Specifications\n\n' +
  '- [Payment retry policy](/payments/specs/retries.md) - retry mechanics\n\n' +
  '## Decisions\n\n' +
  '- [Payment decisions](/payments/decisions/index.md) - durable payment decisions\n';

// The decisions sub-index at baseline: EMPTY of `currency` — the shared-bookkeeping
// omission the audit must repair by adding a `/payments/decisions/currency.md`
// bullet (absent here at baseline).
const DECISIONS_INDEX =
  '# payments decisions\n\nDurable payment decisions.\n';

// Root log — one Creation, untouched by the audit (all repairs land in the
// nearest payments log).
const ROOT_LOG = '## 2026-07-05\n\n- **Creation** — payments subsystem baseline. (SENTINEL root-log-baseline)\n';

// Nearest (payments) log at baseline: it records ONLY the retries Creation. The
// `currency` Decision was filed to disk without a log entry (lifecycle drift), and
// refunds does not exist yet. A genuine audit appends a net Update (retries
// reconciled) and net Creations (refunds filed, currency registered), never an
// operational `docs-sync ran` line.
const PAYMENTS_LOG =
  '## 2026-07-10\n\n- **Creation** — payment retry policy documented. (SENTINEL retries-log-creation)\n';

export default {
  skill: 'docs-sync',
  inputs: [
    ...scaffold,
    // Overrides + concepts (all COMMITTED — the drift lives in merged state, so a
    // branch diff is empty and only a bundle-wide audit reaches it):
    { path: 'docs/payments/index.md', content: PAYMENTS_INDEX },
    { path: DECISIONS_INDEX_PATH, content: DECISIONS_INDEX },
    { path: RETRIES_PATH, content: STALE_RETRIES },
    { path: CURRENCY_PATH, content: CURRENCY_DECISION },
    { path: 'docs/log.md', content: ROOT_LOG },
    { path: 'docs/payments/log.md', content: PAYMENTS_LOG },
    // Source: the retries spec is stale vs this, and refunds has no concept at all.
    { path: 'src/gateway.js', content: 'export const MAX_RETRIES = 5;\n' },
    { path: 'src/refunds.js', content: 'export const REFUND_WINDOW_DAYS = 30;\n' },
  ],
  assertions: [
    // Headline (write path): the whole-bundle repair dirties the tree, so
    // git-uncommitted proves HEAD still equals the baseline commit, nothing is
    // staged, and no remote/PR was created.
    { type: 'git-uncommitted' },

    // AC — STALE EXPLANATION repaired. 'MAX_RETRIES' is absent at baseline; its
    // presence proves the committed-but-stale spec was reconciled to the source
    // (a branch sync, with an empty diff, would leave it untouched).
    { type: 'file-contains', path: RETRIES_PATH, value: 'MAX_RETRIES' },
    // NO-UNRELATED-DRIFT — the stale sentinel is GONE: the concept was REPAIRED,
    // not deferred as "unrelated target drift" and left byte-preserved.
    { type: 'file-not-contains', path: RETRIES_PATH, value: 'stale-retry-count' },

    // AC — MISSING CONCEPT filed: a refunds Specification is created (absent at
    // baseline) and cites the source it documents.
    { type: 'file-exists', path: REFUNDS_PATH },
    { type: 'file-contains', path: REFUNDS_PATH, value: 'type: Specification' },
    { type: 'file-contains', path: REFUNDS_PATH, value: 'REFUND' },

    // AC — OMISSION / SHARED-BOOKKEEPING drift repaired: the unregistered currency
    // Decision is added to its parent decisions index (the bullet's link target is
    // absent at baseline). The concept body is preserved (not rewritten).
    { type: 'file-contains', path: DECISIONS_INDEX_PATH, value: 'currency.md' },
    { type: 'file-contains', path: CURRENCY_PATH, value: 'currency-decision' },

    // AC — LIFECYCLE drift repaired by the single reconciler in the NEAREST log: a
    // net Update (retries reconciled) and net Creations (refunds filed, currency
    // registered), with no operational entry.
    { type: 'file-contains', path: 'docs/payments/log.md', value: '**Update**' },
    { type: 'file-contains', path: 'docs/payments/log.md', value: '**Creation**' },
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: 'docs-sync ran' },
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: '**Noted**' },
    // The already-present retries Creation survives (the reconciler appends, never
    // rewrites merged history).
    { type: 'file-contains', path: 'docs/payments/log.md', value: 'retries-log-creation' },

    // Live evidence the run engaged bundle-wide mode.
    { type: 'output-contains', value: 'bundle-wide' },

    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
