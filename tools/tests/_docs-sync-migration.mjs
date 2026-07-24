// Shared baseline for the three docs-sync EXISTING-SOURCE MIGRATION cases that
// operate on ONE single-topic ad-hoc doc living OUTSIDE the bundle (#57, spec
// §docs-sync "Existing-source migration"): docs-sync-migrate-classify (read-only
// classification, no writes), docs-sync-migrate-deny (a denied proposal), and
// docs-sync-migrate (an approved import that keeps the source's pointer). All
// three seed the IDENTICAL repository and differ ONLY in the prompt/follow-ups
// and the assertions — so extracting the byte-identical fixture (Fowler:
// Duplicated Code) keeps the migration scenario a single-site edit and stops the
// cases from silently drifting apart. Mirrors _docs-sync-token-store.mjs.
//
// The repository is a clean, conformant OKF bundle with a `payments` subsystem
// whose Specifications section is EMPTY, plus a durable design note that lives
// OUTSIDE the bundle at `notes/retry-design.md`. That empty-payments bundle shape
// (the empty-Specifications index and the two subsystem-baseline logs) is the
// byte-identical delta this single-topic baseline shares with the multi-topic
// split baseline, so it is imported from `emptyPaymentsBaseline` rather than
// re-declared here; this file owns only the single-topic candidate doc and the
// source that points at it. A source file (`src/gateway.js`) POINTS at that note
// in a comment — the "existing pointer" AC5 protects: after an import that does
// NOT approve deletion, the note must remain at its path so the pointer stays
// valid. The note is a migration CANDIDATE (durable knowledge outside the
// bundle), single-topic, so its classification is an import (move/normalize), not
// a split.
import { emptyPaymentsBaseline } from './_docs-sync-assets.mjs';

// The ad-hoc doc outside the bundle (a migration candidate) and the concept path
// an approved import would file it to inside the bundle.
export const NOTE_PATH = 'notes/retry-design.md';
export const CONCEPT_PATH = 'docs/payments/specs/retries.md';

// A single-topic durable design note OUTSIDE the bundle. It has NO frontmatter —
// it is ad-hoc documentation, not yet a concept — and lives under notes/, so the
// docs validator never sees it. The sentinel lets the read-only cases prove it
// was left byte-preserved during classification/denial.
const NOTE =
  '# Payment retry design\n\n' +
  'Design notes for how the payment gateway retries a failed charge.\n\n' +
  'The gateway retries a failed charge up to five times before giving up; the limit\n' +
  'lives in the `MAX_RETRIES` symbol in `src/gateway.js`. (SENTINEL note-retry-design)\n\n' +
  'Backoff is exponential with jitter. A charge that still fails after the last attempt\n' +
  'is surfaced to the caller as a permanent failure.\n';

// The source that POINTS at the ad-hoc note. Its comment is the existing pointer
// AC5 keeps valid: after an import without approved deletion, the note stays put.
const GATEWAY_SRC = 'export const MAX_RETRIES = 5; // retry design: see notes/retry-design.md\n';

// The full ordered input list all three cases spread verbatim. The shared
// empty-payments baseline (scaffold with an empty-Specifications payments index +
// the two subsystem-baseline logs) is COMMITTED, as are this file's candidate note
// and source (no `uncommitted` flag), so buildFixture's baseline commit contains
// everything: a read-only classification/denial leaves the tree exactly at that
// commit (git-unchanged), while an approved import dirties the working tree without
// a commit (git-uncommitted).
export const migrationInputs = [
  ...emptyPaymentsBaseline,
  { path: NOTE_PATH, content: NOTE },
  { path: 'src/gateway.js', content: GATEWAY_SRC },
];
