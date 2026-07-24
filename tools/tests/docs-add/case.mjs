// Central test case for docs-add (issue #51, spec §docs-add). The scenario is
// the approval GATE, which is only observable on a NO-WRITE path: on an approve
// path the end state cannot distinguish "waited for approval" from "wrote
// eagerly", so a DENY turn is the sole way to prove "writes only after
// approval" and "leaves staging, commits, remotes, and pull requests
// unchanged". Turn 1 (prompt.md) presents the complete filing plan and pauses;
// the follow-up (deny.md) refuses it. The deterministic oracle then proves
// nothing was written, staged, or committed (git-unchanged + file-absent),
// while turn 1's output carries the plan's elements (path, frontmatter,
// lifecycle entry) as live AC4 evidence.
import { readFile } from 'node:fs/promises';

// Real bytes from THIS repo, so the fixture's lifecycle policy and validator
// are the canonical ones the skill reads and (on approval) would run.
const policy = await readFile(new URL('../../../docs/conventions/documentation.md', import.meta.url), 'utf8');
const validator = await readFile(new URL('../../../scripts/validate-docs.mjs', import.meta.url), 'utf8');

// The concept the plan proposes; it must NOT exist after the denial.
const CONCEPT_PATH = 'docs/payments/decisions/idempotency-keys.md';

const LOG = '## 2026-07-24\n\n- **Creation** — subsystem baseline.\n';

export default {
  skill: 'docs-add',
  followUps: ['deny.md'],
  inputs: [
    // Project-memory routing for the portable contract: the exact shim + a real
    // AGENTS.md.
    { path: 'CLAUDE.md', content: '@AGENTS.md\n' },
    {
      path: 'AGENTS.md',
      content:
        'Workspace with an OKF v0.1 docs/ bundle. Lifecycle policy: docs/conventions/documentation.md. Use docs-add to file one concept.\n',
    },
    // Runnable validator machinery (so a read-back could run docs:validate).
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
    // A small, conformant bundle with a subsystem the concept would join.
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
    // Headline: on denial the fixture stays EXACTLY at its baseline commit —
    // nothing written, staged, committed, pushed, or PR'd (AC7 gate + AC8).
    { type: 'git-unchanged' },
    // The proposed concept was never created without approval.
    { type: 'file-absent', path: CONCEPT_PATH },
    // Neither the parent index nor the nearest log was touched.
    { type: 'file-not-contains', path: 'docs/payments/decisions/index.md', value: 'idempotency-keys' },
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: 'idempotency' },
    // Live AC4 evidence: turn 1's plan named the concept path, its frontmatter
    // type, and the lifecycle Creation entry BEFORE any write. The prompt names
    // only the destination path and calls the subject an "architectural
    // decision"; the `type: Decision` frontmatter and the `Creation` lifecycle
    // verb come from the skill applying the policy, not from dictated tokens.
    { type: 'output-contains', value: 'payments/decisions/idempotency-keys.md' },
    { type: 'output-contains', value: 'type: Decision' },
    { type: 'output-contains', value: 'Creation' },
    // Static shared-reader contract over the projected pack (AC1).
    { type: 'portable-contract' },
  ],
};
