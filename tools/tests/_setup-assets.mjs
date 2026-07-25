// Pure, stateless asset-reading helpers shared by the docs-setup live cases
// (#53 upgrade / reinstall / partial-repair / no-op, #65 enforcement / retired
// surfaces / failing legacy bundle). This is NOT a shared fixture module in the
// #52 isolation sense — it declares no ASSERTIONS; every case still owns those,
// which is what keeps a failure attributable to one case. It only removes the
// duplicated, stateless boilerplate (Fowler: Duplicated Code) that would
// otherwise be copy-pasted verbatim across a dozen cases: asset substitution, the
// already-current install every "only enforcement is missing" fixture starts
// from, and the enforcement/tombstone literals below. It also gives the
// install-time date a single, runtime-accurate home.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '../../skills/docs-setup/assets');

// The install-time date docs-setup would stamp NOW, computed at fixture-build
// time (never hardcoded), so a genuinely-current fixture reproduces on ANY
// calendar day — matching what the skill substitutes at runtime. Note: currency
// itself does NOT depend on this value. Per SKILL.md, a managed file is
// byte-current when it equals the asset under SOME valid per-install
// substitution (the date/project/pm slots are wildcards), so a bundle carrying
// an earlier install date is still a no-op. Stamping today's date here simply
// makes the fixture the least surprising "current install".
export const INSTALL_DATE = new Date().toISOString().slice(0, 10);

// Raw asset bytes (verbatim files: the validator, its test, the sub-index stubs).
export const asset = (rel) => readFileSync(join(ASSETS, rel), 'utf8');

// The asset with the documented per-install substitutions applied
// (date/project/pm) — exactly what a genuine `npm run`-target install carries.
export const installed = (rel) =>
  asset(rel)
    .replaceAll('<YYYY-MM-DD>', INSTALL_DATE)
    .replaceAll('<PROJECT>', 'FixtureProj')
    .replaceAll('pnpm docs:validate', 'npm run docs:validate')
    .replaceAll('<pm>', 'npm run');

// docs/index.md drops the placeholder subsystem bullet when there are no subsystems.
export const indexMd = installed('docs/index.md')
  .split('\n')
  .filter((l) => !l.includes('<subsystem>'))
  .join('\n');

// A project AGENTS.md carrying unrelated house rules PLUS the marked router, so
// the splice must byte-preserve the surrounding guidance (SENTINEL house-rule-keep-me).
export const AGENTS = `# fixtureproj

## House rules

- Build with \`make build\` before pushing. (SENTINEL house-rule-keep-me)

${installed('agents/documentation-block.md')}`;

// The one DIFFERING managed file the upgrade cases seed: an older/customized
// validator stub docs-setup must treat as customized-until-reviewed and never
// blindly overwrite.
export const OLD_VALIDATOR = `#!/usr/bin/env node
// OKF-OLD-VALIDATOR-SENTINEL — an older/customized docs validator predating the
// canonical machinery. It differs from the shipped asset, so a recomputed state
// is UPGRADE and this file is customized-until-reviewed.
console.log('old docs validator (stub)');
process.exit(0);
`;

// The two package scripts a configured target carries.
export const PACKAGE_SCRIPTS = {
  'docs:validate': 'node scripts/validate-docs.mjs',
  'docs:validate:test': 'node --test scripts/validate-docs.test.mjs',
};

// A `package.json` with extra scripts merged over the two managed ones, plus any
// devDependencies (a `husky` entry with no initialized configuration is the
// "insufficient evidence" fixture).
export const packageJson = ({ scripts = {}, devDependencies = null } = {}) =>
  `${JSON.stringify(
    {
      name: 'fixtureproj',
      private: true,
      scripts: { ...PACKAGE_SCRIPTS, ...scripts },
      ...(devDependencies ? { devDependencies } : {}),
    },
    null,
    2,
  )}\n`;

// The inputs of a repository ALREADY at the current managed state: canonical
// validator + test byte-identical to the shipped assets, both package scripts, a
// complete current bundle, the marked AGENTS.md router, and the exact CLAUDE.md
// shim. Every #65 enforcement case starts from this so the ONLY work its plan can
// contain is the enforcement (or tombstone) row under test — which is what makes
// an exact-change-set assertion (`git-only-paths`) a usable, legible oracle there.
export const currentInstall = (pkg = {}) => [
  { path: 'CLAUDE.md', content: '@AGENTS.md\n' },
  { path: 'AGENTS.md', content: AGENTS },
  { path: 'README.md', content: '# fixtureproj\n\nA fixture project. (SENTINEL readme-keep-me)\n' },
  { path: 'package.json', content: packageJson(pkg) },
  { path: 'package-lock.json', content: '{\n  "lockfileVersion": 3\n}\n' },
  { path: 'scripts/validate-docs.mjs', content: asset('scripts/validate-docs.mjs') },
  { path: 'scripts/validate-docs.test.mjs', content: asset('scripts/validate-docs.test.mjs') },
  { path: 'docs/index.md', content: indexMd },
  { path: 'docs/log.md', content: installed('docs/log.md') },
  { path: 'docs/conventions/index.md', content: asset('docs/conventions/index.md') },
  { path: 'docs/conventions/documentation.md', content: installed('docs/conventions/documentation.md') },
  { path: 'docs/glossary/index.md', content: asset('docs/glossary/index.md') },
  { path: 'docs/references/index.md', content: asset('docs/references/index.md') },
  { path: 'docs/references/okf.md', content: installed('docs/references/okf.md') },
];

// --- enforcement fixture material (#65) -------------------------------------

// The destination of the managed GitHub workflow, and its exact bytes. A case
// asserts the installed file is byte-identical to `WORKFLOW_ASSET_PATH` rather
// than grepping for triggers, so the whole asset (both events, the strict step,
// the complete-bundle invocation) is pinned at once.
export const WORKFLOW_DEST = '.github/workflows/docs-validate.yml';
export const WORKFLOW_ASSET_PATH = 'skills/docs-setup/assets/github/workflows/docs-validate.yml';

// The effective Husky pre-push path an active, repository-owned configuration runs.
export const PREPUSH = '.husky/pre-push';

// The stable markers that make the managed validation block identifiable and
// idempotently replaceable (references/enforcement.md → "One identifiable managed
// block"). Kept as constants because both the fixtures and the assertions name
// them, and a marker rename must break in exactly one place.
export const BLOCK_BEGIN = '# BEGIN OKF docs validation (managed by docs-setup)';
export const BLOCK_END = '# END OKF docs validation (managed by docs-setup)';

// The managed block as an `npm run` target would carry it: the plain
// `docs:validate` script, no arguments and no scoping — the COMPLETE bundle on
// every push.
export const MANAGED_BLOCK = `${BLOCK_BEGIN}\nnpm run docs:validate\n${BLOCK_END}\n`;

// A repository-owned `.husky/` tree that is genuinely ACTIVE: the manager's
// internal helper directory plus real hook files. This is the evidence
// docs-setup requires — a devDependency line alone is explicitly NOT enough.
export const HUSKY_RUNTIME = `#!/usr/bin/env sh
# husky.sh — the hook manager's internal runtime helper (fixture stub). Its
# presence beside real hook files is what makes this Husky configuration ACTIVE
# and repository-owned, as opposed to a bare devDependency.
if [ -z "$husky_skip_init" ]; then
  husky_skip_init=1
  export husky_skip_init
  sh -e "$0" "$@"
  exit "$?"
fi
`;

// Unrelated pre-push commands a real repository already runs. Adding docs
// validation must not edit, remove, or reorder ANY of these lines — the
// byte-preservation half of the enforcement contract.
export const HOOK_UNRELATED = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm run lint          # SENTINEL hook-lint-keep-me
npm test              # SENTINEL hook-test-keep-me
./scripts/deploy-check.sh   # SENTINEL hook-deploy-keep-me
`;

// An unrelated repository CI workflow. docs-setup owns its own dedicated file and
// must never modify arbitrary CI logic, so cases assert this stays byte-identical
// to its baseline content.
export const UNRELATED_WORKFLOW = `name: ci

on:
  pull_request:

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test   # SENTINEL ci-unit-keep-me
`;

// --- retired-surface tombstone material (#65) --------------------------------

// The HISTORICAL FINGERPRINT of the retired Claude-only docs-authoring adapter:
// the exact bytes docs-setup shipped at `assets/claude/rules/docs-authoring.md`
// before this contract retired it (recovered from the suite's own history at
// commit 1867546, the last revision that shipped it). Byte-identity with this
// literal is what PROVES suite ownership, so the literal is deliberately frozen
// and must never be "refreshed" from a live asset — there is no live asset any
// more, which is the point of a tombstone.
export const RETIRED_DOCS_AUTHORING = `---
paths:
  - "docs/**/*.md"
---

# Authoring the docs bundle

- The \`docs/\` bundle is OKF v0.1. The canonical policy is
  \`docs/conventions/documentation.md\` — apply it, do not restate it here.
- The validator checks every \`.md\` file under \`docs/\` uniformly — there is no exclusion
  or suppression grammar; non-Markdown sidecars are ignored.
- Every non-reserved file needs frontmatter with a non-empty \`type\`; recommended:
  \`title\`, \`description\`, ISO \`timestamp\`. Links are bundle-relative absolute (\`/a/b.md\`).
- \`index.md\` carries no frontmatter (except root's \`okf_version\`); \`log.md\` uses
  \`## YYYY-MM-DD\` headings, newest first.
- **Update ceremony** (this is an edit, so it applies now): bump \`timestamp\`; append a
  \`log.md\` entry; amend \`Decision\`s (dated \`# Amendments\`, never rewrite); supersede via
  \`status\` + \`superseded_by\`, never silent delete.
- **Separate truth by type** — \`docs/\` holds explanatory truth (ADRs, glossary, business
  rules, runbooks, architecture/ownership/cross-system context); executable truth (code,
  tests, schemas, workflow YAML, generated API ref — everything outside \`docs/\`) is
  referenced, never pasted. It drifts and the validator can't catch it. Short
  pseudo-code/formulas/shapes are fine. See "Code in concepts" in the policy.
- Use the \`docs-add\` skill to scaffold a new concept; \`docs-validate\` is the backstop
  (strict: exit \`0\` clean/warnings-only, \`1\` hard errors, \`2\` malfunction).
`;

// A retired managed TOOLING surface proven by its MANAGED MARKER rather than by a
// fingerprint: an owner header naming this suite. The manifest no longer lists
// this path, so the marker alone establishes that the suite — not the user — put
// it there.
export const RETIRED_MANAGED_TOOLING = `#!/usr/bin/env node
// BEGIN OKF docs tooling (managed by docs-setup)
// A prior revision's managed docs helper. The current manifest no longer lists
// this path; the owner marker above proves the suite installed it.
// END OKF docs tooling (managed by docs-setup)
console.log('legacy managed okf docs helper');
`;

// A CUSTOMIZED retired surface: the retired docs-maintenance adapter after the
// user edited it. It matches no historical fingerprint and carries no owner
// marker, so setup must treat it as a CONFLICT needing an explicit keep/remove
// decision — never as disposable.
export const CUSTOMIZED_RETIRED_ADAPTER = `# Maintaining the docs bundle

- Run the validator before pushing.
- Our team also requires a ticket id in every log entry. (SENTINEL customized-adapter-keep-me)
- Ping #docs-guild when a Decision is superseded.
`;

// An UNCERTAIN retired surface: a project-local copy of a canonical helper skill
// whose provenance cannot be established — it differs from any shipped helper
// tree and carries no owner marker. Removal would also require confirmed
// canonical discovery, so this is a conflict too, not an automatic removal.
export const UNCERTAIN_LOCAL_HELPER = `---
name: docs-validate
description: Local copy of the docs validation helper, edited for this repo.
---

# docs-validate (project-local copy)

Run \`npm run docs:validate\` and read the exit code.
Our fork also uploads the report to the internal dashboard. (SENTINEL uncertain-helper-keep-me)
`;
