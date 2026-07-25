// Enforcement case: CUSTOMIZED MANAGED BLOCK — an already-active Husky pre-push
// carrying a marker-delimited docs-validate block that has been EDITED is
// customized-until-reviewed like any other managed file (issue #65, spec
// §docs-setup "Validation enforcement"; references/enforcement.md — "A
// customized managed block (marker-delimited but edited) is
// customized-until-reviewed like any managed file: review, approval, then
// reinstall"). Projects the real `docs-setup` skill.
//
// The missing matrix cell among the other #65 enforcement fixtures: idempotent
// covers a block that is byte-CURRENT, equivalent covers enforcement reached
// through an entirely different invocation, and github-only/husky-only/both
// cover an ABSENT block. None seeds a hook whose managed block itself — inside
// its own stable markers — has been hand-edited, which is exactly what Issue
// #65's Testing Decisions name as "customized hooks" and what
// references/enforcement.md states explicitly. This is the mirror of
// docs-setup-upgrade (a differing MACHINERY file reviewed then reinstalled)
// applied to the pre-push BLOCK instead of the validator script.
//
// Turn 1 audits read-only and must recognize the block differs from the
// canonical bytes even though it carries the exact stable markers — markers
// alone are not proof of currency — and present it as customized-until-reviewed,
// never blindly overwritten. The follow-up (approve.md) explicitly authorizes
// the reinstall. The oracle then proves: the canonical block landed byte-for-byte
// (the full multi-line marker+command string, not a loose substring a
// still-customized line could also satisfy, since the edited line itself
// contains "npm run docs:validate" as a prefix), the customization sentinel is
// gone, the block was not duplicated, unrelated hook commands stayed
// byte-preserved in their original order with the reinstalled block still after
// them, no GitHub surface was invented, and Git state was left otherwise
// untouched.
import {
  currentInstall,
  HUSKY_RUNTIME,
  HOOK_UNRELATED,
  MANAGED_BLOCK,
  WORKFLOW_DEST,
  PREPUSH,
  BLOCK_BEGIN,
  BLOCK_END,
} from '../_setup-assets.mjs';

// The pre-push block as a user who customized it would have left it: the exact
// stable markers (so it is unambiguously "the managed block"), but a hand-edited
// command line. Deliberately NOT a superset of the canonical line — appending
// " --quiet" and a comment means the canonical multi-line block string
// (markers + bare `npm run docs:validate`) is NOT a substring of this fixture,
// so a case that only checked for the base command containing would wrongly
// treat "still customized" as "already reinstalled".
const CUSTOMIZED_BLOCK = `${BLOCK_BEGIN}\nnpm run docs:validate --quiet   # SENTINEL customized-block-keep-me\n${BLOCK_END}\n`;

// The hook as a prior docs-setup run left it and a user then customized: the
// repository's own commands first, the (now customized) managed block appended
// at the end — the same shape docs-setup-enforce-idempotent uses for the
// byte-current case, so the only variable under test is the block's content.
const CUSTOMIZED_PREPUSH = `${HOOK_UNRELATED}\n${CUSTOMIZED_BLOCK}`;

export default {
  skill: 'docs-setup',
  followUps: ['approve.md'],
  inputs: [
    ...currentInstall({ devDependencies: { husky: '^9.1.7' } }),
    // No GitHub evidence at all — this case isolates the customized-block
    // judgement from the workflow row, the same restriction
    // docs-setup-enforce-husky-only uses.
    { path: '.husky/_/husky.sh', content: HUSKY_RUNTIME },
    { path: PREPUSH, content: CUSTOMIZED_PREPUSH },
  ],
  assertions: [
    // Live evidence: turn 1 recognized the block as customized BEFORE writing
    // anything — never a silent overwrite of a marker-delimited file.
    { type: 'output-contains', value: 'customized' },

    // The canonical block landed byte-for-byte: the exact multi-line managed
    // block (markers + the plain unscoped command), not merely a substring a
    // still-customized file could also satisfy.
    { type: 'file-contains', path: PREPUSH, value: MANAGED_BLOCK },
    // The customization is genuinely GONE, not left alongside a reinstalled block.
    { type: 'file-not-contains', path: PREPUSH, value: 'customized-block-keep-me' },
    { type: 'file-not-contains', path: PREPUSH, value: '--quiet' },
    // Reinstalled exactly once — never appended as a second block beside the old one.
    { type: 'file-occurrences', path: PREPUSH, value: BLOCK_BEGIN, count: 1 },
    { type: 'file-occurrences', path: PREPUSH, value: BLOCK_END, count: 1 },
    { type: 'file-occurrences', path: PREPUSH, value: 'npm run docs:validate', count: 1 },

    // Unrelated hook commands stayed byte-preserved, in their original order,
    // with the reinstalled block still AFTER them (no reordering).
    { type: 'file-contains', path: PREPUSH, value: 'npm run lint          # SENTINEL hook-lint-keep-me' },
    { type: 'file-contains', path: PREPUSH, value: 'npm test              # SENTINEL hook-test-keep-me' },
    { type: 'file-contains', path: PREPUSH, value: './scripts/deploy-check.sh   # SENTINEL hook-deploy-keep-me' },
    {
      type: 'file-contains-ordered',
      path: PREPUSH,
      values: ['hook-lint-keep-me', 'hook-test-keep-me', 'hook-deploy-keep-me', BLOCK_BEGIN],
    },

    // No GitHub surface was invented — this case has no GitHub evidence at all.
    { type: 'file-absent', path: WORKFLOW_DEST },

    // Nothing else moved: Git state is untouched beyond the one reviewed file.
    { type: 'git-hooks-untouched' },
    { type: 'git-uncommitted' },
    { type: 'git-only-paths', paths: [PREPUSH] },

    { type: 'portable-contract' },
  ],
};
