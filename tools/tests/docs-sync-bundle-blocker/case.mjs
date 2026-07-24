// Bundle-wide UNKNOWN-BOUNDARY case for docs-sync (issue #56, spec §docs-sync
// "Bundle-wide reconciliation"). Sibling of docs-sync-bundle: this directory is
// `docs-sync-bundle-blocker` but the manifest projects the real `docs-sync`
// skill. Where docs-sync-bundle proves the audit REPAIRS every drift it can, this
// proves the other half of the contract: an audit must NOT guess through an
// unknown acceptance boundary — it preserves the material and blocks precisely.
//
// The bundle is fully COMMITTED and otherwise current: the idempotency Decision
// is registered in its parent index and has its log entry, the source agrees, and
// nothing is stale. The ONE uncertainty is a dated `## 2026-07-22 — widen key
// format` entry under `# Amendments`. That heading has exactly the shape branch
// mode's compaction FOLDS into canonical prose when it lands after the merge-base
// — but bundle-wide mode has NO target branch and NO merge-base, so there is no
// branch-local provenance to establish whether this amendment is accepted merged
// history (preserve it) or leftover branch-local drafting residue (fold it).
//
// With the acceptance boundary UNKNOWN, folding would be a guess. The AC-correct
// behaviour is to leave the amendment BYTE-PRESERVED and hand the user a precise
// blocker asking for the provenance it needs. This case is SINGLE-turn and the
// prompt names neither the amendment, "provenance", the "boundary", nor "block",
// so a blocker the run surfaces is the skill's own recognition — the anti-pattern
// (silently folding the drafting-looking amendment) is what a model applying
// branch-mode compaction reasoning without a merge-base would do.
//
// Because the correct run writes NOTHING (preserve + block) over an otherwise
// current committed bundle, git-unchanged holds. The shared scaffold lives in
// ../_docs-sync-assets.mjs (Fowler: Duplicated Code).
import { scaffold } from '../_docs-sync-assets.mjs';

const IDEM_PATH = 'docs/payments/decisions/idempotency.md';
const DECISIONS_INDEX_PATH = 'docs/payments/decisions/index.md';

// A conformant, REGISTERED Decision whose only ambiguity is the trailing dated
// amendment. The `## 2026-07-22` heading is drafting-shaped, but nothing in a
// bundle-wide view establishes whether it is accepted history or residue.
const IDEM_DECISION =
  '---\n' +
  'type: Decision\n' +
  'title: Idempotency keys\n' +
  'description: Deduplicate repeated charge submissions with an idempotency key.\n' +
  'timestamp: 2026-07-22\n' +
  '---\n\n' +
  '# Idempotency keys\n\n' +
  '## Context\n\n' +
  'Clients retry a charge after a timeout, which risks charging a customer twice for one order.\n\n' +
  '## Decision\n\n' +
  'Require an `Idempotency-Key` header on every charge; a repeated key returns the stored result of the first attempt instead of charging again.\n\n' +
  '## Consequences\n\n' +
  'The gateway stores each key and its result until the charge settles.\n\n' +
  '# Amendments\n\n' +
  '## 2026-07-22 — widen key format\n\n' +
  'Keys widened from 16-character tokens to 32-character UUIDs to avoid collisions. (SENTINEL ambiguous-amendment)\n';

const PAYMENTS_INDEX =
  '# payments\n\n' +
  'Payment processing subsystem.\n\n' +
  '## Decisions\n\n' +
  '- [Payment decisions](/payments/decisions/index.md) - durable payment decisions\n';

// The concept IS registered — the bundle is otherwise fully bookkept, so the only
// thing a correct audit surfaces is the unknown-boundary blocker (not a
// missing-index repair).
const DECISIONS_INDEX =
  '# payments decisions\n\nDurable payment decisions.\n\n' +
  '- [Idempotency keys](/payments/decisions/idempotency.md) - dedupe repeated charges\n';

const ROOT_LOG = '## 2026-07-05\n\n- **Creation** — payments subsystem baseline.\n';
const PAYMENTS_LOG =
  '## 2026-07-12\n\n- **Creation** — idempotency keys decision filed. (SENTINEL idem-log-creation)\n';

export default {
  skill: 'docs-sync',
  // Single-turn: the pause/block must be the skill's own recognition, not a
  // scripted "wait for my go-ahead".
  inputs: [
    ...scaffold,
    { path: 'docs/payments/index.md', content: PAYMENTS_INDEX },
    { path: DECISIONS_INDEX_PATH, content: DECISIONS_INDEX },
    { path: IDEM_PATH, content: IDEM_DECISION },
    { path: 'docs/log.md', content: ROOT_LOG },
    { path: 'docs/payments/log.md', content: PAYMENTS_LOG },
    // Source consistent with the decision's live body — nothing stale to repair,
    // so the audit's only finding is the unknowable amendment boundary.
    { path: 'src/idempotency.js', content: "export const IDEMPOTENCY_HEADER = 'Idempotency-Key';\n" },
  ],
  assertions: [
    // Never guessed through: with only an unknowable-provenance amendment over an
    // otherwise-current committed bundle, a correct run writes NOTHING — it
    // preserves and blocks. git-unchanged proves the tree sits EXACTLY at the
    // baseline commit (nothing written, staged, or committed).
    { type: 'git-unchanged' },

    // The ambiguous dated amendment HEADING survives byte-preserved — it was NOT
    // folded/compacted. A run that guessed (applied branch-mode compaction) would
    // have removed the `## 2026-07-22` heading and folded it into the live prose.
    { type: 'file-contains', path: IDEM_PATH, value: '## 2026-07-22' },
    { type: 'file-contains', path: IDEM_PATH, value: 'ambiguous-amendment' },
    // The `# Amendments` region itself is intact.
    { type: 'file-contains', path: IDEM_PATH, value: '# Amendments' },

    // The skill surfaced a precise BLOCKER rather than guessing — this
    // discriminates "recognized the unknown boundary and blocked" from a lazy
    // no-op (which git-unchanged alone cannot). The prompt never says "block", so
    // this is the skill's own recognition.
    { type: 'output-contains', value: 'block' },

    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
