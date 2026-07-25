// Enforcement case: AMBIGUOUS ENFORCEMENT SURFACE — it BLOCKS (issue #65, spec
// §docs-setup "Validation enforcement" / references/enforcement.md "Ambiguous
// enforcement"). Projects the real `docs-setup` skill.
//
// The fixture puts an unresolvable indirection on each surface:
//   - a WORKFLOW step that runs `make ci` — a Makefile target whose recipe is
//     `@$(CI_RUNNER) $(CI_ARGS)`, with both variables supplied from the CI
//     environment and defined nowhere in the repository. The step MIGHT reach the
//     validator and might not, and no read-only inspection can settle it;
//   - a PRE-PUSH hook that calls a wrapper `./tools/hooks/run-checks` which is not
//     present in the repository at all, so the indirection cannot be resolved
//     read-only either.
//
// The contract's answer is the same for both: present the ambiguity in the plan and
// resolve it with the user BEFORE writing. Never guess — neither "it probably
// covers docs, skip" nor "install alongside just in case" is admissible.
//
// The gate is only observable on a NO-WRITE path, exactly like the #52 approval
// gate: on a write path the end state cannot distinguish "asked, was answered,
// wrote" from "guessed and wrote". So the follow-up declines to resolve the
// ambiguity, and `git-unchanged` proves the run wrote nothing rather than picking
// an answer for the user.
import { currentInstall, HUSKY_RUNTIME, WORKFLOW_DEST, PREPUSH, BLOCK_BEGIN } from '../_setup-assets.mjs';

const AMBIGUOUS_WORKFLOW = `name: ci

on:
  push:
  pull_request:

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Repository checks
        run: make ci   # SENTINEL ambiguous-workflow-keep-me
`;

// The indirection dead-ends: both variables come from the CI environment.
const MAKEFILE = `# SENTINEL ambiguous-makefile-keep-me
# CI_RUNNER and CI_ARGS are injected by the CI environment; they are not defined
# in this repository, so what \`make ci\` actually runs cannot be resolved here.
.PHONY: ci
ci:
	@$(CI_RUNNER) $(CI_ARGS)
`;

// The wrapper this hook calls is NOT present in the fixture.
const AMBIGUOUS_PREPUSH = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

./tools/hooks/run-checks   # SENTINEL ambiguous-hook-keep-me
`;

export default {
  skill: 'docs-setup',
  followUps: ['unresolved.md'],
  inputs: [
    ...currentInstall({ devDependencies: { husky: '^9.1.7' } }),
    { path: '.github/workflows/ci.yml', content: AMBIGUOUS_WORKFLOW },
    { path: 'Makefile', content: MAKEFILE },
    { path: '.husky/_/husky.sh', content: HUSKY_RUNTIME },
    { path: PREPUSH, content: AMBIGUOUS_PREPUSH },
  ],
  assertions: [
    // Live evidence: BOTH ambiguities were surfaced as ambiguities and completion
    // was blocked on them, before any write.
    { type: 'output-contains', value: 'ambiguous' },
    { type: 'output-contains', value: 'make ci' },
    { type: 'output-contains', value: 'run-checks' },

    // Headline: with the ambiguity unresolved, NOTHING was written, staged, or
    // committed — the fixture stays EXACTLY at its baseline commit.
    { type: 'git-unchanged' },
    // Neither of the two tempting guesses was taken: no managed workflow was
    // installed "just in case", and no managed block was added to the hook.
    { type: 'file-absent', path: WORKFLOW_DEST },
    { type: 'file-not-contains', path: PREPUSH, value: BLOCK_BEGIN },
    // The ambiguous surfaces themselves are byte-preserved, not "cleaned up".
    { type: 'file-contains', path: '.github/workflows/ci.yml', value: 'ambiguous-workflow-keep-me' },
    { type: 'file-contains', path: 'Makefile', value: 'ambiguous-makefile-keep-me' },
    { type: 'file-contains', path: PREPUSH, value: 'ambiguous-hook-keep-me' },
    { type: 'git-hooks-untouched' },

    { type: 'portable-contract' },
  ],
};
