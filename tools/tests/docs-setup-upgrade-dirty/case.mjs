// Dirty-worktree UPGRADE gate case for docs-setup (issue #53, spec §docs-setup).
// Projects the real `docs-setup` skill. Same shape as docs-setup-upgrade (a
// prior-configured repo whose `scripts/validate-docs.mjs` differs, so the
// recomputed state is UPGRADE) but the working tree is DIRTY: `WIP.txt` is seeded
// AFTER the baseline commit (inputs `uncommitted: true`), so the fixture starts
// with genuine, detectable drift.
//
// Upgrade is CLEAN-WORKTREE by default. On a dirty tree docs-setup must surface
// the dirty state and REQUIRE explicit approval before proceeding. This case
// proves the GATE: turn 1 (prompt.md) classifies UPGRADE, shows the dirty
// worktree, and stops for explicit approval; the follow-up (deny.md) refuses. The
// oracle then proves NOTHING managed was written — the differing validator still
// carries its old sentinel and the canonical validator was NOT installed — while
// the pre-existing dirty file is byte-preserved and Git is otherwise untouched.
// (git-unchanged is unusable here — the fixture is intentionally dirty from the
// start — so git-uncommitted is the correct no-side-effects proof.)
//
// Assets are read and per-install-substituted here so the fixture is a genuinely
// current install. Self-contained per case (the isolation pattern kept in #52).
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
const indexMd = installed('docs/index.md')
  .split('\n')
  .filter((l) => !l.includes('<subsystem>'))
  .join('\n');

const AGENTS = `# fixtureproj

## House rules

- Build with \`make build\` before pushing. (SENTINEL house-rule-keep-me)

${installed('agents/documentation-block.md')}`;

const OLD_VALIDATOR = `#!/usr/bin/env node
// OKF-OLD-VALIDATOR-SENTINEL — an older/customized docs validator predating the
// canonical v2 machinery. It differs from the shipped asset, so a recomputed
// state is UPGRADE and this file is customized-until-reviewed.
console.log('old docs validator (stub)');
process.exit(0);
`;

export default {
  skill: 'docs-setup',
  followUps: ['deny.md'],
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
    { path: 'scripts/validate-docs.test.mjs', content: asset('scripts/validate-docs.test.mjs') },
    { path: 'docs/index.md', content: indexMd },
    { path: 'docs/log.md', content: installed('docs/log.md') },
    { path: 'docs/conventions/index.md', content: asset('docs/conventions/index.md') },
    { path: 'docs/conventions/documentation.md', content: installed('docs/conventions/documentation.md') },
    { path: 'docs/glossary/index.md', content: asset('docs/glossary/index.md') },
    { path: 'docs/references/index.md', content: asset('docs/references/index.md') },
    { path: 'docs/references/okf.md', content: installed('docs/references/okf.md') },
    { path: 'scripts/validate-docs.mjs', content: OLD_VALIDATOR },
    // The DIRTINESS: an unrelated work-in-progress edit left UNCOMMITTED, so the
    // worktree is genuinely dirty when docs-setup audits it (seeded after the
    // baseline commit — see buildFixture's `uncommitted` handling).
    { path: 'WIP.txt', content: 'unrelated work in progress (SENTINEL wip-keep-me)\n', uncommitted: true },
  ],
  assertions: [
    // Live AC evidence: turn 1 classified UPGRADE and surfaced the DIRTY worktree
    // before any mutation — the gate requires explicit approval when dirty.
    { type: 'output-contains', value: 'upgrade' },
    { type: 'output-contains', value: 'dirty' },
    // The gate HELD on denial: the differing validator still carries its old
    // content — it was NOT reviewed/replaced without explicit approval...
    { type: 'file-contains', path: 'scripts/validate-docs.mjs', value: 'OKF-OLD-VALIDATOR-SENTINEL' },
    // ...and the canonical validator was NOT installed over it.
    { type: 'file-not-contains', path: 'scripts/validate-docs.mjs', value: 'Strict OKF v0.1 conformance validator' },
    // The pre-existing dirty working-tree file is byte-preserved (not discarded).
    { type: 'file-contains', path: 'WIP.txt', value: 'wip-keep-me' },
    // AC: no Git side effects — HEAD at baseline, nothing staged, no remote. The
    // intentional dirty file is untracked, so this holds while git-unchanged
    // (which demands a fully clean tree) cannot be used on a dirty fixture.
    { type: 'git-uncommitted' },
    { type: 'portable-contract' },
  ],
};
