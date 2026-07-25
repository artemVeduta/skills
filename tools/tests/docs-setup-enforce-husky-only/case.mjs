// Enforcement case: ACTIVE-HUSKY-ONLY, no GitHub evidence (issue #65, spec
// §docs-setup "Validation enforcement"). Projects the real `docs-setup` skill.
//
// The mirror image of the GitHub-only case. The fixture is current except for
// enforcement and has:
//   - an ACTIVE, repository-owned Husky configuration whose pre-push file does not
//     exist yet — so the managed block becomes that file's only content, the
//     "Husky is active but has no pre-push file yet" branch;
//   - NO GitHub evidence of any kind: no `.github/` directory, no workflow tree,
//     and (like every fixture) no remote. Absence of evidence must produce a
//     REPORTED SKIP — never a prompt, never a guess, and never a workflow file
//     added to an unrelated repository.
//
// The absence proof is the sharp one: `git-only-paths` requires the change set to
// be EXACTLY the hook, so creating `.github/workflows/docs-validate.yml` on a
// repository with no GitHub evidence fails by name rather than merely failing a
// `file-absent`.
import {
  currentInstall,
  HUSKY_RUNTIME,
  WORKFLOW_DEST,
  PREPUSH,
  BLOCK_BEGIN,
  BLOCK_END,
} from '../_setup-assets.mjs';

export default {
  skill: 'docs-setup',
  followUps: ['approve.md'],
  inputs: [
    ...currentInstall({ devDependencies: { husky: '^9.1.7' } }),
    // Active, repository-owned configuration: the manager's runtime helper plus a
    // real hook it already manages — but no pre-push file yet.
    { path: '.husky/_/husky.sh', content: HUSKY_RUNTIME },
    {
      path: '.husky/pre-commit',
      content: '#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\nnpm run lint   # SENTINEL precommit-keep-me\n',
    },
  ],
  assertions: [
    // Live evidence: no GitHub evidence found, reported as a skip.
    { type: 'output-contains', value: 'skip' },
    { type: 'output-contains', value: 'GitHub' },

    // The pre-push file was created with the managed block, exactly once.
    { type: 'file-exists', path: PREPUSH },
    { type: 'file-contains', path: PREPUSH, value: BLOCK_BEGIN },
    { type: 'file-contains', path: PREPUSH, value: BLOCK_END },
    { type: 'file-occurrences', path: PREPUSH, value: BLOCK_BEGIN, count: 1 },
    // The COMPLETE bundle on every push — the plain script, unscoped.
    { type: 'file-contains', path: PREPUSH, value: 'npm run docs:validate' },
    { type: 'file-not-contains', path: PREPUSH, value: 'git diff' },
    { type: 'file-not-contains', path: PREPUSH, value: '--changed' },
    // The unrelated hook the manager already owns is byte-preserved: setup writes
    // the pre-push path and nothing else in the hook tree.
    { type: 'file-unchanged', path: '.husky/pre-commit' },

    // No GitHub surface was invented on a repository with no GitHub evidence.
    { type: 'file-absent', path: WORKFLOW_DEST },
    // Husky itself was untouched — no install, no init, no dependency change.
    { type: 'file-unchanged', path: 'package.json' },
    { type: 'file-unchanged', path: '.husky/_/husky.sh' },
    { type: 'git-hooks-untouched' },
    { type: 'git-uncommitted' },
    // Exactly one file changed: the pre-push hook.
    { type: 'git-only-paths', paths: [PREPUSH] },

    { type: 'portable-contract' },
  ],
};
