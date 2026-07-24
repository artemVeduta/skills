// Approve/write case for docs-add (issue #51, spec §docs-add). Sibling variant
// of the deny-gate case: this directory is `docs-add-approve` but the manifest
// projects the real `docs-add` skill (via `skill` below), so one skill carries
// both a deny-gate case and this positive-write case. The deny case proves the
// GATE and the full Git guarantee on the no-op path; this case proves the
// PRIMARY happy path — AC7 (write the concept + exactly one parent index bullet
// + exactly one nearest-log Creation entry, nothing else) and AC8 (validate and
// read the result back). Turn 1 (prompt.md) presents the plan and pauses; the
// follow-up (approve.md) approves, so the write only happens after approval.
// The write legitimately dirties the working tree, so git-unchanged is NOT
// asserted here (the deny case owns that guarantee); instead bait assertions
// prove ONLY the exact index and log — and no other reserved file — changed.
import { readFile } from 'node:fs/promises';

// Real bytes from THIS repo, so the fixture's lifecycle policy and validator
// are the canonical ones the skill reads and (on approval) runs.
const policy = await readFile(new URL('../../../docs/conventions/documentation.md', import.meta.url), 'utf8');
const validator = await readFile(new URL('../../../scripts/validate-docs.mjs', import.meta.url), 'utf8');

// The concept the plan proposes; it must EXIST, conformant, after approval.
const CONCEPT_PATH = 'docs/payments/decisions/idempotency-keys.md';

const LOG = '## 2026-07-24\n\n- **Creation** — subsystem baseline.\n';

export default {
  skill: 'docs-add',
  followUps: ['approve.md'],
  inputs: [
    // Project-memory routing for the portable contract: the exact shim + a real
    // AGENTS.md.
    { path: 'CLAUDE.md', content: '@AGENTS.md\n' },
    {
      path: 'AGENTS.md',
      content:
        'Workspace with an OKF v0.1 docs/ bundle. Lifecycle policy: docs/conventions/documentation.md. Use docs-add to file one concept.\n',
    },
    // Runnable validator machinery, so the read-back step can run docs:validate.
    {
      path: 'package.json',
      content: `${JSON.stringify(
        { name: 'fixtureproj', private: true, scripts: { 'docs:validate': 'node scripts/validate-docs.mjs' } },
        null,
        2,
      )}\n`,
    },
    { path: 'package-lock.json', content: '{\n  "lockfileVersion": 3\n}\n' },
    { path: 'scripts/validate-docs.mjs', content: validator },
    // A small, conformant bundle with a subsystem the concept joins.
    {
      path: 'docs/index.md',
      content:
        '---\nokf_version: "0.1"\n---\n\n# Fixture bundle\n\n## Repo-wide\n\n- [Conventions](/conventions/index.md) - repo-wide rules\n\n## Subsystems\n\n- [payments](/payments/index.md) - payment processing\n',
    },
    { path: 'docs/log.md', content: LOG },
    {
      path: 'docs/conventions/index.md',
      content: '# Conventions\n\n- [Documentation lifecycle policy](/conventions/documentation.md) - the docs flow\n',
    },
    { path: 'docs/conventions/documentation.md', content: policy },
    {
      path: 'docs/payments/index.md',
      content: '# payments\n\nPayment processing subsystem.\n\n## Decisions\n\n- [Decisions](/payments/decisions/index.md) - durable choices\n',
    },
    { path: 'docs/payments/log.md', content: LOG },
    { path: 'docs/payments/decisions/index.md', content: '# payments decisions\n\nDurable payment decisions.\n' },
  ],
  assertions: [
    // AC7 + AC8: after approval the concept was written at the approved path...
    { type: 'file-exists', path: CONCEPT_PATH },
    // ...as a conformant Decision (frontmatter landed) with real body content
    // — the read-back evidence.
    { type: 'file-contains', path: CONCEPT_PATH, value: 'type: Decision' },
    { type: 'file-contains', path: CONCEPT_PATH, value: 'idempotency' },
    // The exact PARENT index gained the one bullet linking the new concept.
    { type: 'file-contains', path: 'docs/payments/decisions/index.md', value: 'idempotency-keys.md' },
    // The NEAREST log gained one dated Creation entry linking the new concept.
    { type: 'file-contains', path: 'docs/payments/log.md', value: '**Creation**' },
    { type: 'file-contains', path: 'docs/payments/log.md', value: 'idempotency-keys.md' },
    // "updated once, in the right place" bait: the entry went to the NEAREST log
    // and PARENT index only — the root log, root index, and an unrelated
    // subsystem-sibling index were left untouched.
    { type: 'file-not-contains', path: 'docs/log.md', value: 'idempotency' },
    { type: 'file-not-contains', path: 'docs/index.md', value: 'idempotency' },
    { type: 'file-not-contains', path: 'docs/conventions/index.md', value: 'idempotency' },
    // Live AC4 evidence: turn 1's plan named the concept path BEFORE the write.
    { type: 'output-contains', value: 'payments/decisions/idempotency-keys.md' },
    // Static shared-reader contract over the projected pack (AC1).
    { type: 'portable-contract' },
  ],
};
