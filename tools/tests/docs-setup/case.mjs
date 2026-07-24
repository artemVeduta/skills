// Central test case for docs-setup (issue #52, spec §docs-setup). The scenario
// is the approval GATE, only observable on a NO-WRITE path: on an approve path
// the end state cannot distinguish "audited, planned, and waited" from "wrote
// eagerly", so a DENY turn is the sole way to prove docs-setup audits read-only,
// presents one plan, and writes NOTHING before approval — and leaves staging,
// commits, remotes, and pull requests unchanged. Turn 1 (prompt.md) runs the
// parallel read-only audits, classifies the FRESH state, presents the complete
// create/preserve plan, and pauses; the follow-up (deny.md) refuses it. The
// deterministic oracle then proves no managed machinery was written, staged, or
// committed (git-unchanged + file-absent), while turn 1's output carries the
// classification and plan elements as live AC2/AC3 evidence.
//
// The fixture is a FRESH repo (no docs/ bundle, no validator, no docs:validate
// script) that already carries the CLAUDE.md `@AGENTS.md` shim and an AGENTS.md
// with unrelated guidance — a repo can have project memory without OKF docs, and
// seeding the shim keeps the static portable contract green on the no-write path
// where the writer never runs.

const AGENTS = `# fixtureproj

## House rules

- Build with \`make build\` before pushing. (SENTINEL house-rule-keep-me)
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
      content: `${JSON.stringify({ name: 'fixtureproj', private: true, scripts: {} }, null, 2)}\n`,
    },
    { path: 'package-lock.json', content: '{\n  "lockfileVersion": 3\n}\n' },
  ],
  assertions: [
    // Headline: on denial the fixture stays EXACTLY at its baseline commit —
    // nothing written, staged, committed, pushed, or PR'd (AC4 gate + AC8).
    { type: 'git-unchanged' },
    // No managed machinery was created without approval.
    { type: 'file-absent', path: 'scripts/validate-docs.mjs' },
    { type: 'file-absent', path: 'scripts/validate-docs.test.mjs' },
    { type: 'file-absent', path: 'docs/index.md' },
    // The package scripts and the marked router were not added.
    { type: 'file-not-contains', path: 'package.json', value: 'docs:validate' },
    { type: 'file-not-contains', path: 'AGENTS.md', value: 'BEGIN OKF docs router' },
    // Live AC2/AC3 evidence: turn 1 classified the FRESH state and named the
    // machinery it WOULD create, before any write. The prompt states the repo
    // has no bundle; the "fresh" classification and the specific managed paths
    // come from the skill running its audits, not from dictated tokens.
    { type: 'output-contains', value: 'fresh' },
    { type: 'output-contains', value: 'validate-docs' },
    { type: 'output-contains', value: 'docs/index.md' },
    // Static shared-reader contract over the projected pack (AC1 parity).
    { type: 'portable-contract' },
  ],
};
