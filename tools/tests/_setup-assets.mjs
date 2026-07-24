// Pure, stateless asset-reading helpers shared by the docs-setup live cases
// (#53 upgrade / reinstall / partial-repair / no-op). This is NOT a shared
// fixture module in the #52 isolation sense — it carries no case inputs and no
// assertions; every case still owns those. It only removes the duplicated,
// stateless asset-substitution boilerplate (Fowler: Duplicated Code) that was
// copy-pasted verbatim across the four #53 cases, and gives the install-time
// date a single, runtime-accurate home.
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
// canonical v2 machinery. It differs from the shipped asset, so a recomputed
// state is UPGRADE and this file is customized-until-reviewed.
console.log('old docs validator (stub)');
process.exit(0);
`;
