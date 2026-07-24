// Approve/write case for docs-setup (issue #52, spec §docs-setup). Sibling of
// the deny-gate case: this directory is `docs-setup-approve` but the manifest
// projects the real `docs-setup` skill (via `skill` below), so one skill carries
// both a deny-gate case and this positive fresh-install case. The deny case
// proves the GATE and the full Git guarantee on the no-op path; this case proves
// the PRIMARY fresh install — AC5 (the target receives the verbatim validator +
// tests, the two package scripts, seed policy/reference, a marked AGENTS.md
// router, and the exact CLAUDE.md shim) and AC8 (validation success). Turn 1
// (prompt.md) audits, classifies fresh, presents the plan, and pauses; the
// follow-up (approve.md) approves, so the write happens only after approval.
//
// The write legitimately dirties the working tree, so git-unchanged is NOT
// asserted here (the deny case owns that guarantee). The fixture is a fresh repo
// with NO CLAUDE.md, so the writer must CREATE the `@AGENTS.md` shim; the
// pre-existing AGENTS.md and README carry sentinels proving unrelated content is
// preserved when the marked router is spliced in.

const AGENTS = `# fixtureproj

## House rules

- Build with \`make build\` before pushing. (SENTINEL house-rule-keep-me)
`;

export default {
  skill: 'docs-setup',
  followUps: ['approve.md'],
  inputs: [
    // No CLAUDE.md — the fresh install must create the exact shim itself.
    { path: 'AGENTS.md', content: AGENTS },
    { path: 'README.md', content: '# fixtureproj\n\nA fixture project. (SENTINEL readme-keep-me)\n' },
    {
      path: 'package.json',
      content: `${JSON.stringify({ name: 'fixtureproj', private: true, scripts: {} }, null, 2)}\n`,
    },
    { path: 'package-lock.json', content: '{\n  "lockfileVersion": 3\n}\n' },
  ],
  assertions: [
    // AC5: the verbatim validator + its test were installed...
    { type: 'file-exists', path: 'scripts/validate-docs.mjs' },
    { type: 'file-exists', path: 'scripts/validate-docs.test.mjs' },
    // ...byte-identical to the skill's OWN shipped asset (the fidelity headline;
    // the same bytes are mirror-enforced against the authoritative scripts/).
    {
      type: 'file-equals',
      path: 'scripts/validate-docs.mjs',
      against: 'skills/docs-setup/assets/scripts/validate-docs.mjs',
    },
    {
      type: 'file-equals',
      path: 'scripts/validate-docs.test.mjs',
      against: 'skills/docs-setup/assets/scripts/validate-docs.test.mjs',
    },
    // Seed policy, OKF reference, and the reserved bundle skeleton.
    { type: 'file-exists', path: 'docs/index.md' },
    { type: 'file-exists', path: 'docs/log.md' },
    { type: 'file-exists', path: 'docs/conventions/documentation.md' },
    { type: 'file-exists', path: 'docs/references/okf.md' },
    // The two package scripts were wired in.
    { type: 'file-contains', path: 'package.json', value: 'docs:validate' },
    { type: 'file-contains', path: 'package.json', value: 'docs:validate:test' },
    // The exact Claude import shim was written after existing memory was classified.
    { type: 'file-contains', path: 'CLAUDE.md', value: '@AGENTS.md' },
    // The marked Documentation router was installed into AGENTS.md...
    { type: 'file-contains', path: 'AGENTS.md', value: 'BEGIN OKF docs router' },
    { type: 'file-contains', path: 'AGENTS.md', value: 'docs/conventions/documentation.md' },
    // ...and the pre-existing unrelated guidance was PRESERVED (splice, not clobber).
    { type: 'file-contains', path: 'AGENTS.md', value: 'house-rule-keep-me' },
    // The stray README is untouched.
    { type: 'file-contains', path: 'README.md', value: 'readme-keep-me' },
    // The project name was substituted; no placeholder survives.
    { type: 'file-not-contains', path: 'docs/index.md', value: '<PROJECT>' },
    // Live AC3 evidence: turn 1 named the skeleton path before the write.
    { type: 'output-contains', value: 'docs/index.md' },
    // Static shared-reader contract over the projected pack, now including the
    // shim the writer created (AC1 parity).
    { type: 'portable-contract' },
  ],
};
