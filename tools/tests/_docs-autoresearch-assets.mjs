// Pure, stateless fixture scaffold shared by the docs-autoresearch cases (#58
// deny-gate + approve-write). Mirrors _docs-sync-assets.mjs: it carries NO
// assertions and NO case-specific content — only the byte-identical OKF-bundle
// scaffold both cases seed verbatim (the project-memory shim, the routing
// AGENTS.md, the runnable validator machinery, and a conformant bundle skeleton
// whose References area the run either enriches or, on denial, leaves untouched).
// Each case still owns its follow-up and its assertions. Extracting the verbatim
// copy-paste (Fowler: Duplicated Code) keeps a change to the shared bundle shape
// a single-site edit and stops the two fixtures from drifting apart.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(REPO, rel), 'utf8');

// Real bytes from THIS repo, so the fixture's lifecycle policy and validator are
// the canonical ones docs-autoresearch reads (and, on an approved write, runs).
export const policy = read('docs/conventions/documentation.md');
export const validator = read('scripts/validate-docs.mjs');

// The bundle-relative path of the curated Reference the default run files. Its
// slug names the durable subject; the topic is supplied by the prompt.
export const REF_PATH = 'docs/references/semver-precedence.md';

const CLAUDE_MD = { path: 'CLAUDE.md', content: '@AGENTS.md\n' };
const AGENTS_MD = {
  path: 'AGENTS.md',
  content:
    'Workspace with an OKF v0.1 docs/ bundle. Lifecycle policy: docs/conventions/documentation.md. Use docs-autoresearch to research an explicit topic and file one curated Reference.\n',
};

// Runnable validator machinery (so an approved write can run docs:validate).
const PACKAGE_JSON = {
  path: 'package.json',
  content: `${JSON.stringify(
    { name: 'fixtureproj', private: true, scripts: { 'docs:validate': 'node scripts/validate-docs.mjs' } },
    null,
    2,
  )}\n`,
};
const PACKAGE_LOCK = { path: 'package-lock.json', content: '{\n  "lockfileVersion": 3\n}\n' };
const VALIDATOR = { path: 'scripts/validate-docs.mjs', content: validator };

const LOG = '## 2026-07-20\n\n- **Creation** — references area baseline.\n';

// A conformant bundle skeleton: root index (with a References area), the
// conventions index + the real lifecycle policy, a References subsystem index
// and its own log (so an approved filing lands its bookkeeping in the NEAREST
// references log/index, never the root). The References area is empty of concepts
// at baseline, so the run genuinely CREATES the one curated Reference.
const ROOT_INDEX = {
  path: 'docs/index.md',
  content:
    '---\nokf_version: "0.1"\n---\n\n# Fixture bundle\n\n## Repo-wide\n\n- [Conventions](/conventions/index.md) - repo-wide rules\n- [References](/references/index.md) - external material mirrored as concepts\n',
};
const ROOT_LOG = { path: 'docs/log.md', content: LOG };
const CONVENTIONS_INDEX = {
  path: 'docs/conventions/index.md',
  content: '# Conventions\n\n- [Documentation lifecycle policy](/conventions/documentation.md) - the docs flow\n',
};
const CONVENTIONS_POLICY = { path: 'docs/conventions/documentation.md', content: policy };
const REFERENCES_INDEX = {
  path: 'docs/references/index.md',
  content: '# References\n\nExternal material mirrored as first-class concepts.\n',
};
const REFERENCES_LOG = { path: 'docs/references/log.md', content: LOG };

// The verbatim scaffold both cases seed before their own follow-up + assertions.
export const scaffold = [
  CLAUDE_MD,
  AGENTS_MD,
  PACKAGE_JSON,
  PACKAGE_LOCK,
  VALIDATOR,
  ROOT_INDEX,
  ROOT_LOG,
  CONVENTIONS_INDEX,
  CONVENTIONS_POLICY,
  REFERENCES_INDEX,
  REFERENCES_LOG,
];
