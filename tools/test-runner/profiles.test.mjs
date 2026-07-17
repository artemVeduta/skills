import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { profileDirFor, profileEnvFor, authMaterialPath } from './profiles.mjs';

test('profileDirFor is the fixed per-harness convention under the real home', () => {
  assert.equal(profileDirFor('codex'), join(homedir(), '.skills-test-profiles', 'codex'));
  // Pure path computation — any id works (dry-run must not require a registry hit).
  assert.equal(profileDirFor('anything'), join(homedir(), '.skills-test-profiles', 'anything'));
});

test('claude-code env relocates only the config dir and omits HOME (Keychain access)', () => {
  assert.deepEqual(profileEnvFor('claude-code', '/p/claude-code'), {
    CLAUDE_CONFIG_DIR: '/p/claude-code',
  });
});

test('codex env relocates CODEX_HOME AND HOME into the profile — HOME confines the HOME-derived ~/.agents/skills + ~/.agents/plugins leak (finding #4); auth stays file-based under CODEX_HOME', () => {
  // Unlike claude-code, codex auth is file-based under CODEX_HOME (auth.json holds
  // the token — no Keychain dependency), so HOME can be safely relocated into the
  // profile. CODEX_HOME still wins for config/auth/sessions; HOME only exists here
  // to confine the HOME-derived ~/.agents/skills and ~/.agents/plugins discovery.
  assert.deepEqual(profileEnvFor('codex', '/p/codex'), { CODEX_HOME: '/p/codex', HOME: '/p/codex' });
});

test('opencode env confines HOME plus all four XDG roots and disables autoupdate', () => {
  assert.deepEqual(profileEnvFor('opencode', '/p/opencode'), {
    HOME: '/p/opencode',
    XDG_CONFIG_HOME: '/p/opencode/xdg-config',
    XDG_DATA_HOME: '/p/opencode/xdg-data',
    XDG_CACHE_HOME: '/p/opencode/xdg-cache',
    XDG_STATE_HOME: '/p/opencode/xdg-state',
    OPENCODE_DISABLE_AUTOUPDATE: '1',
  });
});

test('authMaterialPath names the per-harness authed marker file', () => {
  assert.equal(authMaterialPath('claude-code', '/p/c'), '/p/c/.claude.json'); // pinned by V1
  assert.equal(authMaterialPath('codex', '/p/x'), '/p/x/auth.json');
  assert.equal(authMaterialPath('opencode', '/p/o'), '/p/o/xdg-data/opencode/auth.json');
});

test('unknown harness ids are loud errors, not silent guesses', () => {
  assert.throws(() => profileEnvFor('nope', '/p'), /unknown harness id: nope/);
  assert.throws(() => authMaterialPath('nope', '/p'), /unknown harness id: nope/);
});
