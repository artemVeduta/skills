// Shared baseline for the two docs-sync SPLIT-migration cases (#57, spec
// §docs-sync "Existing-source migration"): docs-sync-migrate-split-overview (the
// split source is KEPT as a concise conformant overview / stable entry point) and
// docs-sync-migrate-split-remove (the split source's approved REMOVAL is recorded
// as part of the migration). Both seed the IDENTICAL repository — a single
// MULTI-topic ad-hoc doc outside the bundle covering two independent subjects
// with independent lifecycles — and differ ONLY in the approval follow-up and the
// assertions. Extracting the byte-identical fixture (Fowler: Duplicated Code)
// keeps the split scenario a single-site edit. Mirrors _docs-sync-token-store.mjs.
//
// `notes/payments-guide.md` mixes TWO independent durable subjects — retry policy
// and refund policy — each backed by its own source symbol. A read-only worker
// classifies it as a SPLIT: it should become two concepts (a retries Specification
// and a refunds Specification). What happens to the ORIGINAL path is the AC6
// fork the two cases exercise: kept as a stable overview vs. removal recorded. The
// empty-payments bundle shape (the empty-Specifications index and the two
// subsystem-baseline logs) is the byte-identical delta this multi-topic baseline
// shares with the single-topic import baseline, so it is imported from
// `emptyPaymentsBaseline` rather than re-declared here; this file owns only the
// multi-topic candidate guide and the two sources its subjects cite.
import { emptyPaymentsBaseline } from './_docs-sync-assets.mjs';

// The multi-topic ad-hoc doc (split candidate) and the two concept paths a split
// would file. Both concepts are absent at baseline.
export const GUIDE_PATH = 'notes/payments-guide.md';
export const RETRIES_CONCEPT = 'docs/payments/specs/retries.md';
export const REFUNDS_CONCEPT = 'docs/payments/specs/refunds.md';

// A MULTI-topic durable note OUTSIDE the bundle: two independent subjects
// (retries, refunds) with independent lifecycles, each citing its own source
// symbol. No frontmatter — ad-hoc documentation, not a concept — and under
// notes/, so the validator never sees it. It does NOT link into docs/ at baseline
// (the concepts do not exist yet), so a post-migration link into specs/ proves the
// overview case rewrote it into a conformant in-bundle entry point.
const GUIDE =
  '# Payments guide\n\n' +
  'Operational notes covering two independent payment subjects.\n\n' +
  '## Retries\n\n' +
  'The gateway retries a failed charge up to five times before giving up; the limit is\n' +
  'the `MAX_RETRIES` symbol in `src/gateway.js`. (SENTINEL guide-retries)\n\n' +
  '## Refunds\n\n' +
  'A refund may be issued within 30 days of capture; the window is the\n' +
  '`REFUND_WINDOW_DAYS` symbol in `src/refunds.js`. (SENTINEL guide-refunds)\n';

// The two sources the guide's subjects cite — a split must reconcile each concept
// to its own symbol rather than pasting the guide's prose.
const GATEWAY_SRC = 'export const MAX_RETRIES = 5;\n';
const REFUNDS_SRC = 'export const REFUND_WINDOW_DAYS = 30;\n';

// The full ordered input list both split cases spread verbatim. The shared
// empty-payments baseline and this file's candidate guide + sources are all
// COMMITTED, so an approved split dirties the working tree without a commit
// (git-uncommitted).
export const splitInputs = [
  ...emptyPaymentsBaseline,
  { path: GUIDE_PATH, content: GUIDE },
  { path: 'src/gateway.js', content: GATEWAY_SRC },
  { path: 'src/refunds.js', content: REFUNDS_SRC },
];
