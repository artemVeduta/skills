// Headless-CLI descriptors for the three supported test harnesses. PURE:
// buildInvocation returns the argv + extra env to spawn but never spawns, so
// the invocation shape is unit-testable without inference. The runner
// (runner.mjs) does the impure spawn; cwd is always the fixture root.
import { join } from 'node:path';

// Each descriptor:
//   id               stable harness id
//   command          the headless CLI binary (also used for availability probing)
//   discoverySubdir  where, under a fixture root, this harness discovers project skills
//   buildInvocation({ fixtureRoot, prompt }) -> { command, args, env }
//     env: extra vars merged over process.env by the runner.
// One shared isolation env for every harness: point HOME + all XDG roots at
// per-fixture dirs so no host-scoped config/cache/state leaks in. Each harness
// adds its own extra var. NOTE: emptying HOME strips file-based credentials, so
// file/OAuth-authenticated CLIs must rely on an API key exported into
// process.env (merged through by runDriver) — see Task 8 Step 10. XDG-isolation
// source: docs/references/agent-skill-testing-landscape.md:122.
function isolationEnv(fixtureRoot) {
  return {
    HOME: join(fixtureRoot, '.home'),
    XDG_CONFIG_HOME: join(fixtureRoot, '.config'),
    XDG_DATA_HOME: join(fixtureRoot, '.data'),
    XDG_CACHE_HOME: join(fixtureRoot, '.cache'),
    XDG_STATE_HOME: join(fixtureRoot, '.state'),
  };
}

// buildInvocation returns the documented bare command per harness
// (`claude -p`, `codex exec`, `opencode run`) PLUS a VERIFIED per-harness
// tool-permission grant (a precondition — headless runs cannot prompt, so with
// no grant every write is DENIED and all filesystem assertions fail) PLUS the
// isolation env. It still excludes speculative output-format / project-dir
// flags. Grants verified against each installed CLI's --help. Discovery subdirs
// for codex/opencode are best-guesses (the install REGISTRY flags Codex's path
// as unverified and does not model OpenCode; the reference names a different
// `.agents/skills` path for codex) — confirm at Task 8 Step 10.
export const DRIVERS = [
  {
    id: 'claude-code',
    command: 'claude',
    discoverySubdir: '.claude/skills',
    buildInvocation({ fixtureRoot, prompt }) {
      return {
        command: 'claude',
        // Headless `-p` cannot prompt; without a grant Write/Edit/Bash are all
        // denied. acceptEdits does NOT cover Bash, so bypassPermissions is used.
        // WARNING: bypassPermissions removes write confinement — safe ONLY
        // because the fixture lives outside the repo tree (see runCase).
        args: ['-p', prompt, '--permission-mode', 'bypassPermissions'],
        env: { ...isolationEnv(fixtureRoot), CLAUDE_CONFIG_DIR: join(fixtureRoot, '.claude-config') },
      };
    },
  },
  {
    id: 'codex',
    command: 'codex',
    discoverySubdir: '.codex/skills',
    buildInvocation({ fixtureRoot, prompt }) {
      return {
        command: 'codex',
        // `codex exec` defaults to a read-only sandbox that blocks writes;
        // workspace-write confines writes to cwd (safe regardless of location).
        // NB: `--full-auto` is NOT an exec flag in 0.139.0.
        args: ['exec', '--sandbox', 'workspace-write', prompt],
        // CODEX_HOME=<fixtureRoot>/.codex → discovery at $CODEX_HOME/skills.
        env: { ...isolationEnv(fixtureRoot), CODEX_HOME: join(fixtureRoot, '.codex') },
      };
    },
  },
  {
    id: 'opencode',
    command: 'opencode',
    discoverySubdir: '.opencode/skills',
    buildInvocation({ fixtureRoot, prompt }) {
      return {
        command: 'opencode',
        // `opencode run` does not auto-approve permissions by default; --auto
        // auto-approves permissions not explicitly denied.
        args: ['run', '--auto', prompt],
        env: { ...isolationEnv(fixtureRoot) },
      };
    },
  },
];

export function resolveDriver(id) {
  return DRIVERS.find((d) => d.id === id) || null;
}
