#!/usr/bin/env node
// One-time, developer-run provisioning of a harness test profile (spec goal 2):
// creates ~/.skills-test-profiles/<id>, applies the SAME env map the runner
// uses (profileEnvFor — so login state lands exactly where the runner later
// looks), attaches the harness's interactive login flow to this terminal, then
// reports authed/not-authed by checking authMaterialPath. The runner itself
// never handles credentials. IMPURE + interactive — never run by npm test/CI.
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { DRIVERS, resolveDriver } from './test-runner/drivers.mjs';
import { profileDirFor, profileEnvFor, authMaterialPath } from './test-runner/profiles.mjs';

// Login entry points, confirmed against the installed CLIs (see the V1–V3
// verification notes; adjust here if a CLI update renames them). claude
// exposes no top-level `login` — only `auth` (with a nested `login`) and
// `setup-token` (live-run finding #1).
const LOGIN_ARGS = {
  'claude-code': ['auth', 'login'],
  codex: ['login'],
  opencode: ['auth', 'login'],
};

async function main() {
  const id = process.argv[2];
  const driver = id ? resolveDriver(id) : null;
  if (!driver) {
    console.error(`usage: npm run test:auth -- <${DRIVERS.map((d) => d.id).join('|')}>`);
    process.exit(2);
  }

  const profileDir = profileDirFor(id);
  const env = profileEnvFor(id, profileDir);
  await mkdir(profileDir, { recursive: true });
  for (const value of Object.values(env)) {
    // Pre-create the profile-rooted dirs the env points at (e.g. opencode's
    // XDG subdirs); non-path values like OPENCODE_DISABLE_AUTOUPDATE=1 skip.
    if (value.startsWith(profileDir)) await mkdir(value, { recursive: true });
  }

  const authPath = authMaterialPath(id, profileDir);
  if (existsSync(authPath)) {
    console.log(`${id}: already authenticated — auth material at ${authPath}`);
    process.exit(0);
  }

  const r = spawnSync(driver.command, LOGIN_ARGS[id], {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (r.error) {
    console.error(`${id}: could not spawn \`${driver.command}\` — ${r.error.message}`);
    process.exit(1);
  }

  if (existsSync(authPath)) {
    console.log(`${id}: authenticated — auth material at ${authPath}`);
    process.exit(0);
  }
  console.error(`${id}: NOT authenticated — expected auth material at ${authPath}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
