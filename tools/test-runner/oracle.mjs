// Deterministic oracle: pass/fail derives ONLY from deterministic state
// assertions (filesystem + structured-output containment). Advisory signal
// (skill-selection evidence, judge scores) is NEVER evaluated here — that is a
// hard rule of the testing architecture.
import { join } from 'node:path';
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
      // its own cap, and the cap itself never exceeds the hard ceiling (45). Both
      // the 20 default and an approved 45 run satisfy it; only a run that overran
      // its cap, or raised the cap past the ceiling, fails.
      const fetch = traceGet(trace, 'fetch');
      if (fetch == null || typeof fetch !== 'object') {
        return { pass: false, detail: 'trace has no fetch accounting block' };
      }
      const { cap, ceiling, attempts } = fetch;
      if (typeof cap !== 'number' || typeof attempts !== 'number') {
        return { pass: false, detail: 'trace fetch block must carry numeric cap and attempts' };
      }
      if (attempts > cap) {
        return { pass: false, detail: `fetch attempts ${attempts} exceed the run cap ${cap}` };
      }
      if (typeof ceiling === 'number' && cap > ceiling) {
        return { pass: false, detail: `run cap ${cap} exceeds the hard ceiling ${ceiling}` };
      }
      return { pass: true, detail: '' };
    }
  }
}

export function allPassed(results) {
  return results.every((r) => r.pass);
}
