// Clean-worktree UPGRADE case for docs-setup (issue #53, spec §docs-setup).
// Sibling of the #52 fresh cases; this directory is `docs-setup-upgrade` but the
// manifest projects the real `docs-setup` skill. The fixture is a repository that
// a PRIOR docs-setup already configured — complete, current `docs/` bundle, both
// package scripts, the marked AGENTS.md router, the CLAUDE.md shim, and the
// canonical validator TEST — EXCEPT that `scripts/validate-docs.mjs` has been
// replaced with an older/customized stub. So the recomputed state is UPGRADE, not
// fresh: managed machinery is present but one managed file DIFFERS.
//
// Turn 1 (prompt.md) audits read-only, recomputes state (never reading/writing a
// suite-version file), classifies UPGRADE, shows the CLEAN worktree, and presents
// the plan — the differing validator is customized-until-reviewed (never blindly
// overwritten), current files are no-ops, the marked router is replaced
// idempotently, and unrelated guidance is byte-preserved — then STOPS. The
// follow-up (approve.md) explicitly authorizes replacing the differing validator
// with the canonical machinery. The oracle then proves the reviewed replacement
// landed byte-identical to the asset, the old sentinel is gone, unrelated content
// survived, and Git was left otherwise untouched (git-uncommitted on the write
// path).
//
// Assets are read and per-install-substituted here (date/project/pm) so the
// fixture is a GENUINELY current install, not an approximation. Self-contained
// per case (the isolation pattern kept in #52): no shared fixture module.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '../../../skills/docs-setup/assets');
const asset = (rel) => readFileSync(join(ASSETS, rel), 'utf8');
const installed = (rel) =>
  asset(rel)
    .replaceAll('<YYYY-MM-DD>', '2026-07-24')
    .replaceAll('<PROJECT>', 'FixtureProj')
    .replaceAll('pnpm docs:validate', 'npm run docs:validate')
    .replaceAll('<pm>', 'npm run');
// docs/index.md drops the placeholder subsystem bullet when there are no subsystems.
const indexMd = installed('docs/index.md')
  .split('\n')
  .filter((l) => !l.includes('<subsystem>'))
  .join('\n');

const AGENTS = `# fixtureproj

## House rules

- Build with \`make build\` before pushing. (SENTINEL house-rule-keep-me)

${installed('agents/documentation-block.md')}`;

// The one DIFFERING managed file: an older/customized validator. docs-setup must
// treat it as customized-until-reviewed and never blindly overwrite it.
const OLD_VALIDATOR = `#!/usr/bin/env node
// OKF-OLD-VALIDATOR-SENTINEL — an older/customized docs validator predating the
// canonical v2 machinery. It differs from the shipped asset, so a recomputed
// state is UPGRADE and this file is customized-until-reviewed.
console.log('old docs validator (stub)');
process.exit(0);
`;

export default {
  skill: 'docs-setup',
  followUps: ['approve.md'],
  inputs: [
    { path: 'CLAUDE.md', content: '@AGENTS.md\n' },
    { path: 'AGENTS.md', content: AGENTS },
    { path: 'README.md', content: '# fixtureproj\n\nA fixture project. (SENTINEL readme-keep-me)\n' },
    {
      path: 'package.json',
      content: `${JSON.stringify(
        {
          name: 'fixtureproj',
          private: true,
          scripts: {
            'docs:validate': 'node scripts/validate-docs.mjs',
            'docs:validate:test': 'node --test scripts/validate-docs.test.mjs',
          },
        },
        null,
        2,
      )}\n`,
    },
    { path: 'package-lock.json', content: '{\n  "lockfileVersion": 3\n}\n' },
    // Present-and-current managed files (must be NO-OPS).
    { path: 'scripts/validate-docs.test.mjs', content: asset('scripts/validate-docs.test.mjs') },
    { path: 'docs/index.md', content: indexMd },
    { path: 'docs/log.md', content: installed('docs/log.md') },
    { path: 'docs/conventions/index.md', content: asset('docs/conventions/index.md') },
    { path: 'docs/conventions/documentation.md', content: installed('docs/conventions/documentation.md') },
    { path: 'docs/glossary/index.md', content: asset('docs/glossary/index.md') },
    { path: 'docs/references/index.md', content: asset('docs/references/index.md') },
    { path: 'docs/references/okf.md', content: installed('docs/references/okf.md') },
    // The one DIFFERING managed file — customized-until-reviewed.
    { path: 'scripts/validate-docs.mjs', content: OLD_VALIDATOR },
  ],
  assertions: [
    // Live AC evidence: turn 1 recomputed the state and classified it UPGRADE
    // (managed machinery present, one file differs) before any mutation.
    { type: 'output-contains', value: 'upgrade' },
    // The differing validator was customized-until-reviewed, then — after the
    // explicit approval to replace it — reinstalled byte-identical to the
    // canonical asset (nothing blindly overwritten; the review authorized it).
    {
      type: 'file-equals',
      path: 'scripts/validate-docs.mjs',
      against: 'skills/docs-setup/assets/scripts/validate-docs.mjs',
    },
    // The old customized content is gone (the reviewed replacement happened)...
    { type: 'file-not-contains', path: 'scripts/validate-docs.mjs', value: 'OKF-OLD-VALIDATOR-SENTINEL' },
    // ...and the already-current test file stayed byte-identical (a no-op).
    {
      type: 'file-equals',
      path: 'scripts/validate-docs.test.mjs',
      against: 'skills/docs-setup/assets/scripts/validate-docs.test.mjs',
    },
    // The marked wiring is present (replaced idempotently) and unrelated project
    // guidance is byte-preserved (splice, not clobber).
    { type: 'file-contains', path: 'AGENTS.md', value: 'BEGIN OKF docs router' },
    { type: 'file-contains', path: 'AGENTS.md', value: 'house-rule-keep-me' },
    { type: 'file-contains', path: 'README.md', value: 'readme-keep-me' },
    // AC on the WRITE path: the upgrade left Git otherwise untouched — HEAD at
    // baseline, nothing staged, no remote (git-uncommitted; the tree is
    // legitimately dirtied by the reviewed replacement).
    { type: 'git-uncommitted' },
    // Static shared-reader contract over the projected pack (parity).
    { type: 'portable-contract' },
  ],
};
