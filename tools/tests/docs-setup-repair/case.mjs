// Partial-REPAIR case for docs-setup (issue #53, spec §docs-setup). Projects the
// real `docs-setup` skill. The fixture is a repository whose managed machinery is
// only PARTIALLY present: the canonical `scripts/validate-docs.mjs`, the current
// `docs/` bundle, the marked AGENTS.md router, and the CLAUDE.md shim are all
// present and current, but the `scripts/validate-docs.test.mjs` file is MISSING
// and the two `docs:validate` package scripts are absent from package.json. So
// the recomputed state is partial repair — not fresh (machinery exists) and not a
// clean upgrade (nothing differs; some files are simply missing).
//
// It also seeds a pre-existing, hand-authored `docs/specifications/legacy.md`
// under the drift-named `specifications/` directory. docs-setup must leave that
// content untouched and must NOT rename `specifications/` to `specs/` (that
// migration belongs to docs-sync), so the file survives byte-for-byte at its
// original path.
//
// Turn 1 (prompt.md) audits read-only, recomputes state, classifies partial
// repair, and proposes CREATING the missing files while leaving current files as
// no-ops and the specifications/ tree untouched, then STOPS. The follow-up
// (approve.md) authorizes it. The oracle proves the missing files were created
// byte-identical to the canonical machinery, the already-current validator stayed
// a no-op, specifications/ content is preserved and un-renamed, and Git was left
// otherwise untouched.
//
// Present files are per-install-substituted via the shared pure asset helper so
// they are a genuinely current install; the case still owns its own inputs and
// assertions (only the stateless asset-substitution boilerplate is shared).
import { asset, installed, indexMd, AGENTS } from '../_setup-assets.mjs';

const LEGACY_SPEC = `---
type: Specification
title: Legacy spec
description: A pre-existing hand-authored spec under the drift-named specifications/ directory.
timestamp: 2026-07-20
---

# Legacy spec

Pre-existing content that predates the canonical bundle shape. (SENTINEL spec-keep-me)
`;

export default {
  skill: 'docs-setup',
  followUps: ['approve.md'],
  inputs: [
    { path: 'CLAUDE.md', content: '@AGENTS.md\n' },
    { path: 'AGENTS.md', content: AGENTS },
    { path: 'README.md', content: '# fixtureproj\n\nA fixture project. (SENTINEL readme-keep-me)\n' },
    // package.json is MISSING the two docs:validate scripts — a repair target.
    {
      path: 'package.json',
      content: `${JSON.stringify({ name: 'fixtureproj', private: true, scripts: {} }, null, 2)}\n`,
    },
    { path: 'package-lock.json', content: '{\n  "lockfileVersion": 3\n}\n' },
    // Present-and-current validator (a NO-OP)...
    { path: 'scripts/validate-docs.mjs', content: asset('scripts/validate-docs.mjs') },
    // ...but scripts/validate-docs.test.mjs is ABSENT — a repair target (created).
    { path: 'docs/index.md', content: indexMd },
    { path: 'docs/log.md', content: installed('docs/log.md') },
    { path: 'docs/conventions/index.md', content: asset('docs/conventions/index.md') },
    { path: 'docs/conventions/documentation.md', content: installed('docs/conventions/documentation.md') },
    { path: 'docs/glossary/index.md', content: asset('docs/glossary/index.md') },
    { path: 'docs/references/index.md', content: asset('docs/references/index.md') },
    { path: 'docs/references/okf.md', content: installed('docs/references/okf.md') },
    // Pre-existing hand-authored content under the drift-named specifications/
    // tree — must remain untouched and un-renamed.
    { path: 'docs/specifications/legacy.md', content: LEGACY_SPEC },
  ],
  assertions: [
    // Live AC evidence: turn 1 recomputed state and classified partial REPAIR
    // (machinery present, some managed files missing) before any mutation.
    { type: 'output-contains', value: 'repair' },
    // The MISSING test file was created, byte-identical to the canonical asset.
    { type: 'file-exists', path: 'scripts/validate-docs.test.mjs' },
    {
      type: 'file-equals',
      path: 'scripts/validate-docs.test.mjs',
      against: 'skills/docs-setup/assets/scripts/validate-docs.test.mjs',
    },
    // The MISSING package scripts were added.
    { type: 'file-contains', path: 'package.json', value: 'docs:validate' },
    { type: 'file-contains', path: 'package.json', value: 'docs:validate:test' },
    // The already-current validator stayed byte-identical (a NO-OP — not rewritten).
    {
      type: 'file-equals',
      path: 'scripts/validate-docs.mjs',
      against: 'skills/docs-setup/assets/scripts/validate-docs.mjs',
    },
    // Existing specifications/ content is untouched AND not renamed to specs/
    // (that migration is docs-sync's job, never setup's).
    { type: 'file-contains', path: 'docs/specifications/legacy.md', value: 'spec-keep-me' },
    { type: 'file-exists', path: 'docs/specifications/legacy.md' },
    // Unrelated project guidance byte-preserved.
    { type: 'file-contains', path: 'AGENTS.md', value: 'house-rule-keep-me' },
    // AC on the write path: no staging/commit/remote (tree legitimately dirtied).
    { type: 'git-uncommitted' },
    { type: 'portable-contract' },
  ],
};
