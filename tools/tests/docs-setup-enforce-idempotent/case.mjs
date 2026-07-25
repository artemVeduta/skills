// Enforcement case: MANAGED-BLOCK IDEMPOTENCY — a rerun over installed
// enforcement neither duplicates nor reorders anything (issue #65, spec
// §docs-setup "Validation enforcement"). Projects the real `docs-setup` skill.
//
// The distinction from docs-setup-enforce-equivalent matters and is why these are
// two fixtures rather than one. There, enforcement was the REPOSITORY's own and
// setup had to recognize it as equivalent. Here the enforcement is SETUP'S OWN
// managed surface, already installed: the marked block sits on the pre-push path
// AFTER three unrelated commands, and the managed workflow is already byte-current.
// The judgement under test is not equivalence but idempotent replacement of a
// recognized managed block. Merging the two would leave whichever recognition path
// actually fired unknowable on failure.
//
// The oracle is `git-unchanged`, which is exactly the right strength: a byte-for-byte
// unchanged file cannot have gained a second block and cannot have had its
// commands reordered. The occurrence and ordering assertions beside it name those
// two properties so a failure reads as "duplicated" or "reordered" rather than
// only "the tree moved".
import {
  currentInstall,
  HUSKY_RUNTIME,
  HOOK_UNRELATED,
  MANAGED_BLOCK,
  UNRELATED_WORKFLOW,
  WORKFLOW_DEST,
  WORKFLOW_ASSET_PATH,
  PREPUSH,
  BLOCK_BEGIN,
  BLOCK_END,
  asset,
} from '../_setup-assets.mjs';

// The hook as a PRIOR docs-setup run left it: the repository's own commands first,
// the managed block appended at the end.
const INSTALLED_PREPUSH = `${HOOK_UNRELATED}\n${MANAGED_BLOCK}`;

export default {
  skill: 'docs-setup',
  // No follow-up: every managed surface including enforcement is byte-current, so
  // the plan is a no-change plan and there is nothing to approve.
  followUps: [],
  inputs: [
    ...currentInstall({ devDependencies: { husky: '^9.1.7' } }),
    { path: '.github/workflows/ci.yml', content: UNRELATED_WORKFLOW },
    // The managed workflow, already installed byte-current from the asset.
    { path: WORKFLOW_DEST, content: asset('github/workflows/docs-validate.yml') },
    { path: '.husky/_/husky.sh', content: HUSKY_RUNTIME },
    { path: PREPUSH, content: INSTALLED_PREPUSH },
  ],
  assertions: [
    // Live evidence: an already-enforced target is classified as a no-change plan.
    { type: 'output-contains', value: 'no-change' },

    // Headline: the rerun wrote nothing at all — byte-for-byte unchanged, so no
    // duplication and no reordering are even possible.
    { type: 'git-unchanged' },

    // The two properties named, so a failure is self-describing.
    { type: 'file-occurrences', path: PREPUSH, value: BLOCK_BEGIN, count: 1 },
    { type: 'file-occurrences', path: PREPUSH, value: BLOCK_END, count: 1 },
    { type: 'file-occurrences', path: PREPUSH, value: 'npm run docs:validate', count: 1 },
    {
      type: 'file-contains-ordered',
      path: PREPUSH,
      values: ['hook-lint-keep-me', 'hook-test-keep-me', 'hook-deploy-keep-me', BLOCK_BEGIN],
    },
    // The installed workflow is still byte-identical to the asset (a no-op row,
    // not a rewrite), and its two triggers are intact.
    { type: 'file-equals', path: WORKFLOW_DEST, against: WORKFLOW_ASSET_PATH },
    { type: 'file-contains', path: WORKFLOW_DEST, value: 'push:' },
    { type: 'file-contains', path: WORKFLOW_DEST, value: 'pull_request:' },
    { type: 'git-hooks-untouched' },

    { type: 'portable-contract' },
  ],
};
