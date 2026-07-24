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
// Present files are per-install-substituted via the shared pure asset helper so
// the fixture is a GENUINELY current install, not an approximation; the case
// still owns its own inputs and assertions (only the stateless asset-substitution
// boilerplate is shared).
import { asset, installed, indexMd, AGENTS, OLD_VALIDATOR } from '../_setup-assets.mjs';

// An EVOLVED docs/index.md: this bundle has accumulated real project content
// since install (a genuine subsystem entry the placeholder-only seed never had),
// so it DIFFERS from the asset. Evolving indexes/logs/concepts are NOT
// upgrade-managed once the skeleton exists — docs-setup must PRESERVE this
// byte-for-byte and NEVER propose reinstalling the seed over it (that would wipe
// accumulated project content). This is the exact contrast the upgrade slice
// hinges on: a DIFFERING machinery file (the validator below) is reinstalled
// after review, but a DIFFERING evolving index is preserved, never reinstalled.
const EVOLVED_INDEX = indexMd.replace(
  '## Subsystems\n',
  '## Subsystems\n\n- [auth](/auth/index.md) - Authentication subsystem (SENTINEL evolved-index-keep-me)\n',
);

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
    // An EVOLVED index that DIFFERS from the seed — must be byte-preserved, never
    // reinstalled from the asset (evolving indexes are not upgrade-managed).
    { path: 'docs/index.md', content: EVOLVED_INDEX },
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
    // The EVOLVED index DIFFERS from the seed asset but is an evolving index, so
    // it is byte-PRESERVED — never reinstalled from the seed. The distinction the
    // upgrade slice hinges on: differing machinery is reinstalled after review,
    // a differing evolving index is preserved. (Guards AC8 against the manifest
    // reinstall-if-differing rule being applied to skeleton rows.)
    { type: 'file-contains', path: 'docs/index.md', value: 'evolved-index-keep-me' },
    { type: 'file-contains', path: 'docs/index.md', value: '[auth](/auth/index.md)' },
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
