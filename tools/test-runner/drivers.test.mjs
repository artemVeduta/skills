import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRIVERS, resolveDriver } from './drivers.mjs';

test('exactly the three supported harnesses are registered', () => {
  assert.deepEqual(
    DRIVERS.map((d) => d.id).sort(),
    ['claude-code', 'codex', 'opencode'],
  );
});

test('each driver declares its discovery subdir', () => {
  assert.equal(resolveDriver('claude-code').discoverySubdir, '.claude/skills');
  assert.equal(resolveDriver('codex').discoverySubdir, '.codex/skills');
  assert.equal(resolveDriver('opencode').discoverySubdir, '.opencode/skills');
});

test('resolveDriver returns null for an unknown id', () => {
  assert.equal(resolveDriver('nope'), null);
});

test('claude-code invocation grants headless write permission and isolates HOME/config', () => {
  const inv = resolveDriver('claude-code').buildInvocation({ fixtureRoot: '/fx', prompt: 'hello' });
  assert.equal(inv.command, 'claude');
  assert.deepEqual(inv.args, ['-p', 'hello', '--permission-mode', 'bypassPermissions']);
  assert.equal(inv.env.CLAUDE_CONFIG_DIR, '/fx/.claude-config');
  assert.equal(inv.env.HOME, '/fx/.home');
});

test('codex invocation enables workspace-write and isolates HOME and CODEX_HOME', () => {
  const inv = resolveDriver('codex').buildInvocation({ fixtureRoot: '/fx', prompt: 'hi' });
  assert.equal(inv.command, 'codex');
  assert.deepEqual(inv.args, ['exec', '--sandbox', 'workspace-write', 'hi']);
  assert.equal(inv.env.HOME, '/fx/.home');
  assert.equal(inv.env.CODEX_HOME, '/fx/.codex');
});

test('opencode invocation auto-approves permissions and isolates HOME', () => {
  const inv = resolveDriver('opencode').buildInvocation({ fixtureRoot: '/fx', prompt: 'yo' });
  assert.equal(inv.command, 'opencode');
  assert.deepEqual(inv.args, ['run', '--auto', 'yo']);
  assert.equal(inv.env.HOME, '/fx/.home');
});

test('every driver env value is scoped to the fixture root (no host path escapes)', () => {
  for (const d of DRIVERS) {
    const { env } = d.buildInvocation({ fixtureRoot: '/fx', prompt: 'x' });
    for (const v of Object.values(env)) {
      assert.ok(v.startsWith('/fx'), `${d.id}: ${v} escapes fixture`);
    }
  }
});
