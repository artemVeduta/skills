// Reconcile-write case for docs-sync (issue #54, spec §docs-sync, branch mode).
// Sibling of the gate case: this directory is `docs-sync-reconcile` but the
// manifest projects the real `docs-sync` skill (via `skill` below), so one skill
// carries both the mode/target gate case and this positive-write case. The gate
// case (docs-sync) proves NOTHING is written before a mode + target are chosen;
// this case proves the GENUINE reconcile — the headline behaviour — on a branch
// whose source diverged from the docs: current truth is updated to cite the new
// symbol (AC4), the single reconciler appends exactly one Update to the NEAREST
// log (AC5), and Git is left untouched on the write path (AC10).
//
// The divergence is real, and expressed within the shared harness (one baseline
// commit, no branching) via an `uncommitted` override: the retries Specification
// and `src/gateway.js` are committed CONSISTENT at the baseline (both say three
// retries), then the branch raises the source to five as an UNSTAGED working-tree
// change (buildFixture seeds `uncommitted` inputs after the baseline commit). The
// target is `master` — the fixture's own branch (pinned by gitInitFixture), so the
// merge-base is the baseline commit and the branch's whole diff IS that unstaged
// source change. Scope therefore genuinely contains the retries spec, which the
// stale baseline leaves citing no symbol and the wrong count: a run that no-ops,
// does nothing, or fails to resolve the merge-base leaves 'MAX_RETRIES' absent
// and the log without an Update, so the assertions below distinguish a real
// reconcile from all three. (Idempotence — AC9 — is a design property of
// recomputing scope from the fixed boundary every run; it is documented in
// SKILL.md and grep-checked deterministically, not claimed by this single run.)
import { scaffold, SPEC_PATH } from '../_docs-sync-assets.mjs';

// The STALE baseline Specification: it describes the OLD retry count and cites no
// source symbol. It is CONSISTENT with the committed source (both three) — the
// bundle was current for the old code — so only the branch's unstaged bump makes
// it stale and pulls it into scope.
const STALE_SPEC =
  '---\ntype: Specification\ntitle: Payment retry policy\ndescription: How the payment gateway retries a failed charge.\ntimestamp: 2026-07-20\n---\n\n# Payment retry policy\n\nThe gateway retries a failed charge up to three times before giving up. (SENTINEL stale-retry-count)\n';

// A prior Creation entry so a genuine reconcile APPENDS one Update (never creates
// the log); '**Update**' is absent at baseline, so its presence proves a write.
const LOG = '## 2026-07-20\n\n- **Creation** — payment retry policy documented.\n';

export default {
  skill: 'docs-sync',
  inputs: [
    ...scaffold,
    { path: 'docs/log.md', content: LOG },
    { path: 'docs/payments/log.md', content: LOG },
    { path: SPEC_PATH, content: STALE_SPEC },
    // The source, committed CONSISTENT with the stale spec at the baseline...
    { path: 'src/gateway.js', content: 'export const MAX_RETRIES = 3;\n' },
    // ...then raised to five as the branch's UNSTAGED working-tree change (seeded
    // after the baseline commit). This is the whole branch diff from the
    // merge-base — the unstaged state AC2 puts in scope — and what makes the spec
    // stale and reconcilable.
    { path: 'src/gateway.js', content: 'export const MAX_RETRIES = 5;\n', uncommitted: true },
  ],
  assertions: [
    // Headline (AC10 on the WRITE path): the reconcile legitimately dirties the
    // working tree (spec + nearest log edited), so git-unchanged is unusable here
    // — git-uncommitted proves HEAD still equals the baseline (no commit), nothing
    // is staged, and no remote was added (so no push/PR is possible). This is the
    // sibling of the gate case's git-unchanged.
    { type: 'git-uncommitted' },
    // AC4 current-truth reconcile: the branch raised the retry count in source, so
    // the reconciled Specification must now cite the source symbol. 'MAX_RETRIES'
    // is ABSENT in the stale baseline, so its presence proves a genuine reconcile
    // (not a no-op, a do-nothing model, or an unresolved merge-base).
    { type: 'file-contains', path: SPEC_PATH, value: 'MAX_RETRIES' },
    // The stale prose was actually rewritten, not merely appended to: the old
    // retry-count sentinel is gone.
    { type: 'file-not-contains', path: SPEC_PATH, value: 'stale-retry-count' },
    // AC5 bookkeeping: the single reconciler appended exactly one Update to the
    // NEAREST (payments) log — absent at baseline, so this proves the write.
    { type: 'file-contains', path: 'docs/payments/log.md', value: '**Update**' },
    // ...and the ROOT log did NOT get it — bookkeeping landed in the nearest log
    // only, never a `docs-sync ran`/operational entry.
    { type: 'file-not-contains', path: 'docs/log.md', value: '**Update**' },
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: 'docs-sync ran' },
    // Live evidence the run engaged branch mode (the mode is not dictated by the
    // prompt's target-branch line alone).
    { type: 'output-contains', value: 'branch' },
    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
