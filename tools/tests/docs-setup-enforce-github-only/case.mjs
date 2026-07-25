// Enforcement case: GITHUB-ONLY, and the hook manager is a DEPENDENCY WITHOUT
// CONFIGURATION (issue #65, spec §docs-setup "Validation enforcement"). Projects
// the real `docs-setup` skill.
//
// One fixture proves two required matrix rows because they are the same observable
// outcome reached by two independent judgements:
//   - GitHub-only — GitHub evidence exists and no equivalent workflow does, so the
//     dedicated managed workflow is installed;
//   - inactive Husky — `package.json` carries a `husky` devDependency and a
//     `prepare` script, but there is NO initialized configuration: no `.husky/`
//     tree, no hooks directory, no helper runtime. That is explicitly INSUFFICIENT
//     evidence, so local-hook installation is SKIPPED and the skip is reported.
//
// Keeping them together is deliberate rather than lazy: a fixture that had GitHub
// evidence and no husky line at all would prove the skip only for the trivial
// reason that nothing was there. Pairing the two makes the skip a real judgement —
// the tempting wrong answer (a dependency plus a `prepare` script LOOKS like an
// active hook manager) is present in the fixture and must still be refused. What
// failed stays unambiguous: the workflow assertions and the hook assertions name
// different paths.
import {
  currentInstall,
  UNRELATED_WORKFLOW,
  WORKFLOW_DEST,
  WORKFLOW_ASSET_PATH,
  PREPUSH,
} from '../_setup-assets.mjs';

export default {
  skill: 'docs-setup',
  followUps: ['approve.md'],
  inputs: [
    // A `husky` devDependency AND a `prepare` script — the strongest form of
    // "looks installed but is not configured". No `.husky/` tree is seeded.
    ...currentInstall({
      scripts: { prepare: 'husky' },
      devDependencies: { husky: '^9.1.7' },
    }),
    { path: '.github/workflows/ci.yml', content: UNRELATED_WORKFLOW },
  ],
  assertions: [
    // Live evidence: the audit reported the enforcement judgement — GitHub found,
    // no active hook manager configuration, so the local hook is a reported SKIP
    // naming what was looked for.
    { type: 'output-contains', value: 'skip' },
    { type: 'output-contains', value: 'Husky' },

    // The managed workflow was installed, byte-identical to the shipped asset,
    // on both required events.
    { type: 'file-equals', path: WORKFLOW_DEST, against: WORKFLOW_ASSET_PATH },
    { type: 'file-contains', path: WORKFLOW_DEST, value: 'push:' },
    { type: 'file-contains', path: WORKFLOW_DEST, value: 'pull_request:' },
    { type: 'file-unchanged', path: '.github/workflows/ci.yml' },

    // The skip is real: NO hook file was created anywhere in a hook manager tree.
    { type: 'file-absent', path: PREPUSH },
    { type: 'file-absent', path: '.husky/_/husky.sh' },
    // Husky was neither installed nor initialized: `package.json` is byte-identical
    // to its baseline, so no dependency was added and the existing `prepare`
    // script was not rewritten or invoked into existence.
    { type: 'file-unchanged', path: 'package.json' },
    { type: 'file-unchanged', path: 'package-lock.json' },
    // And the fallback was NOT a native git hook.
    { type: 'git-hooks-untouched' },
    { type: 'git-uncommitted' },
    // Exactly one file changed: the managed workflow.
    { type: 'git-only-paths', paths: [WORKFLOW_DEST] },

    { type: 'portable-contract' },
  ],
};
