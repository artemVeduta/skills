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
  assert.deepEqual(inv.args, ['run', '--auto', '-m', 'opencode-go/qwen3.7-max', 'yo']);
  assert.deepEqual(inv.env, {
    HOME: '/prof/opencode',
    XDG_CONFIG_HOME: '/prof/opencode/xdg-config',
    XDG_DATA_HOME: '/prof/opencode/xdg-data',
    XDG_CACHE_HOME: '/prof/opencode/xdg-cache',
    XDG_STATE_HOME: '/prof/opencode/xdg-state',
    OPENCODE_DISABLE_AUTOUPDATE: '1',
  });
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
