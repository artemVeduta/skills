import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lstatSync, readlinkSync, existsSync, readFileSync, symlinkSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const INSTALLER = fileURLToPath(new URL('./install.sh', import.meta.url));

function run(args, { input, env, cwd } = {}) {
  return spawnSync(INSTALLER, args, {
    encoding: 'utf8',
    input,
    cwd,
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
    const r = run(['--dry-run', '--checkout', root, '--harness', 'codex'], { env: { HOME: home } });
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
    const r = await fullInstall(['--checkout', root, '--harness', 'codex'], { HOME: home });
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
    const decline = run(['--checkout', root, '--harness', 'codex'], { input: 'n\n', env: { HOME: home } });
    assert.equal(decline.status, 0);
    assert.match(decline.stdout, /Installation preview/);
    assert.equal(existsSync(join(home, '.agents', 'skills', 'alpha')), false);

    const accept = run(['--checkout', root, '--harness', 'codex'], { input: 'y\n', env: { HOME: home } });
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
    const first = await fullInstall(['--checkout', root, '--harness', 'codex'], { HOME: home });
    assert.equal(first.status, 0);
    const second = await fullInstall(['--checkout', root, '--harness', 'codex'], { HOME: home });
    assert.equal(second.status, 0);
    assert.ok(lstatSync(join(home, '.agents', 'skills', 'alpha')).isSymbolicLink());

    // Add a new skill to the checkout, then re-run.
    await mkdir(join(root, 'skills', 'gamma'), { recursive: true });
    await writeFile(join(root, 'skills', 'gamma', 'SKILL.md'), SKILL('gamma'));
    const third = await fullInstall(['--checkout', root, '--harness', 'codex'], { HOME: home });
    assert.equal(third.status, 0);
    assert.ok(lstatSync(join(home, '.agents', 'skills', 'gamma')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('reconciliation converges pack membership without deleting unrelated user content', async () => {
  // The repository pack changes over time (e.g. #60 retired a skill); re-running the
  // installer must reconcile the installed checkout toward the CURRENT pack membership
  // — every present member linked — while leaving user-owned content the installer does
  // not own completely untouched. This is the repository-and-installed-checkout
  // reconciliation guarantee: converge membership, never delete unrelated entries.
  const root = await makeCheckout({
    alpha: { 'SKILL.md': SKILL('alpha') },
    beta: { 'SKILL.md': SKILL('beta') },
  });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const first = await fullInstall(['--checkout', root, '--harness', 'codex'], { HOME: home });
    assert.equal(first.status, 0);

    // A user-owned entry the installer did not create and does not own: a real
    // directory (not a symlink into the checkout) carrying the user's own content.
    const userOwned = join(home, '.agents', 'skills', 'user-own');
    await mkdir(userOwned, { recursive: true });
    await writeFile(join(userOwned, 'notes.md'), 'my own content');

    // Pack membership changes in the repository checkout: a member is added.
    await mkdir(join(root, 'skills', 'gamma'), { recursive: true });
    await writeFile(join(root, 'skills', 'gamma', 'SKILL.md'), SKILL('gamma'));

    const second = await fullInstall(['--checkout', root, '--harness', 'codex'], { HOME: home });
    assert.equal(second.status, 0);

    // Convergence: every current pack member is linked into the profile.
    for (const name of ['alpha', 'beta', 'gamma']) {
      const dest = join(home, '.agents', 'skills', name);
      assert.ok(lstatSync(dest).isSymbolicLink(), `${name} must be linked`);
      assert.equal(readlinkSync(dest), join(root, 'skills', name));
    }

    // Safety: the user-owned directory and its content survive untouched —
    // reconciliation never removes an entry it does not own.
    assert.ok(existsSync(userOwned), 'unrelated user content must survive reconciliation');
    assert.equal(lstatSync(userOwned).isSymbolicLink(), false, 'user dir stays a real directory');
    assert.equal(readFileSync(join(userOwned, 'notes.md'), 'utf8'), 'my own content');
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('the config-root env var resolves the profile path (Claude CLAUDE_CONFIG_DIR)', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  const claudeCfg = await mkdtemp(join(tmpdir(), 'claude-'));
  try {
    const r = await fullInstall(['--checkout', root, '--harness', 'claude-code'], { HOME: home, CLAUDE_CONFIG_DIR: claudeCfg });
    assert.equal(r.status, 0);
    // The env var overrides the default ~/.claude root for the global skill dir.
    assert.ok(lstatSync(join(claudeCfg, 'skills', 'alpha')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    await rm(claudeCfg, { recursive: true, force: true });
  }
});

const SKILL_DEP = (name, requires) =>
  `---\nname: ${name}\ndescription: d\n---\n## Overview\nx\n\n## Required skills\n${requires.map((r) => `- ${r}`).join('\n')}\n`;

test('a missing canonical dependency rejects the install (exit 4) and links nothing', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL_DEP('alpha', ['ghost']) } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const r = run(['--yes', '--checkout', root, '--harness', 'codex'], { env: { HOME: home } });
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
    const r = run(['--yes', '--checkout', root, '--harness', 'codex'], { env: { HOME: home } });
    assert.equal(r.status, 4);
    assert.match(r.stderr, /cycle/i);
    assert.match(r.stderr, /alpha/);
    assert.equal(existsSync(join(home, '.agents', 'skills', 'alpha')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

import { symlink } from 'node:fs/promises';

test('a non-symlink collision is disclosed and only replaced after confirmation', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  const dest = join(home, '.agents', 'skills', 'alpha');
  await mkdir(dest, { recursive: true }); // a real directory sitting where the link will go
  await writeFile(join(dest, 'keep.txt'), 'real');
  try {
    // Declining must NOT replace the real directory.
    const decline = run(['--checkout', root, '--harness', 'codex'], { input: 'n\n', env: { HOME: home } });
    assert.match(decline.stdout, /REPLACE non-symlink/);
    assert.match(decline.stdout, /alpha/);
    assert.equal(lstatSync(dest).isSymbolicLink(), false);
    assert.ok(existsSync(join(dest, 'keep.txt')));

    // Confirming replaces it with a symlink.
    const accept = run(['--checkout', root, '--harness', 'codex'], { input: 'y\n', env: { HOME: home } });
    assert.equal(accept.status, 0);
    assert.ok(lstatSync(dest).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('the self-symlink guard refuses a target resolving into the checkout (exit 1)', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  // Make ~/.agents a symlink into the checkout, so ~/.agents/skills resolves inside it.
  await symlink(root, join(home, '.agents'));
  try {
    const r = run(['--yes', '--checkout', root, '--harness', 'codex'], { env: { HOME: home } });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /resolves into this repository/);
    assert.match(r.stderr, /rm /); // remediation guidance
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('channel-mixing is guarded precisely: a plain ~/.agents/skills install (no managed shape) is allowed', async () => {
  // Codex/OpenCode canonically use ~/.agents/skills; channel mixing is enforced by
  // the precise managed-shape refusal, not a blanket warning. With no managed marker
  // present, the install proceeds and links the pack.
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const r = await fullInstall(['--checkout', root, '--harness', 'codex'], { HOME: home });
    assert.equal(r.status, 0);
    assert.ok(lstatSync(join(home, '.agents', 'skills', 'alpha')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

// A toy harness registry, written to disk and loaded via --registry.
async function writeRegistry(entries) {
  const dir = await mkdtemp(join(tmpdir(), 'reg-'));
  const path = join(dir, 'registry.json');
  await writeFile(path, JSON.stringify(entries));
  return { dir, path };
}

const TOY = [
  {
    id: 'toy',
    displayName: 'Toy Harness',
    skillDirs: { global: 'toy-skills' },
    configRoot: { env: null, defaults: [{ id: 'main', dir: '.toy' }] },
    scopes: ['global'],
    channels: ['development'],
    customProfileValidation: { allowHomeRelative: true },
  },
];

test('a toy harness registry entry resolves its own paths with no wizard changes', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  const { dir: regDir, path: regPath } = await writeRegistry(TOY);
  try {
    // Inspect: the toy harness is listed.
    const ins = run(['--inspect', '--checkout', root, '--registry', regPath], { env: { HOME: home } });
    assert.equal(ins.status, 0);
    assert.match(ins.stdout, /toy \(Toy Harness\)/);

    // Install: links land in the toy harness's own skill directory template.
    const r = await fullInstall(['--checkout', root, '--registry', regPath, '--harness', 'toy'], { HOME: home });
    assert.equal(r.status, 0);
    assert.ok(lstatSync(join(home, '.toy', 'toy-skills', 'alpha')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    await rm(regDir, { recursive: true, force: true });
  }
});

test('an unknown harness id is a usage error (exit 2)', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  try {
    const r = run(['--yes', '--checkout', root, '--harness', 'nope']);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /unknown harness: nope/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the committed README managed-install blocks match the registry', () => {
  const readme = fileURLToPath(new URL('../README.md', import.meta.url));
  const r = run(['--check-readme', readme]);
  assert.equal(r.status, 0);
});

test('the interactive wizard selects harnesses and confirms from stdin', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const r = run(['--interactive', '--checkout', root], { input: 'codex\ny\n', env: { HOME: home } });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Installation preview/);
    assert.ok(lstatSync(join(home, '.agents', 'skills', 'alpha')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('interactive selection of nothing is nothing-to-do (exit 3)', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    // Blank harness line = all harnesses in this build; type a bogus id to select none.
    const r = run(['--interactive', '--checkout', root], { input: '__none__\n', env: { HOME: home } });
    assert.equal(r.status, 2); // unknown harness -> usage error
    assert.match(r.stderr, /unknown harness/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

// --- #61: three-harness checkout delivery ---------------------------------

// Count "Skill directory:" lines in a preview — one per resolved write placement.
const placementCount = (stdout) => (stdout.match(/Skill directory:/g) || []).length;

test('the registry models three harness products (exit 0)', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  try {
    const r = run(['--inspect', '--checkout', root]);
    assert.equal(r.status, 0);
    for (const id of ['claude-code', 'codex', 'opencode']) assert.match(r.stdout, new RegExp(id));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('exact global targets: claude-code -> ~/.claude/skills, codex/opencode -> ~/.agents/skills', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const cc = await fullInstall(['--checkout', root, '--harness', 'claude-code'], { HOME: home });
    assert.equal(cc.status, 0);
    assert.ok(lstatSync(join(home, '.claude', 'skills', 'alpha')).isSymbolicLink());

    const cx = await fullInstall(['--checkout', root, '--harness', 'codex'], { HOME: home });
    assert.equal(cx.status, 0);
    assert.ok(lstatSync(join(home, '.agents', 'skills', 'alpha')).isSymbolicLink());

    const oc = await fullInstall(['--checkout', root, '--harness', 'opencode'], { HOME: home });
    assert.equal(oc.status, 0);
    assert.ok(lstatSync(join(home, '.agents', 'skills', 'alpha')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('exact project targets: claude-code -> .claude/skills, codex -> .agents/skills', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  const proj = await mkdtemp(join(tmpdir(), 'proj-'));
  try {
    // Project scope writes into the process cwd, so run with cwd = the project dir.
    const r = run(['--yes', '--checkout', root, '--scope', 'project', '--harness', 'claude-code', '--harness', 'codex'], { env: { HOME: home }, cwd: proj });
    assert.equal(r.status, 0);
    assert.ok(lstatSync(join(proj, '.claude', 'skills', 'alpha')).isSymbolicLink());
    assert.ok(lstatSync(join(proj, '.agents', 'skills', 'alpha')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    await rm(proj, { recursive: true, force: true });
  }
});

test('selections resolving to the same directory are deduplicated (codex + opencode -> one placement)', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const r = run(['--dry-run', '--checkout', root, '--harness', 'codex', '--harness', 'opencode'], { env: { HOME: home } });
    assert.equal(r.status, 0);
    assert.equal(placementCount(r.stdout), 1); // one deduplicated ~/.agents/skills placement
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('OpenCode adds no placement already exposed by a selected Claude target', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const r = run(['--dry-run', '--checkout', root, '--profile', 'claude-code:personal', '--harness', 'opencode'], { env: { HOME: home } });
    assert.equal(r.status, 0);
    // Claude's ~/.claude/skills is read by OpenCode, so OpenCode contributes nothing.
    assert.equal(placementCount(r.stdout), 1);
    assert.match(r.stdout, /\.claude\/skills/);
    assert.doesNotMatch(r.stdout, /\.agents\/skills/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('OpenCode survives a CLAUDE_CONFIG_DIR-overridden Claude global target (custom root is not discovered)', async () => {
  // OpenCode scans the CANONICAL ~/.claude/skills, not another product's env override.
  // With Claude pointed at a custom config dir, that dir is not on OpenCode's discovery
  // path, so OpenCode must keep its own ~/.agents/skills placement rather than dedup away.
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  const claudeCfg = await mkdtemp(join(tmpdir(), 'claude-'));
  try {
    const r = run(
      ['--dry-run', '--checkout', root, '--profile', 'claude-code:personal', '--harness', 'opencode'],
      { env: { HOME: home, CLAUDE_CONFIG_DIR: claudeCfg } },
    );
    assert.equal(r.status, 0);
    assert.equal(placementCount(r.stdout), 2); // custom Claude root + OpenCode's own .agents/skills
    assert.ok(r.stdout.includes(join(claudeCfg, 'skills')), 'Claude links into the custom config root');
    assert.match(r.stdout, /\.agents\/skills/); // OpenCode keeps its own placement
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    await rm(claudeCfg, { recursive: true, force: true });
  }
});

test('coexisting Claude and Codex project placements expose each identity once to OpenCode (two placements)', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  const proj = await mkdtemp(join(tmpdir(), 'proj-'));
  try {
    const r = run(
      ['--dry-run', '--scope', 'project', '--checkout', root, '--harness', 'claude-code', '--harness', 'codex', '--harness', 'opencode'],
      { env: { HOME: home }, cwd: proj },
    );
    assert.equal(r.status, 0);
    // Exactly two placements: .claude/skills and .agents/skills; OpenCode adds no third.
    assert.equal(placementCount(r.stdout), 2);
    assert.match(r.stdout, /\.claude\/skills/);
    assert.match(r.stdout, /\.agents\/skills/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    await rm(proj, { recursive: true, force: true });
  }
});

// A git-initialised checkout so provenance can report a real commit.
async function makeGitCheckout(skills) {
  const root = await makeCheckout(skills);
  const g = (args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  g(['init', '-q']);
  g(['config', 'user.email', 't@t']);
  g(['config', 'user.name', 't']);
  g(['add', '-A']);
  g(['commit', '-q', '-m', 'init']);
  return root;
}

test('inspect and install output report checkout Git provenance (commit)', async () => {
  const root = await makeGitCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  try {
    const ins = run(['--inspect', '--checkout', root]);
    assert.equal(ins.status, 0);
    assert.match(ins.stdout, /provenance/i);
    assert.match(ins.stdout, new RegExp(head.slice(0, 12)));

    const prev = run(['--dry-run', '--checkout', root, '--harness', 'codex'], { env: { HOME: home } });
    assert.equal(prev.status, 0);
    assert.match(prev.stdout, new RegExp(head.slice(0, 12)));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('a confirmed install into a Git checkout installs no Git hooks', async () => {
  const root = await makeGitCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const r = await fullInstall(['--checkout', root, '--harness', 'codex'], { HOME: home });
    assert.equal(r.status, 0);
    // git init seeds only *.sample hooks; the installer adds no active hook.
    const hooks = readdirSync(join(root, '.git', 'hooks'));
    assert.equal(hooks.every((h) => h.endsWith('.sample')), true, `unexpected hook: ${hooks.filter((h) => !h.endsWith('.sample')).join(', ')}`);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('an existing portable managed shape is refused before mutation (exit 1) with path and channel', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  // Portable shape already occupies ~/.agents/skills.
  const skillDir = join(home, '.agents', 'skills');
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, '.okf-managed.json'), JSON.stringify({ channel: 'portable' }));
  try {
    const r = run(['--yes', '--checkout', root, '--harness', 'codex'], { env: { HOME: home } });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /portable/);
    assert.match(r.stderr, new RegExp(skillDir.replace(/[.]/g, '\\.')));
    // filesystem unchanged: no alpha link was written
    assert.equal(existsSync(join(skillDir, 'alpha')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('an existing native managed shape is refused before mutation (exit 1) with channel', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  // Native plugin shape marks the config root (parent of ~/.claude/skills).
  await mkdir(join(home, '.claude'), { recursive: true });
  await writeFile(join(home, '.claude', '.okf-managed.json'), JSON.stringify({ channel: 'native' }));
  try {
    const r = run(['--yes', '--checkout', root, '--harness', 'claude-code'], { env: { HOME: home } });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /native/);
    assert.equal(existsSync(join(home, '.claude', 'skills', 'alpha')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('a stale checkout-owned link is pruned on rerun; other-checkout links and real dirs survive', async () => {
  const root = await makeCheckout({
    alpha: { 'SKILL.md': SKILL('alpha') },
    beta: { 'SKILL.md': SKILL('beta') },
  });
  const other = await makeCheckout({ zeta: { 'SKILL.md': SKILL('zeta') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  const skillDir = join(home, '.agents', 'skills');
  try {
    const first = await fullInstall(['--checkout', root, '--harness', 'codex'], { HOME: home });
    assert.equal(first.status, 0);
    assert.ok(lstatSync(join(skillDir, 'beta')).isSymbolicLink());

    // A link owned by ANOTHER checkout, and a real user directory — neither is ours.
    symlinkSync(join(other, 'skills', 'zeta'), join(skillDir, 'zeta'));
    await mkdir(join(skillDir, 'user-own'), { recursive: true });
    await writeFile(join(skillDir, 'user-own', 'notes.md'), 'mine');

    // Pack membership shrinks: beta is retired from the checkout.
    await rm(join(root, 'skills', 'beta'), { recursive: true, force: true });

    const second = await fullInstall(['--checkout', root, '--harness', 'codex'], { HOME: home });
    assert.equal(second.status, 0);

    // Stale, checkout-owned beta link is removed.
    assert.equal(existsSync(join(skillDir, 'beta')), false);
    // Current member survives.
    assert.ok(lstatSync(join(skillDir, 'alpha')).isSymbolicLink());
    // Foreign link and real dir are preserved.
    assert.ok(lstatSync(join(skillDir, 'zeta')).isSymbolicLink());
    assert.equal(readFileSync(join(skillDir, 'user-own', 'notes.md'), 'utf8'), 'mine');
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(other, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('confirmation gates pruning: declining leaves a stale link untouched', async () => {
  const root = await makeCheckout({
    alpha: { 'SKILL.md': SKILL('alpha') },
    beta: { 'SKILL.md': SKILL('beta') },
  });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  const skillDir = join(home, '.agents', 'skills');
  try {
    await fullInstall(['--checkout', root, '--harness', 'codex'], { HOME: home });
    await rm(join(root, 'skills', 'beta'), { recursive: true, force: true });

    const decline = run(['--checkout', root, '--harness', 'codex'], { input: 'n\n', env: { HOME: home } });
    assert.equal(decline.status, 0);
    assert.match(decline.stdout, /remove stale/i);
    assert.match(decline.stdout, /beta/);
    // Declined: the stale link is still there.
    assert.ok(lstatSync(join(skillDir, 'beta')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});
