// Deterministic oracle: pass/fail derives ONLY from deterministic state
// assertions (filesystem + structured-output containment). Advisory signal
// (skill-selection evidence, judge scores) is NEVER evaluated here — that is a
// hard rule of the testing architecture.
import { join, resolve } from 'node:path';
import { readdir } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { spawnSync } from 'node:child_process';
import { checkPortableContract, readIf } from './static-contract.mjs';

// ctx: { workdir, repoRoot, output, baselineSha, skillsSubdir }. baselineSha is
// the fixture's recorded baseline commit (buildFixture); skillsSubdir is the
// EXECUTING driver's discovery subdir, so a shared portable-contract assertion
// targets the right projected pack on every leg. Returns one
// { assertion, pass, detail } per assertion, in order.
export async function evaluateAssertions(assertions, ctx) {
  const results = [];
  for (const a of assertions) {
    results.push({ assertion: a, ...(await evaluateOne(a, ctx)) });
  }
  return results;
}

async function evaluateOne(a, { workdir, repoRoot, output, baselineSha, skillsSubdir }) {
  switch (a.type) {
    case 'file-exists': {
      const c = await readIf(join(workdir, a.path));
      return { pass: c !== null, detail: c !== null ? '' : `missing ${a.path}` };
    }
    case 'file-absent': {
      const c = await readIf(join(workdir, a.path));
      return { pass: c === null, detail: c === null ? '' : `unexpected ${a.path}` };
    }
    case 'file-contains': {
      const c = await readIf(join(workdir, a.path));
      const pass = c !== null && c.includes(a.value);
      return { pass, detail: pass ? '' : `${a.path} does not contain ${JSON.stringify(a.value)}` };
    }
    case 'file-not-contains': {
      const c = await readIf(join(workdir, a.path));
      const pass = c !== null && !c.includes(a.value);
      return { pass, detail: pass ? '' : `${a.path} still contains ${JSON.stringify(a.value)}` };
    }
    case 'file-contains-ordered': {
      // Ordered containment: every value present, and every occurrence of
      // values[i] precedes the first occurrence of values[i+1] — e.g. all
      // "ERROR: " lines before any "WARNING: " line in a report.
      const c = await readIf(join(workdir, a.path));
      if (c === null) return { pass: false, detail: `missing ${a.path}` };
      for (const value of a.values) {
        if (!c.includes(value)) {
          return { pass: false, detail: `${a.path} does not contain ${JSON.stringify(value)}` };
        }
      }
      for (let i = 0; i < a.values.length - 1; i++) {
        if (c.lastIndexOf(a.values[i]) > c.indexOf(a.values[i + 1])) {
          return {
            pass: false,
            detail: `${a.path} has ${JSON.stringify(a.values[i])} after ${JSON.stringify(a.values[i + 1])}`,
          };
        }
      }
      return { pass: true, detail: '' };
    }
    case 'file-occurrences': {
      // Exact multiplicity of a marker in a file — the proof that a managed
      // block was installed EXACTLY ONCE. `file-contains` cannot see a
      // duplicate: a hook carrying the marked validation block twice contains
      // it just as much as one carrying it once, so "appended once, never
      // duplicated" needs a count.
      const c = await readIf(join(workdir, a.path));
      if (c === null) return { pass: false, detail: `missing ${a.path}` };
      if (typeof a.value !== 'string' || a.value === '' || !Number.isInteger(a.count) || a.count < 0) {
        return { pass: false, detail: 'file-occurrences requires a non-empty value and a non-negative integer count' };
      }
      const actual = c.split(a.value).length - 1;
      const pass = actual === a.count;
      return {
        pass,
        detail: pass ? '' : `${a.path} contains ${JSON.stringify(a.value)} ${actual} time(s), expected ${a.count}`,
      };
    }
    case 'file-equals': {
      const actual = await readIf(join(workdir, a.path));
      const expected = await readIf(join(repoRoot, a.against));
      const pass = actual !== null && expected !== null && actual === expected;
      return { pass, detail: pass ? '' : `${a.path} not byte-identical to ${a.against}` };
    }
    case 'output-contains': {
      const pass = typeof output === 'string' && output.includes(a.value);
      return { pass, detail: pass ? '' : `output does not contain ${JSON.stringify(a.value)}` };
    }
    case 'trace-field':
    case 'trace-every':
    case 'trace-disjoint':
    case 'trace-round-search-cap':
    case 'trace-fetch-within-cap':
      return evaluateTrace(a, output);
    case 'git-unchanged':
      return evaluateGitUnchanged(workdir, baselineSha);
    case 'git-uncommitted':
      return evaluateGitUncommitted(workdir, baselineSha);
    case 'git-only-paths':
      return evaluateGitOnlyPaths(workdir, baselineSha, a.paths);
    case 'file-unchanged':
      return evaluateFileUnchanged(workdir, baselineSha, a.path);
    case 'git-hooks-untouched':
      return evaluateGitHooksUntouched(workdir);
    case 'portable-contract': {
      // Static shared-reader contract over the projected pack in the fixture
      // (skill metadata, relative support references, project-memory routing,
      // instruction-chain budget) — see static-contract.mjs. The subdir to
      // check defaults to the EXECUTING driver's discovery subdir (from ctx),
      // so one shared assertion targets .claude/skills on the claude-code leg,
      // .agents/skills on codex, .opencode/skills on opencode; a case may
      // still pin an explicit subdir.
      const { errors } = await checkPortableContract(workdir, {
        skillsSubdir: a.skillsSubdir ?? skillsSubdir,
        workdirRel: a.workdirRel,
      });
      return { pass: errors.length === 0, detail: errors.join('; ') };
    }
    default:
      return { pass: false, detail: `unknown assertion type: ${a.type}` };
  }
}

// --- git-unchanged (v2 acceptance seam) ---
// Proves the fixture sits EXACTLY at its baseline commit: an empty
// `git status --porcelain --ignored` (no modified, staged, untracked, OR
// gitignored paths — a denied plan that writes only ignored paths must still
// fail) AND `git rev-parse HEAD` equal to the baseline sha recorded when
// buildFixture created the commit. Equality-with-baseline, not
// shape-of-history: a rewritten history (`commit --amend`, orphan re-init)
// that presents one clean commit with CHANGED content has a different sha and
// fails. A non-git workdir or a missing recorded baseline FAILS rather than
// passing vacuously.

function evaluateGitUnchanged(workdir, baselineSha) {
  const status = spawnSync('git', ['status', '--porcelain', '--ignored'], { cwd: workdir, encoding: 'utf8' });
  if (status.status !== 0) {
    return { pass: false, detail: `git status failed in workdir: ${(status.stderr || '').trim() || 'not a git repository'}` };
  }
  const dirty = status.stdout.trim();
  if (dirty !== '') {
    return { pass: false, detail: `working tree or index changed:\n${dirty}` };
  }
  if (!baselineSha) {
    return { pass: false, detail: 'no baseline commit sha recorded for this fixture — cannot prove Git state unchanged' };
  }
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: workdir, encoding: 'utf8' });
  if (head.status !== 0) {
    return { pass: false, detail: `git rev-parse failed in workdir: ${(head.stderr || '').trim()}` };
  }
  const headSha = head.stdout.trim();
  if (headSha !== baselineSha) {
    return { pass: false, detail: `history moved off the fixture baseline commit: HEAD is ${headSha}, baseline was ${baselineSha}` };
  }
  return { pass: true, detail: '' };
}

// --- git-uncommitted (v2 acceptance seam) ---
// The WRITE-path counterpart to git-unchanged. A successful fresh install
// LEGITIMATELY dirties the working tree (new and edited files), so a fully
// clean tree cannot be required here — git-unchanged would reject the very
// outcome we want. This proves the install left Git *otherwise* untouched, i.e.
// AC8 "leaves staging, commits, remotes, and pull requests unchanged" on the
// path that actually writes: HEAD still equals the baseline commit (no commit
// was made), the index has NOTHING staged (`git diff --cached --quiet`), and no
// remote was added (the fixture baseline has none, so "unchanged" == still
// none — a PR is impossible without a remote). Untracked/modified working-tree
// files are allowed and expected; only staging/commits/remotes are forbidden. A
// non-git workdir or a missing recorded baseline FAILS rather than passing
// vacuously, exactly like git-unchanged.

function evaluateGitUncommitted(workdir, baselineSha) {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: workdir, encoding: 'utf8' });
  if (head.status !== 0) {
    return { pass: false, detail: `git rev-parse failed in workdir: ${(head.stderr || '').trim() || 'not a git repository'}` };
  }
  if (!baselineSha) {
    return { pass: false, detail: 'no baseline commit sha recorded for this fixture — cannot prove Git state unchanged' };
  }
  const headSha = head.stdout.trim();
  if (headSha !== baselineSha) {
    return { pass: false, detail: `a commit was made past the baseline: HEAD is ${headSha}, baseline was ${baselineSha}` };
  }
  const staged = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: workdir, encoding: 'utf8' });
  if (staged.status === 1) {
    return { pass: false, detail: 'changes are staged in the index (git diff --cached is non-empty)' };
  }
  if (staged.status !== 0) {
    return { pass: false, detail: `git diff --cached failed in workdir: ${(staged.stderr || '').trim()}` };
  }
  const remotes = spawnSync('git', ['remote'], { cwd: workdir, encoding: 'utf8' });
  if (remotes.status !== 0) {
    return { pass: false, detail: `git remote failed in workdir: ${(remotes.stderr || '').trim()}` };
  }
  if (remotes.stdout.trim() !== '') {
    return { pass: false, detail: `a remote was added: ${remotes.stdout.trim().split('\n').join(', ')}` };
  }
  return { pass: true, detail: '' };
}

// --- git-only-paths (v2 #59 seam) ---
// Proves the run changed EXACTLY the intended working-tree paths relative to the
// baseline commit — nothing more, nothing less. A robust negative for "this mode
// leaves everything else untouched" that a substring/slug proxy cannot give: a
// stray write under ANY other name is caught. Uses
// `git status --porcelain --ignored -uall` (`-uall` expands untracked
// directories to individual files, so a brand-new `research/` dir does not
// collapse to one entry) and requires the set of changed paths to equal a.paths
// exactly. A non-git workdir, a missing baseline, or a non-array `paths` FAILS
// rather than passing vacuously.
function evaluateGitOnlyPaths(workdir, baselineSha, expected) {
  if (!Array.isArray(expected)) {
    return { pass: false, detail: 'git-only-paths requires a paths array' };
  }
  if (!baselineSha) {
    return { pass: false, detail: 'no baseline commit sha recorded for this fixture — cannot prove which paths changed' };
  }
  const status = spawnSync('git', ['status', '--porcelain', '--ignored', '-uall'], { cwd: workdir, encoding: 'utf8' });
  if (status.status !== 0) {
    return { pass: false, detail: `git status failed in workdir: ${(status.stderr || '').trim() || 'not a git repository'}` };
  }
  // Each porcelain v1 line is "XY <path>" (status columns 0-1, path from column 3);
  // a rename is "XY <old> -> <new>" — take the final path.
  const changed = status.stdout
    .split('\n')
    .filter((l) => l.length > 3)
    .map((l) => {
      const p = l.slice(3);
      const arrow = p.indexOf(' -> ');
      return arrow === -1 ? p : p.slice(arrow + 4);
    });
  const changedSet = new Set(changed);
  const expectedSet = new Set(expected);
  const extra = [...changedSet].filter((p) => !expectedSet.has(p));
  const missing = [...expectedSet].filter((p) => !changedSet.has(p));
  if (extra.length > 0 || missing.length > 0) {
    const parts = [];
    if (extra.length) parts.push(`unexpected changes: ${extra.join(', ')}`);
    if (missing.length) parts.push(`expected changes absent: ${missing.join(', ')}`);
    return { pass: false, detail: parts.join('; ') };
  }
  return { pass: true, detail: '' };
}

// --- file-unchanged (v2 #59 seam) ---
// Proves a SPECIFIC tracked file is byte-identical to its content at the baseline
// commit — a robust negative for "this mode left file X untouched" that catches a
// stray write under ANY slug or verb, unlike a substring proxy. Reads the
// baseline blob with `git show <baseline>:<path>` (no need to thread baseline
// bytes through repoRoot) and compares it to the current working-tree file. A
// non-git workdir, a missing baseline, a path absent at baseline, or a now-missing
// working-tree file FAILS rather than passing vacuously.
async function evaluateFileUnchanged(workdir, baselineSha, path) {
  if (typeof path !== 'string' || path === '') {
    return { pass: false, detail: 'file-unchanged requires a path' };
  }
  if (!baselineSha) {
    return { pass: false, detail: 'no baseline commit sha recorded for this fixture — cannot prove the file is unchanged' };
  }
  const base = spawnSync('git', ['show', `${baselineSha}:${path}`], { cwd: workdir, encoding: 'utf8' });
  if (base.status !== 0) {
    return {
      pass: false,
      detail: `git show ${baselineSha}:${path} failed: ${(base.stderr || '').trim() || 'path absent at baseline or not a git repository'}`,
    };
  }
  const current = await readIf(join(workdir, path));
  if (current === null) {
    return { pass: false, detail: `file-unchanged: ${path} is missing in the working tree` };
  }
  const pass = current === base.stdout;
  return { pass, detail: pass ? '' : `${path} differs from its baseline content` };
}

// --- git-hooks-untouched (#65 enforcement seam) ---
// Proves a run installed NO NATIVE-Git push enforcement: the repository's
// configured hooks path is still unset, and `.git/hooks/` still carries only
// git's own `*.sample` templates.
//
// This is the one half of docs-setup's "never change native `.git/hooks/*` or
// the configured hooks path" rule that no other assertion can see. `.git/` lives
// OUTSIDE the working tree and `core.hooksPath` is repository CONFIG, so a run
// that quietly wrote `.git/hooks/pre-push` — or repointed `core.hooksPath` at its
// own directory — leaves `git status` completely clean and passes
// git-unchanged, git-uncommitted, and git-only-paths alike. Enforcement must come
// from the capability the repository already owns (an active Husky hooks
// directory in the working tree), never from native git plumbing.
//
// A non-git workdir or a failing `git config` FAILS rather than passing
// vacuously, exactly like the other git assertions. `--local` is deliberate: a
// developer's global hooksPath is not the run's doing.
async function evaluateGitHooksUntouched(workdir) {
  const cfg = spawnSync('git', ['config', '--local', '--get', 'core.hooksPath'], { cwd: workdir, encoding: 'utf8' });
  // `git config --get` exits 1 when the key is absent — the required state.
  // Exit 0 means the key IS set (a violation); any other status means git could
  // not run here at all, which must fail rather than pass vacuously.
  if (cfg.status === 0) {
    return { pass: false, detail: `the configured hooks path was changed: core.hooksPath is ${cfg.stdout.trim()}` };
  }
  if (cfg.status !== 1) {
    return {
      pass: false,
      detail: `git config --local --get core.hooksPath failed in workdir: ${(cfg.stderr || '').trim() || 'not a git repository'}`,
    };
  }
  const gitDir = spawnSync('git', ['rev-parse', '--git-dir'], { cwd: workdir, encoding: 'utf8' });
  if (gitDir.status !== 0) {
    return { pass: false, detail: `git rev-parse --git-dir failed in workdir: ${(gitDir.stderr || '').trim() || 'not a git repository'}` };
  }
  const hooksDir = resolve(workdir, gitDir.stdout.trim(), 'hooks');
  let entries;
  try {
    entries = await readdir(hooksDir);
  } catch (err) {
    // No hooks directory at all is the strongest possible form of untouched.
    if (err.code === 'ENOENT') return { pass: true, detail: '' };
    return { pass: false, detail: `could not read ${hooksDir}: ${err.message}` };
  }
  const written = entries.filter((e) => !e.endsWith('.sample')).sort();
  if (written.length > 0) {
    return { pass: false, detail: `native Git hooks were written: ${written.join(', ')}` };
  }
  return { pass: true, detail: '' };
}

// --- execution-trace assertions (v2 acceptance seam) ---
// The harness report carries a machine-readable fenced ```execution-trace
// block (spec: the cross-harness observable contract for fanout workflows).
// The LAST block wins: a run may emit partial traces before its final report.

export function extractExecutionTrace(output) {
  if (typeof output !== 'string') return { trace: null, error: 'no execution-trace block in output' };
  const blocks = [...output.matchAll(/```execution-trace\s*\n([\s\S]*?)```/g)];
  if (blocks.length === 0) return { trace: null, error: 'no execution-trace block in output' };
  try {
    return { trace: JSON.parse(blocks[blocks.length - 1][1]), error: null };
  } catch (err) {
    return { trace: null, error: `unparseable execution-trace block: ${err.message}` };
  }
}

// Dot-path resolution into the parsed trace; numeric segments index arrays.
// Missing segments resolve to `undefined` (assertions on them fail).
function traceGet(trace, path) {
  let node = trace;
  for (const seg of path.split('.')) {
    if (node == null) return undefined;
    node = node[seg];
  }
  return node;
}

function evaluateTrace(a, output) {
  const { trace, error } = extractExecutionTrace(output);
  if (error) return { pass: false, detail: error };
  switch (a.type) {
    case 'trace-field': {
      const actual = traceGet(trace, a.path);
      const pass = actual !== undefined && isDeepStrictEqual(actual, a.equals);
      return { pass, detail: pass ? '' : `trace ${a.path} is ${JSON.stringify(actual)}, expected ${JSON.stringify(a.equals)}` };
    }
    case 'trace-every': {
      const arr = traceGet(trace, a.path);
      if (!Array.isArray(arr)) return { pass: false, detail: `trace ${a.path} is not an array` };
      for (let i = 0; i < arr.length; i++) {
        if (!isDeepStrictEqual(arr[i]?.[a.field], a.equals)) {
          return { pass: false, detail: `trace ${a.path}[${i}].${a.field} is ${JSON.stringify(arr[i]?.[a.field])}, expected ${JSON.stringify(a.equals)}` };
        }
      }
      return { pass: true, detail: '' };
    }
    case 'trace-disjoint': {
      // Ownership check: every element's `field` array must be pairwise
      // disjoint (e.g. domain workers own disjoint concept files).
      const arr = traceGet(trace, a.path);
      if (!Array.isArray(arr)) return { pass: false, detail: `trace ${a.path} is not an array` };
      const seen = new Map();
      for (let i = 0; i < arr.length; i++) {
        for (const item of arr[i]?.[a.field] ?? []) {
          if (seen.has(item)) {
            return { pass: false, detail: `trace ${a.path}[${seen.get(item)}] and ${a.path}[${i}] both own ${JSON.stringify(item)}` };
          }
          seen.set(item, i);
        }
      }
      return { pass: true, detail: '' };
    }
    case 'trace-round-search-cap': {
      // Round-budget check (spec §Fanout and budgets): every round at or past
      // `fromRound` (rounds 2 and 3) may run at most `max` targeted searches in
      // total. Sum each such round's workers' searchCount and fail if it exceeds
      // the limit — a real comparison, so a six-search round-2 fails loudly.
      const rounds = traceGet(trace, 'rounds');
      if (!Array.isArray(rounds)) return { pass: false, detail: 'trace rounds is not an array' };
      const from = a.fromRound ?? 2;
      const max = a.max ?? 5;
      for (const r of rounds) {
        if (typeof r?.round !== 'number' || r.round < from) continue;
        const workers = Array.isArray(r.workers) ? r.workers : [];
        const total = workers.reduce((sum, w) => sum + (Number(w?.searchCount) || 0), 0);
        if (total > max) {
          return { pass: false, detail: `round ${r.round} ran ${total} targeted searches, exceeding the limit of ${max}` };
        }
      }
      return { pass: true, detail: '' };
    }
    case 'trace-fetch-within-cap': {
      // Fetch-cap invariant (spec §Fanout and budgets): a run never fetches past
      // its own cap, the cap itself never exceeds the hard ceiling (45), and any
      // cap above the normal cap (20) must be flagged as an approved one-run
      // raise. Both the 20 default and an approved 45 run satisfy it; a run that
      // overran its cap, raised the cap past the ceiling, or raised it above the
      // normal cap without approval fails.
      //
      // The ceiling (45) and normal cap (20) are CHECKER-OWNED constants, NEVER
      // read from the trace under test — mirror trace-round-search-cap's `a.max ??
      // 5`. Reading `fetch.ceiling` from the trace would make the bound
      // self-satisfiable (a run reporting {cap:50, ceiling:50} would pass).
      // Repository policy may only LOWER the normal cap, so any cap above 20 is by
      // definition a one-run approved raise. Both are overridable per-assertion for
      // future-proofing, but default to the spec's fixed values.
      const fetch = traceGet(trace, 'fetch');
      if (fetch == null || typeof fetch !== 'object') {
        return { pass: false, detail: 'trace has no fetch accounting block' };
      }
      const { cap, attempts, raisedByApproval } = fetch;
      if (typeof cap !== 'number' || typeof attempts !== 'number') {
        return { pass: false, detail: 'trace fetch block must carry numeric cap and attempts' };
      }
      const ceiling = a.ceiling ?? 45;
      const normalCap = a.normalCap ?? 20;
      if (attempts > cap) {
        return { pass: false, detail: `fetch attempts ${attempts} exceed the run cap ${cap}` };
      }
      if (cap > ceiling) {
        return { pass: false, detail: `run cap ${cap} exceeds the hard ceiling ${ceiling}` };
      }
      if (cap > normalCap && raisedByApproval !== true) {
        return {
          pass: false,
          detail: `run cap ${cap} exceeds the normal cap ${normalCap} without an approved one-run raise (fetch.raisedByApproval is ${JSON.stringify(raisedByApproval)})`,
        };
      }
      return { pass: true, detail: '' };
    }
  }
}

export function allPassed(results) {
  return results.every((r) => r.pass);
}
