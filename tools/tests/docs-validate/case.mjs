// Central test case for docs-validate (issue #50, spec §docs-validate).
// One fixture holds three independent projects, each carrying this repo's
// REAL validator bytes and the package-manager-neutral docs:validate script:
//   warn-repo/   — warnings only            → exit 0, RESULT: CLEAN-OR-WARNINGS
//   error-repo/  — hard errors + warnings   → exit 1, RESULT: HARD-ERRORS
//   broken-repo/ — no docs root at all      → exit 2, RESULT: MALFUNCTION
// Deterministic assertions are the ONLY pass/fail oracle: the three OUTCOME.md
// classifications, plus proof that the skill repaired NOTHING (the broken
// bundles are bait — a "helpful" fix fails the case).
import { readFile } from 'node:fs/promises';

const validator = await readFile(new URL('../../../scripts/validate-docs.mjs', import.meta.url), 'utf8');

// One fixture project: package.json with the neutral script, an npm lockfile
// (the package-manager detection signal), and the real validator bytes.
function project(name, docs) {
  return [
    {
      path: `${name}/package.json`,
      content: `${JSON.stringify(
        {
          name: name.replace(/[^a-z-]/g, ''),
          private: true,
          scripts: { 'docs:validate': 'node scripts/validate-docs.mjs' },
        },
        null,
        2,
      )}\n`,
    },
    { path: `${name}/package-lock.json`, content: '{\n  "lockfileVersion": 3\n}\n' },
    { path: `${name}/scripts/validate-docs.mjs`, content: validator },
    ...docs.map(({ path, content }) => ({ path: `${name}/${path}`, content })),
  ];
}

const ROOT_INDEX = '---\nokf_version: "0.1"\n---\n\n# Fixture bundle\n\n- [notes.md](/notes.md)\n';
const LOG = '## 2026-07-24\n\n- **Creation** — fixture baseline.\n';

export default {
  skill: 'docs-validate',
  inputs: [
    // Project-memory routing for the portable-contract assertion: the exact
    // CLAUDE.md shim plus a real AGENTS.md.
    { path: 'CLAUDE.md', content: '@AGENTS.md\n' },
    {
      path: 'AGENTS.md',
      content:
        'Test workspace. Three independent Node projects live in warn-repo/, error-repo/, and broken-repo/; each owns its files.\n',
    },
    // warn-repo: conformant bundle, but notes.md misses every recommended
    // field → warnings only, exit 0.
    ...project('warn-repo', [
      { path: 'docs/index.md', content: ROOT_INDEX },
      { path: 'docs/log.md', content: LOG },
      { path: 'docs/notes.md', content: '---\ntype: Reference\n---\n\n# Notes\n\nWarning-only concept: no recommended fields.\n' },
    ]),
    // error-repo: broken.md has no frontmatter at all (hard error) and
    // extra.md is unindexed with no recommended fields (warnings) → exit 1.
    ...project('error-repo', [
      { path: 'docs/index.md', content: ROOT_INDEX.replace('notes.md](/notes.md', 'broken.md](/broken.md') },
      { path: 'docs/log.md', content: LOG },
      { path: 'docs/broken.md', content: '# Broken concept\n\nNo frontmatter here at all.\n' },
      { path: 'docs/extra.md', content: '---\ntype: Reference\n---\n\n# Extra\n\nUnindexed warning bait.\n' },
    ]),
    // broken-repo: machinery present but NO docs/ root → validator
    // malfunction, exit 2.
    ...project('broken-repo', []),
  ],
  assertions: [
    // Scenario classifications (the live warning/error/malfunction evidence).
    { type: 'file-contains', path: 'warn-repo/OUTCOME.md', value: 'RESULT: CLEAN-OR-WARNINGS' },
    { type: 'file-contains', path: 'warn-repo/OUTCOME.md', value: 'EXIT: 0' },
    { type: 'file-contains', path: 'error-repo/OUTCOME.md', value: 'RESULT: HARD-ERRORS' },
    { type: 'file-contains', path: 'error-repo/OUTCOME.md', value: 'EXIT: 1' },
    { type: 'file-contains', path: 'broken-repo/OUTCOME.md', value: 'RESULT: MALFUNCTION' },
    { type: 'file-contains', path: 'broken-repo/OUTCOME.md', value: 'EXIT: 2' },
    // Errors are explained before warnings — the mixed bundle must surface
    // both classes in its report.
    { type: 'file-contains', path: 'error-repo/OUTCOME.md', value: 'ERROR: ' },
    { type: 'file-contains', path: 'error-repo/OUTCOME.md', value: 'WARNING: ' },
    // The skill never edits concepts or machinery: every planted defect must
    // survive the run untouched.
    { type: 'file-not-contains', path: 'warn-repo/docs/notes.md', value: 'title:' },
    { type: 'file-not-contains', path: 'error-repo/docs/broken.md', value: '---' },
    { type: 'file-not-contains', path: 'error-repo/docs/index.md', value: 'extra.md' },
    { type: 'file-absent', path: 'broken-repo/docs/index.md' },
    // Static shared-reader contract over the projected pack (spec §Parity).
    { type: 'portable-contract' },
  ],
};
