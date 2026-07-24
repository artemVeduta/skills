// Bundle-wide IDEMPOTENCE case for docs-sync (issue #56, spec §docs-sync
// "Bundle-wide reconciliation" + "Idempotence"). Sibling of docs-sync-bundle:
// this directory is `docs-sync-bundle-idempotent` but the manifest projects the
// real `docs-sync` skill. It proves that two identical bundle-wide
// reconciliations produce identical docs after the first successful run.
//
// Idempotence is a design property: bundle-wide mode recomputes the whole-bundle
// audit from the CURRENT state every run, never appends, so an ALREADY-RECONCILED
// bundle is the fixed point — a second identical run re-derives an empty change
// set and writes nothing. This case seeds that steady state directly (the
// post-first-successful-run bundle) and runs one bundle-wide reconcile over it;
// the observable consequence of idempotence is that the run is a NO-OP. (This
// mirrors how the #54 reconcile case treats AC9: idempotence is documented in
// SKILL.md and grep-checked deterministically; a single live run demonstrates the
// steady-state consequence rather than re-deriving the property.)
//
// The bundle is fully current and conformant: the retries Specification cites the
// current symbol and value, matching `src/gateway.js`; it is registered in the
// subsystem index and has its log entry; there is no drafting residue and no
// ambiguous amendment. A correct bundle-wide audit finds NOTHING to repair, so it
// writes nothing → git-unchanged. The shared scaffold lives in
// ../_docs-sync-assets.mjs (Fowler: Duplicated Code).
import { scaffold } from '../_docs-sync-assets.mjs';

const RETRIES_PATH = 'docs/payments/specs/retries.md';

// A CURRENT, conformant Specification: it cites the source symbol AND the current
// value (five), matching `src/gateway.js`. The sentinel `current-retry-spec` lets
// the assertions prove a correct no-op left the concept byte-intact (a run that
// "helpfully" rewrote a correct concept would lose it and also dirty the tree).
const CURRENT_RETRIES =
  '---\n' +
  'type: Specification\n' +
  'title: Payment retry policy\n' +
  'description: How the payment gateway retries a failed charge.\n' +
  'timestamp: 2026-07-14\n' +
  '---\n\n' +
  '# Payment retry policy\n\n' +
  'The gateway retries a failed charge up to five times before giving up; the limit is the\n' +
  '`MAX_RETRIES` symbol in `src/gateway.js`. (SENTINEL current-retry-spec)\n';

const PAYMENTS_INDEX =
  '# payments\n\n' +
  'Payment processing subsystem.\n\n' +
  '## Specifications\n\n' +
  '- [Payment retry policy](/payments/specs/retries.md) - retry mechanics\n';

const ROOT_LOG = '## 2026-07-05\n\n- **Creation** — payments subsystem baseline.\n';
const PAYMENTS_LOG =
  '## 2026-07-14\n\n- **Creation** — payment retry policy documented. (SENTINEL retries-log-creation)\n';

export default {
  skill: 'docs-sync',
  // Single-turn steady-state run.
  inputs: [
    ...scaffold,
    { path: 'docs/payments/index.md', content: PAYMENTS_INDEX },
    { path: RETRIES_PATH, content: CURRENT_RETRIES },
    { path: 'docs/log.md', content: ROOT_LOG },
    { path: 'docs/payments/log.md', content: PAYMENTS_LOG },
    // Source that AGREES with the current spec — nothing is stale, so a correct
    // bundle-wide audit finds no drift.
    { path: 'src/gateway.js', content: 'export const MAX_RETRIES = 5;\n' },
  ],
  assertions: [
    // The no-op leaves the tree EXACTLY at the baseline commit: git-unchanged
    // proves the second (identical) bundle-wide reconciliation wrote nothing —
    // idempotence's observable consequence.
    { type: 'git-unchanged' },

    // No-false-rewrite discriminator: the already-current concept is left
    // byte-preserved. (git-unchanged already forbids any write; this pins the
    // specific concept a naive "improve it anyway" run would have touched.)
    { type: 'file-contains', path: RETRIES_PATH, value: 'current-retry-spec' },
    { type: 'file-contains', path: RETRIES_PATH, value: 'MAX_RETRIES' },

    // Live evidence the run engaged bundle-wide mode (and still found nothing to
    // do), not that it silently skipped the request.
    { type: 'output-contains', value: 'bundle-wide' },

    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
