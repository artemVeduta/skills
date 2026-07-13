import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lstatSync, readlinkSync, existsSync } from 'node:fs';

const INSTALLER = fileURLToPath(new URL('./install.sh', import.meta.url));

function run(args, { input, env } = {}) {
  return spawnSync(INSTALLER, args, {
    encoding: 'utf8',
    input,
    env: { ...process.env, ...env },
  });
}

// Build a temp checkout whose skills live at <root>/skills/<name>/...
async function makeCheckout(skills) {
  const root = await mkdtemp(join(tmpdir(), 'install-'));
  for (const [name, files] of Object.entries(skills)) {
    const dir = join(root, 'skills', name);
    await mkdir(dir, { recursive: true });
    for (const [rel, content] of Object.entries(files)) {
      const full = join(dir, rel);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, content);
    }
  }
  return root;
}

const SKILL = (name) => `---\nname: ${name}\ndescription: d\n---\n## Overview\nx\n`;

test('--help prints usage and exits 0', () => {
  const r = run(['--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Usage: install\.sh/);
});

test('unknown flag is a usage error (exit 2)', () => {
  const r = run(['--bogus']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown option/);
});

test('--inspect lists discovered skills and registry entries (exit 0), ignoring nested SKILL.md', async () => {
  const root = await makeCheckout({
    alpha: { 'SKILL.md': SKILL('alpha'), 'assets/SKILL.md': SKILL('nested') },
    beta: { 'SKILL.md': SKILL('beta') },
  });
  try {
    const r = run(['--inspect', '--checkout', root]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /alpha/);
    assert.match(r.stdout, /beta/);
    assert.doesNotMatch(r.stdout, /nested/); // nested SKILL.md is never a skill
    assert.match(r.stdout, /claude-code/); // a registry harness id
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('zero skills discovered is a hard failure (exit 1)', async () => {
  const root = await makeCheckout({});
  try {
    const r = run(['--inspect', '--checkout', root]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /no skills discovered/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// Link every discovered skill into a temp Claude Code "personal" profile.
async function fullInstall(args, env) {
  return run(['--yes', ...args], { env });
}

test('--dry-run shows a preview and changes nothing (exit 0)', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const r = run(['--dry-run', '--checkout', root, '--harness', 'agents'], { env: { HOME: home } });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Installation preview/);
    assert.match(r.stdout, /alpha/);
    assert.equal(existsSync(join(home, '.agents', 'skills', 'alpha')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('no selection non-interactively is nothing-to-do (exit 3)', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  try {
    const r = run(['--checkout', root]);
    assert.equal(r.status, 3);
    assert.match(r.stderr, /nothing to do/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a confirmed run links every skill into the selected profile', async () => {
  const root = await makeCheckout({
    alpha: { 'SKILL.md': SKILL('alpha') },
    beta: { 'SKILL.md': SKILL('beta') },
  });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const r = await fullInstall(['--checkout', root, '--harness', 'agents'], { HOME: home });
    assert.equal(r.status, 0);
    const dest = join(home, '.agents', 'skills', 'alpha');
    assert.ok(lstatSync(dest).isSymbolicLink());
    assert.equal(readlinkSync(dest), join(root, 'skills', 'alpha'));
    assert.ok(lstatSync(join(home, '.agents', 'skills', 'beta')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('confirmation gates all changes: declining leaves the profile untouched', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const decline = run(['--checkout', root, '--harness', 'agents'], { input: 'n\n', env: { HOME: home } });
    assert.equal(decline.status, 0);
    assert.match(decline.stdout, /Installation preview/);
    assert.equal(existsSync(join(home, '.agents', 'skills', 'alpha')), false);

    const accept = run(['--checkout', root, '--harness', 'agents'], { input: 'y\n', env: { HOME: home } });
    assert.equal(accept.status, 0);
    assert.ok(lstatSync(join(home, '.agents', 'skills', 'alpha')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('re-runs are idempotent and pick up newly added skills', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const first = await fullInstall(['--checkout', root, '--harness', 'agents'], { HOME: home });
    assert.equal(first.status, 0);
    const second = await fullInstall(['--checkout', root, '--harness', 'agents'], { HOME: home });
    assert.equal(second.status, 0);
    assert.ok(lstatSync(join(home, '.agents', 'skills', 'alpha')).isSymbolicLink());

    // Add a new skill to the checkout, then re-run.
    await mkdir(join(root, 'skills', 'gamma'), { recursive: true });
    await writeFile(join(root, 'skills', 'gamma', 'SKILL.md'), SKILL('gamma'));
    const third = await fullInstall(['--checkout', root, '--harness', 'agents'], { HOME: home });
    assert.equal(third.status, 0);
    assert.ok(lstatSync(join(home, '.agents', 'skills', 'gamma')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('the config-root env var resolves the profile path (Codex CODEX_HOME)', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  const codexHome = await mkdtemp(join(tmpdir(), 'codex-'));
  try {
    const r = await fullInstall(['--checkout', root, '--harness', 'codex'], { HOME: home, CODEX_HOME: codexHome });
    assert.equal(r.status, 0);
    assert.ok(lstatSync(join(codexHome, 'skills', 'alpha')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    await rm(codexHome, { recursive: true, force: true });
  }
});

const SKILL_DEP = (name, requires) =>
  `---\nname: ${name}\ndescription: d\n---\n## Overview\nx\n\n## Required skills\n${requires.map((r) => `- ${r}`).join('\n')}\n`;

test('a missing canonical dependency rejects the install (exit 4) and links nothing', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL_DEP('alpha', ['ghost']) } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const r = run(['--yes', '--checkout', root, '--harness', 'agents'], { env: { HOME: home } });
    assert.equal(r.status, 4);
    assert.match(r.stderr, /alpha/);
    assert.match(r.stderr, /ghost/);
    assert.equal(existsSync(join(home, '.agents', 'skills', 'alpha')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('a dependency cycle rejects the install (exit 4) and links nothing', async () => {
  const root = await makeCheckout({
    alpha: { 'SKILL.md': SKILL_DEP('alpha', ['beta']) },
    beta: { 'SKILL.md': SKILL_DEP('beta', ['alpha']) },
  });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const r = run(['--yes', '--checkout', root, '--harness', 'agents'], { env: { HOME: home } });
    assert.equal(r.status, 4);
    assert.match(r.stderr, /cycle/i);
    assert.match(r.stderr, /alpha/);
    assert.equal(existsSync(join(home, '.agents', 'skills', 'alpha')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});
