// Enforcement case: BOTH surfaces available (issue #65, spec §docs-setup
// "Validation enforcement"). Sibling of the #52/#53 setup cases; this directory
// is `docs-setup-enforce-both` and the manifest projects the real `docs-setup`
// skill.
//
// The fixture is a repository already at the current managed state EXCEPT for
// enforcement, and it carries BOTH capabilities:
//   - GitHub evidence — an existing `.github/workflows/` tree holding an
//     unrelated `ci.yml` that does NOT invoke docs validation, so no equivalent
//     exists and the dedicated managed workflow is installable;
//   - an ACTIVE, repository-owned Husky configuration — the manager's internal
//     `_/husky.sh` helper beside a real `pre-push` file that already runs three
//     unrelated commands.
//
// Because everything else is byte-current, the ONLY plan rows are the two
// enforcement rows. That is what makes `git-only-paths` a legible oracle here:
// the change set must EQUAL the managed workflow plus the pre-push hook, so any
// other write — a rewritten `ci.yml`, a touched bundle file, a `prepare` script,
// a native hook committed into the tree — fails by name.
//
// This case carries the enforcement assertions that need a WRITE to be
// observable at all: both workflow triggers, complete-bundle pre-push validation,
// the block appended EXACTLY once, byte-preserved unrelated hook commands, an
// untouched unrelated CI workflow, and the absence of native-Git and
// remote-governance mutation.
import {
  currentInstall,
  HUSKY_RUNTIME,
  HOOK_UNRELATED,
  UNRELATED_WORKFLOW,
  WORKFLOW_DEST,
  WORKFLOW_ASSET_PATH,
  PREPUSH,
  BLOCK_BEGIN,
  BLOCK_END,
} from '../_setup-assets.mjs';

export default {
  skill: 'docs-setup',
  followUps: ['approve.md'],
  inputs: [
    ...currentInstall(),
    // GitHub evidence: the workflows directory exists. Its occupant deliberately
    // does NOT reach the validator, so there is no equivalent invocation.
    { path: '.github/workflows/ci.yml', content: UNRELATED_WORKFLOW },
    // An ACTIVE Husky configuration the repository already owns.
    { path: '.husky/_/husky.sh', content: HUSKY_RUNTIME },
    { path: PREPUSH, content: HOOK_UNRELATED },
  ],
  assertions: [
    // Live evidence: turn 1 recognized both capabilities before writing anything.
    { type: 'output-contains', value: 'GitHub' },
    { type: 'output-contains', value: 'Husky' },

    // --- the managed GitHub workflow ---------------------------------------
    // Byte-identical to the shipped asset: the strongest single proof, pinning
    // both triggers, the strict step, and the unscoped invocation at once.
    { type: 'file-equals', path: WORKFLOW_DEST, against: WORKFLOW_ASSET_PATH },
    // The two required triggers, named explicitly so a future asset edit that
    // dropped one fails on the CONTRACT and not merely on byte drift.
    { type: 'file-contains', path: WORKFLOW_DEST, value: 'push:' },
    { type: 'file-contains', path: WORKFLOW_DEST, value: 'pull_request:' },
    // Never modify arbitrary CI logic: the unrelated workflow is byte-identical
    // to its baseline content.
    { type: 'file-unchanged', path: '.github/workflows/ci.yml' },

    // --- the managed pre-push block ----------------------------------------
    // One identifiable managed block between the stable markers...
    { type: 'file-contains', path: PREPUSH, value: BLOCK_BEGIN },
    { type: 'file-contains', path: PREPUSH, value: BLOCK_END },
    // ...appended EXACTLY once (a duplicate would satisfy file-contains).
    { type: 'file-occurrences', path: PREPUSH, value: BLOCK_BEGIN, count: 1 },
    { type: 'file-occurrences', path: PREPUSH, value: BLOCK_END, count: 1 },
    // The guard validates the COMPLETE bundle on every push: the plain script,
    // no arguments and no scoping.
    { type: 'file-contains', path: PREPUSH, value: 'npm run docs:validate' },
    { type: 'file-not-contains', path: PREPUSH, value: 'docs:validate -' },
    { type: 'file-not-contains', path: PREPUSH, value: 'git diff' },
    { type: 'file-not-contains', path: PREPUSH, value: '--changed' },
    // Every unrelated hook command survives byte-intact...
    { type: 'file-contains', path: PREPUSH, value: 'npm run lint          # SENTINEL hook-lint-keep-me' },
    { type: 'file-contains', path: PREPUSH, value: 'npm test              # SENTINEL hook-test-keep-me' },
    { type: 'file-contains', path: PREPUSH, value: './scripts/deploy-check.sh   # SENTINEL hook-deploy-keep-me' },
    // ...in their original order, with the managed block APPENDED at the end
    // rather than spliced in front of the repository's own commands.
    {
      type: 'file-contains-ordered',
      path: PREPUSH,
      values: ['hook-lint-keep-me', 'hook-test-keep-me', 'hook-deploy-keep-me', BLOCK_BEGIN],
    },

    // --- what enforcement setup must NOT do --------------------------------
    // No native-Git mutation: `.git/hooks/` still holds only git's own samples
    // and `core.hooksPath` is still unset. Nothing else can see this — `.git/`
    // is outside the working tree, so a native hook passes every other git
    // assertion.
    { type: 'git-hooks-untouched' },
    // No commit, nothing staged, and NO REMOTE — with no remote there is no
    // GitHub API/CLI target, no branch protection, and no ruleset to configure,
    // so remote governance is provably untouched.
    { type: 'git-uncommitted' },
    // The exact change set: precisely the two enforcement files and nothing
    // else. This is the robust negative — a `prepare` script added to
    // package.json, an installed Husky, a rewritten `ci.yml`, or a repaired
    // bundle file all fail here by name.
    { type: 'git-only-paths', paths: [WORKFLOW_DEST, PREPUSH] },

    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
