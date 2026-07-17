// Impure driver execution: availability probing + the headless spawn. runDriver
// is the ONLY inference boundary in the runner — it is never invoked by
// `npm test`/CI, only by the local test-runner CLI's end-to-end path.
import { spawnSync } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { userInfo } from 'node:os';
import { basename } from 'node:path';
import { authMaterialPath } from './profiles.mjs';

// Driver-owned availability probe: `<command> <probe.args>` must exit 0. Its
// trimmed stdout is captured as the harness VERSION STRING for provenance —
// a verdict without model+version provenance is not attributable (spec goal 3;
// motivated by an observed mid-investigation opencode auto-update).
export function probeHarness(driver) {
  try {
    const r = spawnSync(driver.command, driver.probe.args, { encoding: 'utf8' });
    if (r.status !== 0) return { ok: false, version: null };
    return { ok: true, version: (r.stdout ?? '').trim() };
  } catch {
    return { ok: false, version: null };
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

export function runDriver(driver, { fixtureRoot, prompt, model, profileDir, timeoutMs }) {
  const { command, args, env } = driver.buildInvocation({ fixtureRoot, prompt, model, profileDir });
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

// --- Preflight ladder (spec §7): problems detectable BEFORE execution map to
// an actionable skip, never a silent failure. Stops at the first failing rung.
// Auth failures that only surface DURING execution (e.g. an expired token
// behind an existing auth.json) are consciously NOT detected here — they
// execute and are judged by the oracle like any run (spec D5).

async function isDirectoryDefault(p) {
  try { return (await stat(p)).isDirectory(); } catch { return false; }
}

async function fileExistsDefault(p) {
  try { return (await stat(p)).isFile(); } catch { return false; }
}

// Basenames of every process owned by the current user. `ps -axo user=,comm=`
// works on both macOS and Linux; comm is the executable path, so a daemon
// started via any argv[0] alias is still seen.
function listProcessesDefault() {
  const me = userInfo().username;
  const r = spawnSync('ps', ['-axo', 'user=,comm='], { encoding: 'utf8' });
  if (r.status !== 0) return [];
  return r.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cut = line.indexOf(' ');
      return [line.slice(0, cut), line.slice(cut + 1).trim()];
    })
    .filter(([user]) => user === me)
    .map(([, comm]) => basename(comm));
}

// Rungs: 1 binary → 2 profile dir → 3 auth material → 4 daemon (only for
// drivers that declare daemonBasename — a resident opencode server can serve
// `run` in ITS project context, bypassing the client's cwd/env entirely).
// `version` is threaded out so the caller records provenance even for skips.
export async function preflightHarness(driver, profileDir, deps = {}) {
  const {
    probe = probeHarness,
    isDirectory = isDirectoryDefault,
    fileExists = fileExistsDefault,
    listProcesses = listProcessesDefault,
  } = deps;

  const probed = probe(driver);
  if (!probed.ok) {
    return { skipReason: `harness binary \`${driver.command}\` not found — install \`${driver.id}\` or fix PATH`, version: null };
  }
  if (!(await isDirectory(profileDir))) {
    return { skipReason: `no test profile — run \`npm run test:auth -- ${driver.id}\``, version: probed.version };
  }
  if (!(await fileExists(authMaterialPath(driver.id, profileDir)))) {
    return { skipReason: `profile exists but is not authenticated — run \`npm run test:auth -- ${driver.id}\``, version: probed.version };
  }
  if (driver.daemonBasename && listProcesses().includes(driver.daemonBasename)) {
    return { skipReason: 'kill the running opencode server first — `run` may attach to it and escape the fixture', version: probed.version };
  }
  return { skipReason: null, version: probed.version };
}
