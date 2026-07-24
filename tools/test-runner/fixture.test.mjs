import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildFixture, hashTree, hashGuardedTrees } from './fixture.mjs';

// Build a temp skills/ tree: a -> b -> c (a requires b, b requires c).
async function makeSkills(root) {
  const skills = {
    a: '---\nname: a\ndescription: d\n---\nbody\n\n## Required skills\n\n- b\n',
    b: '---\nname: b\ndescription: d\n---\nbody\n\n## Required skills\n\n- c\n',
    c: '---\nname: c\ndescription: d\n---\nbody\n',
    z: '---\nname: z\ndescription: d\n---\nunrelated\n',
  };
  for (const [name, text] of Object.entries(skills)) {
    await mkdir(join(root, name), { recursive: true });
    await writeFile(join(root, name, 'SKILL.md'), text);
  }
}

test('buildFixture projects the full ## Required skills closure and nothing extra', async () => {
  const skillsRoot = await mkdtemp(join(tmpdir(), 'tr-src-'));
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tr-fx-'));
  try {
    await makeSkills(skillsRoot);
    const driver = { discoverySubdir: '.claude/skills' };
    const { closure } = await buildFixture({ skillName: 'a', skillsRoot, driver, fixtureRoot });
    assert.deepEqual(closure, ['a', 'b', 'c']); // sorted, includes start, excludes unrelated z
    const projected = await readdir(join(fixtureRoot, '.claude/skills'));
    assert.deepEqual(projected.sort(), ['a', 'b', 'c']);
    // The projected SKILL.md is byte-identical to the source.
    const src = await readFile(join(skillsRoot, 'a', 'SKILL.md'), 'utf8');
    const proj = await readFile(join(fixtureRoot, '.claude/skills/a/SKILL.md'), 'utf8');
    assert.equal(proj, src);
  } finally {
    await rm(skillsRoot, { recursive: true, force: true });
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('buildFixture leaves canonical sources unmodified (hashTree unchanged)', async () => {
  const skillsRoot = await mkdtemp(join(tmpdir(), 'tr-src-'));
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tr-fx-'));
  try {
    await makeSkills(skillsRoot);
    const before = await hashTree(skillsRoot);
    await buildFixture({ skillName: 'a', skillsRoot, driver: { discoverySubdir: '.codex/skills' }, fixtureRoot });
    const after = await hashTree(skillsRoot);
    assert.equal(after, before);
  } finally {
    await rm(skillsRoot, { recursive: true, force: true });
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('buildFixture seeds case inputs into the fixture working dir', async () => {
  const skillsRoot = await mkdtemp(join(tmpdir(), 'tr-src-'));
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tr-fx-'));
  try {
    await makeSkills(skillsRoot);
    await buildFixture({
      skillName: 'c',
      skillsRoot,
      driver: { discoverySubdir: '.opencode/skills' },
      fixtureRoot,
      inputs: [{ path: 'package.json', content: '{"name":"x"}\n' }],
    });
    assert.equal(await readFile(join(fixtureRoot, 'package.json'), 'utf8'), '{"name":"x"}\n');
  } finally {
    await rm(skillsRoot, { recursive: true, force: true });
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

// Positive confinement proof (opencode fixture-escape fix): `opencode run`
// walks up from cwd for a `.git` dir and resolves a project via its own
// registry, so a fixture must be a real, committed git repo for the walk-up
// to bind there instead of escaping upward. Harness-agnostic — every fixture
// gets this, regardless of which driver built it.
test('buildFixture leaves the fixture as a git repo with a clean, committed baseline', async () => {
  const skillsRoot = await mkdtemp(join(tmpdir(), 'tr-src-'));
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tr-fx-'));
  try {
    await makeSkills(skillsRoot);
    const { baselineSha } = await buildFixture({
      skillName: 'a',
      skillsRoot,
      driver: { discoverySubdir: '.opencode/skills' },
      fixtureRoot,
      inputs: [{ path: 'package.json', content: '{"name":"x"}\n' }],
    });
    const git = (args) => spawnSync('git', args, { cwd: fixtureRoot, encoding: 'utf8' });
    assert.equal(git(['rev-parse', '--is-inside-work-tree']).stdout.trim(), 'true');
    // Working tree is clean: everything (skills + seeded inputs) is committed.
    assert.equal(git(['status', '--porcelain']).stdout, '');
    // Exactly one baseline commit, so the walk-up finds real history here.
    assert.equal(git(['rev-list', '--count', 'HEAD']).stdout.trim(), '1');
    // The recorded baseline sha IS that commit — the git-unchanged oracle
    // asserts equality with it (equality-with-baseline, not shape-of-history).
    assert.match(baselineSha, /^[0-9a-f]{40}$/);
    assert.equal(git(['rev-parse', 'HEAD']).stdout.trim(), baselineSha);
  } finally {
    await rm(skillsRoot, { recursive: true, force: true });
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

// Dirty-worktree support (#53): a case marks an input `uncommitted: true` to
// seed it AFTER the baseline commit, so the fixture starts with real, detectable
// working-tree drift — the only way a docs-setup upgrade case can exercise the
// "clean-worktree by default, explicit approval when dirty" gate live. Committed
// inputs (the default) still land in the single baseline commit; only flagged
// inputs are left uncommitted.
test('buildFixture seeds uncommitted inputs AFTER the baseline commit (dirty worktree)', async () => {
  const skillsRoot = await mkdtemp(join(tmpdir(), 'tr-src-'));
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tr-fx-'));
  try {
    await makeSkills(skillsRoot);
    const { baselineSha } = await buildFixture({
      skillName: 'c',
      skillsRoot,
      driver: { discoverySubdir: '.claude/skills' },
      fixtureRoot,
      inputs: [
        { path: 'package.json', content: '{"name":"x"}\n' },
        { path: 'dirty.txt', content: 'uncommitted drift\n', uncommitted: true },
      ],
    });
    const git = (args) => spawnSync('git', args, { cwd: fixtureRoot, encoding: 'utf8' });
    // Both files exist on disk...
    assert.equal(await readFile(join(fixtureRoot, 'package.json'), 'utf8'), '{"name":"x"}\n');
    assert.equal(await readFile(join(fixtureRoot, 'dirty.txt'), 'utf8'), 'uncommitted drift\n');
    // ...but the flagged one is NOT in the baseline commit — the tree is dirty.
    const status = git(['status', '--porcelain']).stdout;
    assert.match(status, /dirty\.txt/);
    assert.doesNotMatch(status, /package\.json/);
    // HEAD is still the recorded baseline (nothing new committed), so
    // git-uncommitted holds while git-unchanged (clean tree) would not.
    assert.equal(git(['rev-parse', 'HEAD']).stdout.trim(), baselineSha);
    assert.equal(git(['rev-list', '--count', 'HEAD']).stdout.trim(), '1');
    // The uncommitted file is untracked, so nothing is staged.
    assert.equal(git(['diff', '--cached', '--quiet']).status, 0);
  } finally {
    await rm(skillsRoot, { recursive: true, force: true });
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('buildFixture throws on an unknown skill', async () => {
  const skillsRoot = await mkdtemp(join(tmpdir(), 'tr-src-'));
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tr-fx-'));
  try {
    await makeSkills(skillsRoot);
    await assert.rejects(
      () => buildFixture({ skillName: 'missing', skillsRoot, driver: { discoverySubdir: '.claude/skills' }, fixtureRoot }),
      /unknown skill: missing/,
    );
  } finally {
    await rm(skillsRoot, { recursive: true, force: true });
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('hashGuardedTrees changes when any guarded dir changes and ignores missing dirs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tr-guard-'));
  try {
    await mkdir(join(root, 'skills'), { recursive: true });
    await writeFile(join(root, 'skills', 'f.txt'), 'one');
    const dirs = ['skills', 'docs']; // docs/ absent → ENOENT-tolerant
    const h1 = await hashGuardedTrees(root, dirs);
    assert.equal(await hashGuardedTrees(root, dirs), h1); // stable
    await writeFile(join(root, 'skills', 'f.txt'), 'two');
    assert.notEqual(await hashGuardedTrees(root, dirs), h1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('hashTree changes when a file changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tr-hash-'));
  try {
    await writeFile(join(root, 'f.txt'), 'one');
    const h1 = await hashTree(root);
    await writeFile(join(root, 'f.txt'), 'two');
    const h2 = await hashTree(root);
    assert.notEqual(h1, h2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
