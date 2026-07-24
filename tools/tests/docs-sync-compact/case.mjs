// Compaction case for docs-sync (issue #55, spec §docs-sync "compaction", branch
// mode). Sibling of the #54 gate + reconcile cases: this directory is
// `docs-sync-compact` but the manifest projects the real `docs-sync` skill (via
// `skill` below), so one skill carries the mode/target gate, the genuine
// reconcile, and this compaction case. Where reconcile proves current truth is
// brought up to a changed SOURCE, this proves the DOCS-SIDE compaction nuance:
// a branch's drafting residue is folded down to the accepted net state while
// previously-merged history is left intact.
//
// The branch is DOCS-ONLY (AC3): no source changed. Everything the branch did is
// expressed as UNSTAGED working-tree drift over a clean baseline — buildFixture
// commits the baseline first, then seeds `uncommitted` inputs after, so
// merge-base(master, HEAD) is the baseline and the branch's whole diff is that
// drift. The baseline (committed) state is the "already-merged" history that must
// survive byte-for-byte (AC4); the uncommitted state is the branch-local drafting
// residue that must compact away.
//
// The branch did three things over the baseline:
//   1. CREATED a new "Webhook delivery retries" Decision, then logged a spurious
//      follow-up Update for it (residue). Compaction must leave ONE Creation
//      entry, not Creation + Update (AC1).
//   2. REFINED the existing "Idempotency keys" Decision with a dated branch-local
//      `# Amendments` heading (a value change: 16-char tokens -> 32-char UUIDs).
//      Compaction must remove that intermediate drafting HEADING and fold the
//      dated old/new value fact into the canonical Context/Consequences prose,
//      while the TARGET-side amendment (2026-07-15, in the baseline) stays
//      untouched (AC4 + AC5). Widening a key format is an ordinary value
//      refinement of a live section, not a change to the decision's selected
//      alternative/boundary/hard-constraint, so it compacts in place — it is NOT
//      a reversal (that path is the docs-sync-supersede sibling, AC7).
//   3. Left an operational `**Noted** — docs-sync ran` bookkeeping line in the
//      log. No operational/debt/"docs-sync ran"/Noted entry may survive (AC3).
// The net lifecycle for the branch is exactly ONE Creation + ONE Update (AC1/AC2).
//
// The shared bundle scaffold (routing pair, runnable validator, root/conventions
// skeleton, policy) lives in ../_docs-sync-assets.mjs (Fowler: Duplicated Code);
// only the distinguishing decision content, logs, and index overrides are here.
import { scaffold } from '../_docs-sync-assets.mjs';

const IDEM_PATH = 'docs/payments/decisions/idempotency.md';
const WEBHOOKS_PATH = 'docs/payments/decisions/webhooks.md';

// The existing "Idempotency keys" Decision as it stands on the TARGET (baseline):
// a live body plus ONE dated amendment from 2026-07-15 (SENTINEL target-amendment).
// This amendment is already-merged history — it must survive compaction verbatim.
const IDEM_BASELINE =
  '---\n' +
  'type: Decision\n' +
  'title: Idempotency keys\n' +
  'description: Deduplicate repeated charge submissions with an idempotency key.\n' +
  'timestamp: 2026-07-15\n' +
  '---\n\n' +
  '# Idempotency keys\n\n' +
  '## Context\n\n' +
  'Clients retry a charge after a timeout, which risks charging a customer twice for one order.\n\n' +
  '## Decision\n\n' +
  'Require an `Idempotency-Key` header on every charge; a repeated key returns the stored result of the first attempt instead of charging again.\n\n' +
  '## Consequences\n\n' +
  'The gateway stores each key and its result until the charge settles.\n\n' +
  '# Amendments\n\n' +
  '## 2026-07-15 — key retention window\n\n' +
  'Keys are retained for 24 hours after the charge settles, then evicted. (SENTINEL target-amendment)\n';

// The branch-local drafting state of the same Decision: the baseline body plus a
// NEW intermediate amendment heading for 2026-07-23 recording the format change
// (SENTINEL branch-local-amendment). Compaction must DROP the `## 2026-07-23`
// heading and fold "on 2026-07-23 keys widened from 16-char tokens to 32-char
// UUIDs" into the canonical prose (retaining the date and the new value), while
// keeping the 2026-07-15 target amendment (AC4/AC5).
const IDEM_BRANCH =
  '---\n' +
  'type: Decision\n' +
  'title: Idempotency keys\n' +
  'description: Deduplicate repeated charge submissions with an idempotency key.\n' +
  'timestamp: 2026-07-23\n' +
  '---\n\n' +
  '# Idempotency keys\n\n' +
  '## Context\n\n' +
  'Clients retry a charge after a timeout, which risks charging a customer twice for one order.\n\n' +
  '## Decision\n\n' +
  'Require an `Idempotency-Key` header on every charge; a repeated key returns the stored result of the first attempt instead of charging again.\n\n' +
  '## Consequences\n\n' +
  'The gateway stores each key and its result until the charge settles.\n\n' +
  '# Amendments\n\n' +
  '## 2026-07-15 — key retention window\n\n' +
  'Keys are retained for 24 hours after the charge settles, then evicted. (SENTINEL target-amendment)\n\n' +
  '## 2026-07-23 — widen key format\n\n' +
  'Keys widened from 16-character tokens to 32-character UUIDs to avoid collisions. (SENTINEL branch-local-amendment)\n';

// The brand-new Decision the branch created. Its drafting residue lives in the
// LOG (a spurious extra Update), not in this body.
const WEBHOOKS_BRANCH =
  '---\n' +
  'type: Decision\n' +
  'title: Webhook delivery retries\n' +
  'description: How the gateway retries a failed webhook delivery to a merchant.\n' +
  'timestamp: 2026-07-23\n' +
  '---\n\n' +
  '# Webhook delivery retries\n\n' +
  '## Context\n\n' +
  'Merchant endpoints are briefly unavailable at times, so a single delivery attempt drops events.\n\n' +
  '## Decision\n\n' +
  'Retry a failed delivery with exponential backoff, up to 8 attempts, then park it in a dead-letter queue.\n\n' +
  '## Consequences\n\n' +
  'Merchants may receive duplicate deliveries and must deduplicate on the event id.\n';

// Payments subsystem index — baseline links only the idempotency decision; the
// branch adds the new webhooks decision.
const PAYMENTS_INDEX_BASELINE =
  '# payments\n\nPayment processing subsystem.\n\n## Decisions\n\n' +
  '- [Idempotency keys](/payments/decisions/idempotency.md) - dedupe repeated charges\n';
const PAYMENTS_INDEX_BRANCH =
  '# payments\n\nPayment processing subsystem.\n\n## Decisions\n\n' +
  '- [Idempotency keys](/payments/decisions/idempotency.md) - dedupe repeated charges\n' +
  '- [Webhook delivery retries](/payments/decisions/webhooks.md) - reliable webhook redelivery\n';

const DECISIONS_INDEX_BASELINE =
  '# payments decisions\n\nDurable payment decisions.\n\n' +
  '- [Idempotency keys](/payments/decisions/idempotency.md) - dedupe repeated charges\n';
const DECISIONS_INDEX_BRANCH =
  '# payments decisions\n\nDurable payment decisions.\n\n' +
  '- [Idempotency keys](/payments/decisions/idempotency.md) - dedupe repeated charges\n' +
  '- [Webhook delivery retries](/payments/decisions/webhooks.md) - reliable webhook redelivery\n';

// Root log at baseline: one Creation, never touched by branch work in this case.
const ROOT_LOG = '## 2026-07-10\n\n- **Creation** — payments subsystem baseline. (SENTINEL root-log-baseline)\n';

// The NEAREST (payments) log. Baseline: the already-merged history for
// idempotency (Creation 2026-07-10 + retention Update 2026-07-15), newest first.
const PAYMENTS_LOG_BASELINE =
  '## 2026-07-15\n\n' +
  '- **Update** — idempotency key retention window documented. (SENTINEL target-log-update)\n\n' +
  '## 2026-07-10\n\n' +
  '- **Creation** — idempotency keys decision filed. (SENTINEL target-log-creation)\n';

// The branch-local drafting state of the payments log: a messy 2026-07-23 block
// with the webhooks Creation, a SPURIOUS follow-up Update for webhooks (SENTINEL
// webhooks-branch-update), the idempotency format Update, and an operational
// **Noted** — docs-sync ran line (SENTINEL operational-noted). Compaction must
// collapse the 2026-07-23 block to ONE Creation (webhooks) + ONE Update
// (idempotency), drop the spurious webhooks Update and the operational note, and
// leave the 2026-07-15 and 2026-07-10 blocks byte-for-byte intact.
const PAYMENTS_LOG_BRANCH =
  '## 2026-07-23\n\n' +
  '- **Creation** — webhook delivery retries decision filed. (SENTINEL webhooks-creation)\n' +
  '- **Update** — tuned the webhook backoff curve again. (SENTINEL webhooks-branch-update)\n' +
  '- **Update** — widened the idempotency key format. (SENTINEL idem-branch-update)\n' +
  '- **Noted** — docs-sync ran on this branch. (SENTINEL operational-noted)\n\n' +
  '## 2026-07-15\n\n' +
  '- **Update** — idempotency key retention window documented. (SENTINEL target-log-update)\n\n' +
  '## 2026-07-10\n\n' +
  '- **Creation** — idempotency keys decision filed. (SENTINEL target-log-creation)\n';

export default {
  skill: 'docs-sync',
  inputs: [
    ...scaffold,
    // Committed baseline (the already-merged "target" state):
    { path: 'docs/payments/index.md', content: PAYMENTS_INDEX_BASELINE },
    { path: 'docs/payments/decisions/index.md', content: DECISIONS_INDEX_BASELINE },
    { path: IDEM_PATH, content: IDEM_BASELINE },
    { path: 'docs/log.md', content: ROOT_LOG },
    { path: 'docs/payments/log.md', content: PAYMENTS_LOG_BASELINE },
    // Branch-local drafting residue (UNSTAGED working-tree drift after baseline):
    { path: 'docs/payments/index.md', content: PAYMENTS_INDEX_BRANCH, uncommitted: true },
    { path: 'docs/payments/decisions/index.md', content: DECISIONS_INDEX_BRANCH, uncommitted: true },
    { path: IDEM_PATH, content: IDEM_BRANCH, uncommitted: true },
    { path: WEBHOOKS_PATH, content: WEBHOOKS_BRANCH, uncommitted: true },
    { path: 'docs/payments/log.md', content: PAYMENTS_LOG_BRANCH, uncommitted: true },
  ],
  assertions: [
    // Headline (AC8, write path): compaction legitimately dirties the working
    // tree, so git-uncommitted (not git-unchanged) proves HEAD still equals the
    // baseline commit, nothing is staged, and no remote/PR was created.
    { type: 'git-uncommitted' },

    // The created concept survives compaction (AC1) as a conformant Decision.
    { type: 'file-exists', path: WEBHOOKS_PATH },
    { type: 'file-contains', path: WEBHOOKS_PATH, value: 'type: Decision' },

    // AC1 — a Creation followed by branch-local edits collapses to ONE net
    // Creation: the SPURIOUS follow-up Update for the new concept is gone, and a
    // Creation/Update pair still exists (the net entries).
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: 'webhooks-branch-update' },
    { type: 'file-contains', path: 'docs/payments/log.md', value: '**Creation**' },
    { type: 'file-contains', path: 'docs/payments/log.md', value: '**Update**' },

    // AC3 — no operational `docs-sync ran`, `**Noted**`, or debt-marker entry is
    // written; the branch-local operational note is compacted away.
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: 'operational-noted' },
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: '**Noted**' },
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: 'docs-sync ran' },

    // AC4 — already-merged (target-side) lifecycle history is byte-preserved: the
    // 2026-07-15 and 2026-07-10 blocks and their sentinels survive untouched.
    { type: 'file-contains', path: 'docs/payments/log.md', value: 'target-log-update' },
    { type: 'file-contains', path: 'docs/payments/log.md', value: 'target-log-creation' },

    // Bookkeeping landed in the NEAREST log only — the root log gained no
    // reconciliation entry and no operational note (AC2/AC3, "one concise net
    // entry" placed correctly).
    { type: 'file-not-contains', path: 'docs/log.md', value: '**Update**' },
    { type: 'file-not-contains', path: 'docs/log.md', value: 'webhook' },
    { type: 'file-not-contains', path: 'docs/log.md', value: 'docs-sync ran' },

    // AC4/AC5 — the target-side dated amendment on the existing concept is
    // untouched (heading + body sentinel both survive).
    { type: 'file-contains', path: IDEM_PATH, value: '## 2026-07-15' },
    { type: 'file-contains', path: IDEM_PATH, value: 'target-amendment' },

    // AC5 — the branch-local amendment HEADING is removed, while the accepted
    // dated old/new value fact is folded into canonical prose: the date remains
    // (as prose, not a heading) and the new value (UUID) lands in a live section.
    // `## 2026-07-23` present would mean the drafting heading was kept — forbidden.
    { type: 'file-not-contains', path: IDEM_PATH, value: '## 2026-07-23' },
    { type: 'file-contains', path: IDEM_PATH, value: '2026-07-23' },
    { type: 'file-contains', path: IDEM_PATH, value: 'UUID' },

    // Live evidence the run engaged branch mode.
    { type: 'output-contains', value: 'branch' },

    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
