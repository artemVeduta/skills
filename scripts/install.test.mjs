import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
