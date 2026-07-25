// Enforcement case: EQUIVALENT EXISTING ENFORCEMENT on both surfaces — nothing
// is duplicated (issue #65, spec §docs-setup "Validation enforcement"). Projects
// the real `docs-setup` skill.
//
// Two required matrix rows, one fixture, because both are the same verdict
// (no-op) reached through the same equivalence set — and both are proven by the
// same single strongest oracle, `git-unchanged`:
//   - an equivalent existing WORKFLOW — `ci.yml` runs `npm run docs:check`, a
//     REPOSITORY-SPECIFIC script name whose `package.json` definition is
//     `node scripts/validate-docs.mjs`. Recognizing it requires following the
//     script name into `package.json`, not string-matching `docs:validate`;
//   - an equivalent existing HOOK INVOCATION THROUGH A WRAPPER — the pre-push
//     hook calls `./scripts/ci-checks.sh`, whose body reaches the same command.
//     Recognizing it requires following one indirection into the named file.
//
// Both indirections ARE resolvable read-only, so neither is ambiguous: this is the
// no-op verdict, and the ambiguous verdict is its own sibling case
// (docs-setup-enforce-ambiguous), where the wrapper body is unreadable.
//
// `git-unchanged` is the whole proof and it is exact: no managed workflow file
// appears, no managed block is added, both existing surfaces stay byte-identical,
// and nothing is staged or committed. A "safer to install it anyway" run — the
// tempting wrong answer — changes the tree and fails.
import { currentInstall, HUSKY_RUNTIME, WORKFLOW_DEST, PREPUSH, BLOCK_BEGIN } from '../_setup-assets.mjs';

// A workflow that reaches the validator through a repository-specific script name.
const EQUIVALENT_WORKFLOW = `name: ci

on:
  push:
  pull_request:

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm test
      - name: Documentation conformance
        run: npm run docs:check   # SENTINEL equivalent-workflow-keep-me
`;

// A repository wrapper script the hook calls; its body reaches the same command.
const WRAPPER = `#!/usr/bin/env sh
# SENTINEL wrapper-keep-me — this repository's own pre-push check runner.
set -e
npm run lint
npm run docs:validate
`;

const WRAPPED_PREPUSH = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

./scripts/ci-checks.sh   # SENTINEL wrapped-hook-keep-me
`;

export default {
  skill: 'docs-setup',
  // No follow-up: every enforcement surface is already conformant, so the plan is
  // a no-change plan and there is nothing to approve.
  followUps: [],
  inputs: [
    // `docs:check` is this repository's own name for the validator run.
    ...currentInstall({ scripts: { 'docs:check': 'node scripts/validate-docs.mjs' } }),
    { path: '.github/workflows/ci.yml', content: EQUIVALENT_WORKFLOW },
    { path: 'scripts/ci-checks.sh', content: WRAPPER },
    { path: '.husky/_/husky.sh', content: HUSKY_RUNTIME },
    { path: PREPUSH, content: WRAPPED_PREPUSH },
  ],
  assertions: [
    // Live evidence: existing enforcement was RECOGNIZED, and where.
    { type: 'output-contains', value: 'no-change' },
    { type: 'output-contains', value: 'docs:check' },
    { type: 'output-contains', value: 'ci-checks.sh' },

    // Headline: enforcement was not duplicated anywhere and nothing at all was
    // written, staged, or committed — the fixture stays EXACTLY at its baseline.
    { type: 'git-unchanged' },
    // Named explicitly so a failure says WHICH duplication happened rather than
    // only "the tree moved".
    { type: 'file-absent', path: WORKFLOW_DEST },
    { type: 'file-not-contains', path: PREPUSH, value: BLOCK_BEGIN },
    { type: 'file-contains', path: PREPUSH, value: 'wrapped-hook-keep-me' },
    { type: 'file-contains', path: '.github/workflows/ci.yml', value: 'equivalent-workflow-keep-me' },
    { type: 'file-contains', path: 'scripts/ci-checks.sh', value: 'wrapper-keep-me' },
    { type: 'git-hooks-untouched' },

    { type: 'portable-contract' },
  ],
};
