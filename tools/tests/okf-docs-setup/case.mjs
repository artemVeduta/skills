// Central test case for okf-docs-setup (skill-testing-architecture Decision 3).
// A case = scenario prompt (prompt.md) + fixture inputs + expected-state
// assertions. Deterministic assertions are the ONLY pass/fail oracle.
export default {
  skill: 'okf-docs-setup',
  inputs: [
    {
      path: 'package.json',
      content: `${JSON.stringify({ name: 'fixtureproj', private: true, scripts: {} }, null, 2)}\n`,
    },
  ],
  assertions: [
    { type: 'file-exists', path: 'docs/index.md' },
    { type: 'file-exists', path: 'docs/log.md' },
    { type: 'file-exists', path: 'docs/conventions/documentation.md' },
    { type: 'file-exists', path: 'docs/references/okf.md' },
    { type: 'file-exists', path: 'scripts/validate-docs.mjs' },
    { type: 'file-exists', path: 'scripts/validate-docs.test.mjs' },
    { type: 'file-exists', path: '.claude/rules/docs-authoring.md' },
    { type: 'file-exists', path: '.claude/rules/docs-maintenance.md' },
    { type: 'file-exists', path: '.claude/skills/docs-add/SKILL.md' },
    { type: 'file-exists', path: '.claude/skills/docs-validate/SKILL.md' },
    {
      type: 'file-equals',
      path: 'scripts/validate-docs.mjs',
      against: 'skills/okf-docs-setup/assets/scripts/validate-docs.mjs',
    },
    {
      type: 'file-equals',
      path: 'scripts/validate-docs.test.mjs',
      against: 'skills/okf-docs-setup/assets/scripts/validate-docs.test.mjs',
    },
    { type: 'file-not-contains', path: 'docs/index.md', value: '<PROJECT>' },
    { type: 'file-not-contains', path: '.claude/rules/docs-maintenance.md', value: '<source-edit-path-glob>' },
    { type: 'file-contains', path: 'package.json', value: 'docs:validate' },
    { type: 'file-contains', path: 'package.json', value: 'docs:validate:test' },
  ],
};
