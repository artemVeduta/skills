// Failing-legacy-bundle case: enforcement is installed ANYWAY, and machinery
// success is reported INDEPENDENTLY of content failure (issue #65, spec
// §docs-setup step 7 / references/enforcement.md §3). Projects the real
// `docs-setup` skill.
//
// The fixture is the state the two-stage upgrade order deliberately allows: a
// repository whose MACHINERY is current but whose BUNDLE is legacy and
// validation-FAILING. Two concepts carry hard content errors the strict validator
// exits `1` on — one with an empty `type`, one with unparseable frontmatter — and
// they are pre-existing: setup did not introduce them.
//
// Two things must both hold, and the tempting failure mode is to let either one
// swallow the other:
//   1. enforcement is installed regardless. A bundle that fails validation is
//      precisely the case enforcement exists for, so a pre-existing content error
//      never postpones it. "Wait for a clean bundle first" is the wrong answer.
//   2. the two results stay INDEPENDENT. A validator exit `1` is a BUNDLE result;
//      it must never classify the freshly installed machinery or enforcement as
//      uninstalled. "Setup failed" is the wrong answer.
//
// The oracle separates them cleanly. The enforcement files are asserted present
// and correct (machinery success, observable in repository state), while
// `file-unchanged` on both broken concepts proves setup did NOT repair content —
// repairing the bundle is a separate, explicitly invoked docs-sync run. And
// `git-only-paths` requires the change set to be EXACTLY the two enforcement
// files: a run that "helpfully" fixed the frontmatter fails by name.
import {
  currentInstall,
  HUSKY_RUNTIME,
  HOOK_UNRELATED,
  UNRELATED_WORKFLOW,
  WORKFLOW_DEST,
  WORKFLOW_ASSET_PATH,
  PREPUSH,
  BLOCK_BEGIN,
} from '../_setup-assets.mjs';

// Hard error 1: frontmatter present, `type` empty. The validator's exit-1 class.
const EMPTY_TYPE_CONCEPT = `---
type:
title: Legacy settlement notes
timestamp: 2025-11-02
---

# Legacy settlement notes

Notes carried over from the pre-bundle wiki. (SENTINEL legacy-empty-type-keep-me)
`;

// Hard error 2: unparseable frontmatter — no closing fence.
const UNPARSEABLE_CONCEPT = `---
type: Reference
title: Legacy gateway matrix

# Legacy gateway matrix

Imported table, never normalized. (SENTINEL legacy-unparseable-keep-me)
`;

const LEGACY_SUBSYSTEM_INDEX = `# legacy

Material imported from the old wiki, not yet migrated. (SENTINEL legacy-index-keep-me)
`;

export default {
  skill: 'docs-setup',
  followUps: ['approve.md'],
  inputs: [
    ...currentInstall({ devDependencies: { husky: '^9.1.7' } }),
    // The legacy, validation-failing bundle content.
    { path: 'docs/legacy/index.md', content: LEGACY_SUBSYSTEM_INDEX },
    { path: 'docs/legacy/settlement-notes.md', content: EMPTY_TYPE_CONCEPT },
    { path: 'docs/legacy/gateway-matrix.md', content: UNPARSEABLE_CONCEPT },
    // Both enforcement capabilities are present, so both surfaces are installable.
    { path: '.github/workflows/ci.yml', content: UNRELATED_WORKFLOW },
    { path: '.husky/_/husky.sh', content: HUSKY_RUNTIME },
    { path: PREPUSH, content: HOOK_UNRELATED },
  ],
  assertions: [
    // --- the two results, reported independently ---------------------------
    // Machinery/enforcement succeeded...
    { type: 'output-contains', value: 'tooling installed successfully' },
    // ...and the bundle result is reported separately as a content failure, with
    // the consequence stated plainly.
    { type: 'output-contains', value: 'bundle validates cleanly' },
    { type: 'output-contains', value: 'pushes remain blocked' },
    // The content errors are attributed to pre-existing content, not to setup.
    { type: 'output-contains', value: 'pre-existing' },

    // --- enforcement was installed even though the bundle fails ------------
    { type: 'file-equals', path: WORKFLOW_DEST, against: WORKFLOW_ASSET_PATH },
    { type: 'file-contains', path: WORKFLOW_DEST, value: 'push:' },
    { type: 'file-contains', path: WORKFLOW_DEST, value: 'pull_request:' },
    { type: 'file-contains', path: PREPUSH, value: BLOCK_BEGIN },
    { type: 'file-occurrences', path: PREPUSH, value: BLOCK_BEGIN, count: 1 },
    { type: 'file-contains', path: PREPUSH, value: 'npm run docs:validate' },
    { type: 'file-contains', path: PREPUSH, value: 'hook-deploy-keep-me' },

    // --- setup repaired no CONTENT -----------------------------------------
    // Both failing concepts are byte-identical to their baseline: fixing them is
    // an explicitly invoked docs-sync run, not an installation side effect.
    { type: 'file-unchanged', path: 'docs/legacy/settlement-notes.md' },
    { type: 'file-unchanged', path: 'docs/legacy/gateway-matrix.md' },
    { type: 'file-unchanged', path: 'docs/legacy/index.md' },
    { type: 'file-contains', path: 'docs/legacy/settlement-notes.md', value: 'legacy-empty-type-keep-me' },
    { type: 'file-contains', path: 'docs/legacy/gateway-matrix.md', value: 'legacy-unparseable-keep-me' },

    // The change set is EXACTLY the two enforcement files — a run that quietly
    // repaired the frontmatter to make its own validation pass fails here.
    { type: 'git-only-paths', paths: [WORKFLOW_DEST, PREPUSH] },
    { type: 'git-uncommitted' },
    { type: 'git-hooks-untouched' },

    { type: 'portable-contract' },
  ],
};
