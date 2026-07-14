// Impure driver execution: availability probing + the headless spawn. runDriver
// is the ONLY inference boundary in the runner — it is never invoked by
// `npm test`/CI, only by the local test-runner CLI's end-to-end path.
import { spawnSync } from 'node:child_process';

// True iff the harness binary responds to `<command> --version` with exit 0.
export function isHarnessAvailable(command) {
  try {
    const r = spawnSync(command, ['--version'], { encoding: 'utf8' });
    return r.status === 0;
  } catch {
    return false;
  }
}

// Spawn the harness against its disposable fixture. cwd is the fixture root —
// built under os.tmpdir(), OUTSIDE the repo (see runCase) — so project-scope
// skill discovery (.claude/skills, .codex/skills, .opencode/skills) resolves to
// the fixture ONLY and the cwd-upward walk cannot reach this repo's own
// CLAUDE.md/AGENTS.md/.claude/skills. Bound the run so a hung CLI (a prompt
// awaiting approval, a stalled model) cannot block the runner forever; override
// via TEST_RUNNER_TIMEOUT_MS. On timeout or maxBuffer overflow spawnSync sets
// status=null and populates r.error — capture it so the caller can emit an
// explicit harness-level diagnostic instead of a bare content FAIL.
const DEFAULT_TIMEOUT_MS = 600_000;

export function runDriver(driver, { fixtureRoot, prompt, timeoutMs }) {
  const { command, args, env } = driver.buildInvocation({ fixtureRoot, prompt });
  const limit = timeoutMs ?? (Number(process.env.TEST_RUNNER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  const r = spawnSync(command, args, {
    cwd: fixtureRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
    timeout: limit,
    killSignal: 'SIGKILL',
  });
  const timedOut = r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGKILL';
  return {
    status: r.status,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    error: r.error ? r.error.message : null,
    timedOut,
  };
}
