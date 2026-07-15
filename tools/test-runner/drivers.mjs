// Headless-CLI descriptors for the three supported test harnesses. PURE:
// buildInvocation returns the argv + extra env to spawn but never spawns, so
// the invocation shape is unit-testable without inference. The runner
// (runner.mjs) does the impure spawn; cwd is always the fixture root.
import { profileEnvFor } from './profiles.mjs';

// Each descriptor:
//   id               stable harness id
//   command          the headless CLI binary
//   discoverySubdir  where, under a fixture root, this harness discovers project skills
//   defaultModel     pinned per driver against the installed CLIs (2026-07-15);
//                    overridden per run via --harness <id>=<model>
//   probe            driver-owned availability spec: `<command> <probe.args>`
//                    must exit 0; its stdout is the provenance version string.
//                    Driver-owned so a non-CLI-shaped harness (pydantic-ai
//                    follow-up) can declare its own probe.
//   daemonBasename   set only where a resident daemon can hijack the run
//                    (preflight rung 4); opencode's `run` may attach to a
//                    pre-existing server and escape the fixture cwd/env.
//   buildInvocation({ fixtureRoot, prompt, model, profileDir }) -> { command, args, env }
//     env comes from profileEnvFor — the profile is the ONLY user-scope state a
//     live run sees; project scope stays the out-of-repo fixture cwd. Every
//     flag emitted here was verified against the installed CLI's --help
//     (no speculative flags).
export const DRIVERS = [
  {
    id: 'claude-code',
    command: 'claude',
    discoverySubdir: '.claude/skills',
    defaultModel: 'claude-opus-4.8',
    probe: { args: ['--version'] },
    buildInvocation({ fixtureRoot, prompt, model, profileDir }) {
      return {
        command: 'claude',
        // Headless `-p` cannot prompt; without a grant Write/Edit/Bash are all
        // denied. acceptEdits does NOT cover Bash, so bypassPermissions is used.
        // WARNING: bypassPermissions removes write confinement — safe ONLY
        // because the fixture lives outside the repo tree (see runCase) and
        // config writes land in the test profile, not ~/.claude.
        args: ['-p', prompt, '--permission-mode', 'bypassPermissions', '--model', model],
        env: profileEnvFor('claude-code', profileDir),
      };
    },
  },
  {
    id: 'codex',
    command: 'codex',
    discoverySubdir: '.agents/skills', // cwd-relative discovery, pinned by verification V3
    defaultModel: 'gpt-5.6-sol',
    probe: { args: ['--version'] },
    buildInvocation({ fixtureRoot, prompt, model, profileDir }) {
      return {
        command: 'codex',
        // `codex exec` defaults to a read-only sandbox that blocks writes;
        // workspace-write confines writes to cwd (OS-enforced).
        // --skip-git-repo-check: fixtures are non-git os.tmpdir() dirs and
        // `codex exec` refuses to start in a non-git dir without it (finding #2).
        args: ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', '-m', model, prompt],
        // env (CODEX_HOME + HOME) comes from profileEnvFor — HOME is relocated
        // to confine the HOME-derived ~/.agents/skills leak (finding #4).
        env: profileEnvFor('codex', profileDir),
      };
    },
  },
  {
    id: 'opencode',
    command: 'opencode',
    discoverySubdir: '.opencode/skills',
    // provider-prefixed id; opencode-go is the provider authed in the profile
    // (finding #5 — pinned from `opencode models` run under the profile env).
    defaultModel: 'opencode-go/qwen3.7-max',
    probe: { args: ['--version'] },
    daemonBasename: 'opencode',
    buildInvocation({ fixtureRoot, prompt, model, profileDir }) {
      return {
        command: 'opencode',
        // `opencode run` does not auto-approve permissions by default; --auto
        // auto-approves permissions not explicitly denied.
        args: ['run', '--auto', '-m', model, prompt],
        env: profileEnvFor('opencode', profileDir),
      };
    },
  },
];

export function resolveDriver(id) {
  return DRIVERS.find((d) => d.id === id) || null;
}
