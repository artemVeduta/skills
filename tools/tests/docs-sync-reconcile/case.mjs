// Reconcile/idempotence case for docs-sync (issue #54, spec §docs-sync, branch
// mode). Sibling of the gate case: this directory is `docs-sync-reconcile` but the
// manifest projects the real `docs-sync` skill (via `skill` below), so one skill
// carries both the mode/target gate case and this case. The gate case proves
// nothing is written before a mode + target are chosen; this case proves the
// IDEMPOTENCE + no-Git-mutation guarantee on a DOCS-ONLY branch reconcile (AC3,
// AC9, AC10) — the git-unchanged seam the branch flow is built around.
//
// The fixture is a fully-committed, self-consistent docs-only bundle: the
// Specification's prose already matches the source it cites (five retries in both
// `src/gateway.js` and `docs/payments/specs/retries.md`), its timestamp is current,
// and it is correctly indexed and logged. Reconciling this branch against its base
// (target `master`, the fixture's own branch — merge-base resolves to HEAD, so the
// branch introduces no divergence) finds every affected concept already current and
// writes NOTHING. Running the same sync from the same boundary therefore leaves the
// bundle byte-for-byte unchanged — git-unchanged is the deterministic proof of both
// idempotence and the untouched Git state (no staging, commit, push, or remote).
import { readFile } from 'node:fs/promises';

const policy = await readFile(new URL('../../../docs/conventions/documentation.md', import.meta.url), 'utf8');
const validator = await readFile(new URL('../../../scripts/validate-docs.mjs', import.meta.url), 'utf8');

// The Specification is ALREADY reconciled with its source: both say five retries.
const SPEC_PATH = 'docs/payments/specs/retries.md';
const CURRENT_SPEC =
  '---\ntype: Specification\ntitle: Payment retry policy\ndescription: How the payment gateway retries a failed charge.\ntimestamp: 2026-07-24\n---\n\n# Payment retry policy\n\nThe gateway retries a failed charge up to five times before giving up — see `src/gateway.js` (`MAX_RETRIES`). (SENTINEL reconciled-retry-count)\n';

const LOG = '## 2026-07-24\n\n- **Creation** — payment retry policy documented for this branch.\n';

export default {
  skill: 'docs-sync',
  inputs: [
    { path: 'CLAUDE.md', content: '@AGENTS.md\n' },
    {
      path: 'AGENTS.md',
      content:
        'Workspace with an OKF v0.1 docs/ bundle. Lifecycle policy: docs/conventions/documentation.md. Use docs-sync to reconcile the bundle with branch work.\n',
    },
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
    { path: 'docs/payments/specs/retries.md', content: CURRENT_SPEC },
    // The source the Specification already describes correctly — no divergence.
    { path: 'src/gateway.js', content: 'export const MAX_RETRIES = 5;\n' },
  ],
  assertions: [
    // Headline: the docs-only branch is already reconciled, so syncing it from the
    // same boundary changes nothing — the fixture stays EXACTLY at its baseline
    // commit (idempotence, AC9) with nothing staged, committed, pushed, or PR'd
    // (AC10). git-unchanged is the byte-for-byte proof of both.
    { type: 'git-unchanged' },
    // The already-current Specification is intact (not needlessly rewritten) and
    // its lifecycle log gained no operational reconciliation entry.
    { type: 'file-contains', path: SPEC_PATH, value: 'reconciled-retry-count' },
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: 'docs-sync ran' },
    { type: 'file-not-contains', path: 'docs/payments/log.md', value: '**Update**' },
    // Live evidence: the run selected branch mode and used the named target branch
    // to compute scope. The prompt names the target once; "branch"/"master" in the
    // report reflect the skill computing the merge-base boundary, not a dictated
    // outcome.
    { type: 'output-contains', value: 'branch' },
    { type: 'output-contains', value: 'master' },
    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
