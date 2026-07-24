// Approve/write case for docs-autoresearch (issue #58, spec §docs-autoresearch,
// DEFAULT Reference-enrichment mode). Sibling of the deny-gate case: this
// directory is `docs-autoresearch-approve` but the manifest projects the real
// `docs-autoresearch` skill (via `skill` below), so one skill carries both a
// deny-gate case and this positive-write case. The deny case proves the GATE and
// the full Git guarantee on the no-op path; this case proves the PRIMARY happy
// path — AC3 (ONE curated multi-source Reference in the default shape, no raw
// source bodies), AC9 (filed through docs-add with exactly one references-index
// bullet + one nearest-log Creation entry, at most three concepts) and AC10
// (validate and read back; the fenced execution-trace shows read-only workers and
// a sole-writing coordinator). Turn 1 (prompt.md) presents the plan and pauses;
// the follow-up (approve.md) approves, so the write only happens after approval.
// The write legitimately dirties the working tree, so git-unchanged is NOT
// asserted here (the deny case owns that guarantee); git-uncommitted proves the
// write left Git otherwise untouched, and bait assertions prove ONLY the
// references index and log — not the root — changed.
import { scaffold, REF_PATH } from '../_docs-autoresearch-assets.mjs';

export default {
  skill: 'docs-autoresearch',
  followUps: ['approve.md'],
  inputs: [...scaffold],
  assertions: [
    // AC3 + AC10: after approval exactly one curated Reference exists at the
    // planned path...
    { type: 'file-exists', path: REF_PATH },
    // ...as a conformant Reference (frontmatter type landed — the read-back)...
    { type: 'file-contains', path: REF_PATH, value: 'type: Reference' },
    // ...carrying the default Reference shape and a real Citations section (a
    // curated multi-source synthesis, not raw bodies).
    { type: 'file-contains', path: REF_PATH, value: 'Key Findings' },
    { type: 'file-contains', path: REF_PATH, value: 'Citations' },
    // AC9 bookkeeping: the references index gained the one bullet linking the new
    // concept, and the NEAREST (references) log gained one dated Creation entry.
    // The shared baseline log seeds a NON-Creation verb (see _docs-autoresearch-
    // assets.mjs), so the `**Creation**` check proves a NEW Creation entry from the
    // run — not the baseline — and the slug check proves that entry names the concept.
    { type: 'file-contains', path: 'docs/references/index.md', value: 'semver-precedence.md' },
    { type: 'file-contains', path: 'docs/references/log.md', value: '**Creation**' },
    { type: 'file-contains', path: 'docs/references/log.md', value: 'semver-precedence.md' },
    // "updated once, in the right place" bait: the entry went to the NEAREST
    // references log/index only — the root log and root index were left untouched.
    { type: 'file-not-contains', path: 'docs/log.md', value: 'semver' },
    { type: 'file-not-contains', path: 'docs/index.md', value: 'semver' },
    // AC10 on the WRITE path: a genuine write that leaves Git untouched — HEAD
    // still at the baseline, nothing staged, no remote (so no push/PR possible).
    { type: 'git-uncommitted' },
    // AC10 observable fanout contract: the fenced execution-trace shows the
    // Round-1 workers are read-only and never delegate, and the coordinator is the
    // sole writer. (Checked live by the oracle; not run in CI.)
    { type: 'trace-field', path: 'coordinator.soleWriter', equals: true },
    { type: 'trace-every', path: 'rounds.0.workers', field: 'delegated', equals: false },
    { type: 'trace-field', path: 'fetch.cap', equals: 20 },
    // Live AC8 evidence: turn 1 named the concept path in its filing plan BEFORE
    // the write.
    { type: 'output-contains', value: 'semver-precedence.md' },
    // Static shared-reader contract over the projected pack (AC1).
    { type: 'portable-contract' },
  ],
};
