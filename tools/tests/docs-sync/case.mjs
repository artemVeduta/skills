// Central test case for docs-sync (issue #54, spec §docs-sync, branch mode). The
// scenario is the MODE/TARGET gate, only observable on a NO-WRITE path: on any
// path that reconciles, the end state cannot distinguish "waited for a mode and
// target" from "reconciled eagerly", so a turn that withholds the selection is
// the only way to prove "performs no write before the user selects branch mode
// AND a target branch" (AC1) and "never stages, commits, pushes, or opens a PR"
// (AC10). Turn 1 (prompt.md) makes an ambiguous request; docs-sync must ask which
// MODE and — for branch sync — which TARGET BRANCH, and write nothing. The
// follow-up (cancel.md) withholds the selection and cancels. The deterministic
// oracle then proves the bundle and Git state sit exactly at the fixture baseline
// (git-unchanged), and the stale bait Specification was never edited.
import { readFile } from 'node:fs/promises';

// Real bytes from THIS repo, so the fixture's lifecycle policy and validator are
// the canonical ones docs-sync reads (and, on a real reconcile, would run).
const policy = await readFile(new URL('../../../docs/conventions/documentation.md', import.meta.url), 'utf8');
const validator = await readFile(new URL('../../../scripts/validate-docs.mjs', import.meta.url), 'utf8');

// The stale bait: a Specification whose prose still describes the OLD retry count.
// A reconcile would rewrite it — so its survival proves nothing was reconciled
// before a mode and target were chosen.
const SPEC_PATH = 'docs/payments/specs/retries.md';
const STALE_SPEC =
  '---\ntype: Specification\ntitle: Payment retry policy\ndescription: How the payment gateway retries a failed charge.\ntimestamp: 2026-07-20\n---\n\n# Payment retry policy\n\nThe gateway retries a failed charge up to THREE times before giving up. (SENTINEL stale-retry-count)\n';

const LOG = '## 2026-07-20\n\n- **Creation** — subsystem baseline.\n';

export default {
  skill: 'docs-sync',
  followUps: ['cancel.md'],
  inputs: [
    // Project-memory routing for the portable contract: the exact shim + AGENTS.md.
    { path: 'CLAUDE.md', content: '@AGENTS.md\n' },
    {
      path: 'AGENTS.md',
      content:
        'Workspace with an OKF v0.1 docs/ bundle. Lifecycle policy: docs/conventions/documentation.md. Use docs-sync to reconcile the bundle with branch work.\n',
    },
    // Runnable validator machinery (so a real reconcile could run docs:validate).
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
    // A small conformant bundle with a payments subsystem and the stale bait.
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
      content:
        '# payments\n\nPayment processing subsystem.\n\n## Specifications\n\n- [Payment retry policy](/payments/specs/retries.md) - retry mechanics\n',
    },
    { path: 'docs/payments/log.md', content: LOG },
    { path: 'docs/payments/specs/retries.md', content: STALE_SPEC },
    // A source file the branch "changed" — a real reconcile target, but off-limits
    // until a mode and target are chosen.
    { path: 'src/gateway.js', content: 'export const MAX_RETRIES = 5; // raised from 3\n' },
  ],
  assertions: [
    // Headline: with no mode/target selected and the request cancelled, the
    // fixture stays EXACTLY at its baseline commit — nothing written, staged,
    // committed, pushed, or PR'd (AC1 gate + AC10).
    { type: 'git-unchanged' },
    // The stale Specification was NOT reconciled before a mode + target were
    // chosen: its old retry count survives verbatim.
    { type: 'file-contains', path: SPEC_PATH, value: 'stale-retry-count' },
    { type: 'file-not-contains', path: SPEC_PATH, value: 'MAX_RETRIES' },
    // Neither the parent index nor a log gained a reconciliation entry.
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: 'Update' },
    // Live AC1 evidence: turn 1 asked which MODE and which TARGET BRANCH before
    // writing. The prompt names neither a mode nor a branch, so both come from
    // the skill applying its gate, not from dictated tokens.
    { type: 'output-contains', value: 'mode' },
    { type: 'output-contains', value: 'target branch' },
    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
