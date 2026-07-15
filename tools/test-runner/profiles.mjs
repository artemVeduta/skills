// Single source of truth for live-run test profiles (spec: profile-based
// isolation, D1/D7). PURE — path/env computation only, no fs access, so the
// auth helper (tools/test-auth.mjs) and the runner build the profile env
// through the SAME functions and login state lands exactly where the runner
// later looks. Profiles are persistent, pre-authenticated, per-harness config
// roots OUTSIDE the repo and outside fixtures; they hold auth + harness state
// only and are expected to mutate across runs (no integrity guard, D6).
import { homedir } from 'node:os';
import { join } from 'node:path';

// Fixed convention — deliberately no env-var override (D1, YAGNI).
export function profileDirFor(harnessId) {
  return join(homedir(), '.skills-test-profiles', harnessId);
}

// Per-harness env map (capability probes 2026-07-15, spec §5):
// - claude-code: CLAUDE_CONFIG_DIR relocates config; HOME is intentionally NOT
//   set — the OAuth token lives in the macOS Keychain and the real HOME must
//   stay visible for keychain access.
// - codex: CODEX_HOME relocates config.toml, auth.json, sessions. HOME is ALSO
//   relocated into the profile — codex additionally reads a HOME-derived global
//   ~/.agents/skills and ~/.agents/plugins that CODEX_HOME does NOT cover, so
//   without this the developer's real ~/.agents would leak into a live run
//   (live-run finding #4). This is safe here (unlike claude-code): codex auth is
//   file-based under CODEX_HOME (auth.json holds the token, no Keychain), so
//   relocating HOME costs nothing for auth. Scope of the claim: HOME here only
//   confines the HOME-derived ~/.agents leak; CODEX_HOME still wins for
//   config/auth/sessions.
// - opencode: config/data roots derive from HOME/XDG, so HOME plus ALL four
//   XDG roots are confined to the profile; OPENCODE_DISABLE_AUTOUPDATE pins
//   the binary against mid-suite version drift.
export function profileEnvFor(harnessId, profileDir) {
  switch (harnessId) {
    case 'claude-code':
      return { CLAUDE_CONFIG_DIR: profileDir };
    case 'codex':
      return { CODEX_HOME: profileDir, HOME: profileDir };
    case 'opencode':
      return {
        HOME: profileDir,
        XDG_CONFIG_HOME: join(profileDir, 'xdg-config'),
        XDG_DATA_HOME: join(profileDir, 'xdg-data'),
        XDG_CACHE_HOME: join(profileDir, 'xdg-cache'),
        XDG_STATE_HOME: join(profileDir, 'xdg-state'),
        OPENCODE_DISABLE_AUTOUPDATE: '1',
      };
    default:
      throw new Error(`profileEnvFor: unknown harness id: ${harnessId}`);
  }
}

// The file whose EXISTENCE means "this profile is authenticated" (preflight
// rung 3 checks presence only — no inference is spent probing auth).
// claude-code's .claude.json pointer location was pinned by verification V1.
export function authMaterialPath(harnessId, profileDir) {
  switch (harnessId) {
    case 'claude-code':
      return join(profileDir, '.claude.json');
    case 'codex':
      return join(profileDir, 'auth.json');
    case 'opencode':
      return join(profileDir, 'xdg-data', 'opencode', 'auth.json');
    default:
      throw new Error(`authMaterialPath: unknown harness id: ${harnessId}`);
  }
}
