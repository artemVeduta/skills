import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { DRIVERS, resolveDriver } from './drivers.mjs';

test('exactly the three supported harnesses are registered', () => {
  assert.deepEqual(DRIVERS.map((d) => d.id).sort(), ['claude-code', 'codex', 'opencode']);
});

test('each driver declares its discovery subdir', () => {
  assert.equal(resolveDriver('claude-code').discoverySubdir, '.claude/skills');
  assert.equal(resolveDriver('codex').discoverySubdir, '.agents/skills'); // pinned by V3
  assert.equal(resolveDriver('opencode').discoverySubdir, '.opencode/skills');
});

test('resolveDriver returns null for an unknown id', () => {
  assert.equal(resolveDriver('nope'), null);
});

test('each driver pins a default model and a driver-owned probe', () => {
  assert.equal(resolveDriver('claude-code').defaultModel, 'claude-opus-4.8');
  assert.equal(resolveDriver('codex').defaultModel, 'gpt-5.6-sol');
  // opencode-go is the provider authed in the profile (finding #5); the id was
  // taken from `opencode models` run under that profile env.
  assert.equal(resolveDriver('opencode').defaultModel, 'opencode-go/qwen3.7-max');
  for (const d of DRIVERS) assert.deepEqual(d.probe, { args: ['--version'] });
});

test('only opencode declares a daemon guard', () => {
  assert.equal(resolveDriver('opencode').daemonBasename, 'opencode');
  assert.equal(resolveDriver('claude-code').daemonBasename, undefined);
  assert.equal(resolveDriver('codex').daemonBasename, undefined);
});

test('claude-code invocation threads the model and uses the profile config dir', () => {
  const inv = resolveDriver('claude-code').buildInvocation({
    fixtureRoot: '/fx', prompt: 'hello', model: 'claude-opus-4.8', profileDir: '/prof/claude-code',
  });
  assert.equal(inv.command, 'claude');
  assert.deepEqual(inv.args, ['-p', 'hello', '--permission-mode', 'bypassPermissions', '--model', 'claude-opus-4.8']);
  assert.deepEqual(inv.env, { CLAUDE_CONFIG_DIR: '/prof/claude-code' });
});

test('codex invocation keeps the workspace-write sandbox, skips the git-repo check (finding #2), and threads -m', () => {
  const inv = resolveDriver('codex').buildInvocation({
    fixtureRoot: '/fx', prompt: 'hi', model: 'gpt-5.6-sol', profileDir: '/prof/codex',
  });
  assert.equal(inv.command, 'codex');
  // --skip-git-repo-check: fixtures are non-git tmpdirs; without it every live
  // codex run refuses to start (finding #2).
  assert.deepEqual(inv.args, ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', '-m', 'gpt-5.6-sol', 'hi']);
  // codex relocates HOME as well as CODEX_HOME (finding #4 — confines the
  // HOME-derived ~/.agents/skills leak; flows from profileEnvFor).
  assert.deepEqual(inv.env, { CODEX_HOME: '/prof/codex', HOME: '/prof/codex' });
});

test('opencode invocation threads the provider-prefixed model and the confining env', () => {
  const inv = resolveDriver('opencode').buildInvocation({
    fixtureRoot: '/fx', prompt: 'yo', model: 'opencode-go/qwen3.7-max', profileDir: '/prof/opencode',
  });
  assert.equal(inv.command, 'opencode');
  // --dir pins the run to the fixture root: `opencode run` walks up from cwd
  // for a `.git` dir and resolves a project via its own registry, so without
  // --dir a non-git fixture cwd can escape to an unrelated project.
  assert.deepEqual(inv.args, ['run', '--auto', '--dir', '/fx', '-m', 'opencode-go/qwen3.7-max', 'yo']);
  assert.deepEqual(inv.env, {
    HOME: '/prof/opencode',
    XDG_CONFIG_HOME: '/prof/opencode/xdg-config',
    XDG_DATA_HOME: '/prof/opencode/xdg-data',
    XDG_CACHE_HOME: '/prof/opencode/xdg-cache',
    XDG_STATE_HOME: '/prof/opencode/xdg-state',
    OPENCODE_DISABLE_AUTOUPDATE: '1',
  });
});

// --- resume invocations (v2 acceptance seam): a case pauses after a proposed
// plan (the first headless turn ends) and resumes the SAME session with an
// explicit approval or denial prompt. Flags verified against the installed
// CLIs 2026-07-24 (`claude --help`, `codex exec resume --help`,
// `opencode run --help`). ---

test('claude-code resume continues the cwd-scoped most recent conversation', () => {
  const inv = resolveDriver('claude-code').buildResumeInvocation({
    fixtureRoot: '/fx', prompt: 'approve', model: 'claude-opus-4.8', profileDir: '/prof/claude-code',
  });
  assert.equal(inv.command, 'claude');
  // --continue is scoped to "the most recent conversation in the current
  // directory" — the per-run fixture cwd, so it can only hit this run's turn 1.
  assert.deepEqual(inv.args, ['-p', 'approve', '--continue', '--permission-mode', 'bypassPermissions', '--model', 'claude-opus-4.8']);
  assert.deepEqual(inv.env, { CLAUDE_CONFIG_DIR: '/prof/claude-code' });
});

test('codex resume picks the most recent session and keeps the sandbox posture', () => {
  const inv = resolveDriver('codex').buildResumeInvocation({
    fixtureRoot: '/fx', prompt: 'deny', model: 'gpt-5.6-sol', profileDir: '/prof/codex',
  });
  assert.equal(inv.command, 'codex');
  // `exec resume` has no --sandbox flag; the workspace-write posture is
  // re-asserted through the documented -c config override.
  assert.deepEqual(inv.args, ['exec', 'resume', '--last', '-c', 'sandbox_mode="workspace-write"', '--skip-git-repo-check', '-m', 'gpt-5.6-sol', 'deny']);
  assert.deepEqual(inv.env, { CODEX_HOME: '/prof/codex', HOME: '/prof/codex' });
});

test('opencode resume continues the last session pinned to the fixture dir', () => {
  const inv = resolveDriver('opencode').buildResumeInvocation({
    fixtureRoot: '/fx', prompt: 'approve', model: 'opencode-go/qwen3.7-max', profileDir: '/prof/opencode',
  });
  assert.equal(inv.command, 'opencode');
  assert.deepEqual(inv.args, ['run', '--auto', '--continue', '--dir', '/fx', '-m', 'opencode-go/qwen3.7-max', 'approve']);
});

test('every driver can build a resume invocation whose env matches its first turn', () => {
  for (const d of DRIVERS) {
    const opts = { fixtureRoot: '/fx', prompt: 'go on', model: d.defaultModel, profileDir: `/prof/${d.id}` };
    assert.deepEqual(d.buildResumeInvocation(opts).env, d.buildInvocation(opts).env,
      `${d.id}: resume must see the same profile env as turn 1`);
  }
});

// Freezes the resume/turn-1 args invariant for the drivers whose resume is by
// design "turn 1 plus --continue" (claude-code, opencode). The argv lists stay
// hand-written and CLI-verified (the repo's no-derived-flags stance), so this
// test is what catches a turn-1 flag change (e.g. permission posture) that is
// not mirrored into its resume twin. codex's resume is a genuinely different
// subcommand shape and is pinned exactly by its own test above.
test('claude-code and opencode resume args are exactly turn-1 args plus --continue', () => {
  for (const id of ['claude-code', 'opencode']) {
    const d = resolveDriver(id);
    const opts = { fixtureRoot: '/fx', prompt: 'go on', model: d.defaultModel, profileDir: `/prof/${id}` };
    const resumeArgs = d.buildResumeInvocation(opts).args;
    assert.equal(resumeArgs.filter((a) => a === '--continue').length, 1, `${id}: resume must add --continue once`);
    assert.deepEqual(resumeArgs.filter((a) => a !== '--continue'), d.buildInvocation(opts).args,
      `${id}: resume args must be turn-1 args plus --continue — mirror turn-1 flag changes into the resume twin`);
  }
});

// Rewritten isolation invariant (spec §10): scoped to the env map
// buildInvocation RETURNS (not the effective child env). Every path-valued
// entry points at the fixture root or that harness's profile dir; the map
// never points HOME / CLAUDE_CONFIG_DIR / CODEX_HOME / any XDG root at the
// developer's real locations. claude-code OMITS HOME (Keychain access); codex
// RELOCATES HOME into the profile (finding #4).
test('every returned env entry targets the fixture or the profile — never the real home', () => {
  for (const d of DRIVERS) {
    const profileDir = `/prof/${d.id}`;
    const { env } = d.buildInvocation({ fixtureRoot: '/fx', prompt: 'x', model: d.defaultModel, profileDir });
    for (const [k, v] of Object.entries(env)) {
      if (!v.startsWith('/')) continue; // non-path values (e.g. OPENCODE_DISABLE_AUTOUPDATE=1)
      assert.ok(v === '/fx' || v.startsWith('/fx/') || v === profileDir || v.startsWith(`${profileDir}/`),
        `${d.id}: ${k}=${v} escapes fixture/profile`);
      assert.ok(!v.startsWith(homedir()), `${d.id}: ${k}=${v} points at the real home`);
    }
    if (d.id === 'claude-code') {
      // Only claude-code omits HOME — its OAuth token is in the macOS Keychain,
      // reached via the real HOME. (codex auth is file-based, so it relocates HOME.)
      assert.ok(!('HOME' in env), `${d.id} must inherit the real HOME (Keychain access)`);
    }
    if (d.id === 'codex') {
      // Mandatory positive assertion (finding #4): codex MUST relocate HOME into
      // the profile. If a future edit drops HOME, this fails loudly rather than
      // silently re-opening the HOME-derived ~/.agents/skills leak.
      assert.equal(env.HOME, profileDir, `${d.id} must relocate HOME into the profile (finding #4)`);
    }
  }
});
