// Pure, stateless fixture scaffold shared by the docs-sync cases (#54 gate +
// reconcile, and the future #55/#56/#57 siblings). Mirrors _setup-assets.mjs:
// it carries NO assertions and NO case-specific content — only the
// byte-identical OKF-bundle scaffold both docs-sync cases seed verbatim (the
// project-memory shim, the routing AGENTS.md, the runnable validator
// machinery, and the conformant bundle skeleton). Each case still owns its
// distinguishing concept content (the retries spec), its source, its log
// dates, its follow-ups, and its assertions. Extracting the verbatim copy-paste
// (Fowler: Duplicated Code) keeps a change to the shared bundle shape a
// single-site edit and stops the two fixtures from silently drifting apart.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(REPO, rel), 'utf8');

// Real bytes from THIS repo, so the fixture's lifecycle policy and validator are
// the canonical ones docs-sync reads (and, on a real reconcile, runs).
export const policy = read('docs/conventions/documentation.md');
export const validator = read('scripts/validate-docs.mjs');

// The project-memory routing pair (the exact CLAUDE.md shim + a real AGENTS.md
// that names docs-sync) the portable contract reads.
const CLAUDE_MD = { path: 'CLAUDE.md', content: '@AGENTS.md\n' };
const AGENTS_MD = {
  path: 'AGENTS.md',
  content:
    'Workspace with an OKF v0.1 docs/ bundle. Lifecycle policy: docs/conventions/documentation.md. Use docs-sync to reconcile the bundle with branch work.\n',
};

// Runnable validator machinery (so a real reconcile can run docs:validate).
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

// The conformant bundle skeleton both cases share verbatim: the root index, the
// conventions index + the real lifecycle policy, and the payments subsystem
// index that links the retries spec. Each case seeds its own retries spec, its
// logs, and (for a reconcile) its source on top of this.
const ROOT_INDEX = {
  path: 'docs/index.md',
  content:
    '---\nokf_version: "0.1"\n---\n\n# Fixture bundle\n\n## Repo-wide\n\n- [Conventions](/conventions/index.md) - repo-wide rules\n\n## Subsystems\n\n- [payments](/payments/index.md) - payment processing\n',
};
const CONVENTIONS_INDEX = {
  path: 'docs/conventions/index.md',
  content: '# Conventions\n\n- [Documentation lifecycle policy](/conventions/documentation.md) - the docs flow\n',
};
const CONVENTIONS_POLICY = { path: 'docs/conventions/documentation.md', content: policy };
const PAYMENTS_INDEX = {
  path: 'docs/payments/index.md',
  content:
    '# payments\n\nPayment processing subsystem.\n\n## Specifications\n\n- [Payment retry policy](/payments/specs/retries.md) - retry mechanics\n',
};

// The shared scaffold as an ordered array. A case spreads this and then adds its
// own distinguishing inputs (spec, logs, source).
export const scaffold = [
  CLAUDE_MD,
  AGENTS_MD,
  PACKAGE_JSON,
  PACKAGE_LOCK,
  VALIDATOR,
  ROOT_INDEX,
  CONVENTIONS_INDEX,
  CONVENTIONS_POLICY,
  PAYMENTS_INDEX,
];

// The bundle-relative path of the payments retry Specification the payments
// index links — the concept each docs-sync case fills with its own content.
export const SPEC_PATH = 'docs/payments/specs/retries.md';
