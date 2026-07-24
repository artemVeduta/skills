import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateAssertions, allPassed } from './oracle.mjs';

async function withDirs(fn) {
  const workdir = await mkdtemp(join(tmpdir(), 'tr-wd-'));
  const repoRoot = await mkdtemp(join(tmpdir(), 'tr-rr-'));
  try {
    return await fn({ workdir, repoRoot });
  } finally {
    await rm(workdir, { recursive: true, force: true });
    await rm(repoRoot, { recursive: true, force: true });
  }
}

test('file-exists / file-absent', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    await writeFile(join(workdir, 'there.txt'), 'x');
    const r = await evaluateAssertions(
      [
        { type: 'file-exists', path: 'there.txt' },
        { type: 'file-exists', path: 'gone.txt' },
        { type: 'file-absent', path: 'gone.txt' },
      ],
      { workdir, repoRoot, output: '' },
    );
    assert.deepEqual(r.map((x) => x.pass), [true, false, true]);
    assert.match(r[1].detail, /missing gone\.txt/);
  });
});

test('file-contains / file-not-contains', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    await writeFile(join(workdir, 'p.json'), '{"scripts":{"docs:validate":"x"}}');
    const r = await evaluateAssertions(
      [
        { type: 'file-contains', path: 'p.json', value: 'docs:validate' },
        { type: 'file-contains', path: 'p.json', value: 'nope' },
        { type: 'file-not-contains', path: 'p.json', value: '<PROJECT>' },
      ],
      { workdir, repoRoot, output: '' },
    );
    assert.deepEqual(r.map((x) => x.pass), [true, false, true]);
  });
});

test('file-contains-ordered pins all-of-earlier-before-first-of-later ordering', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    const at = (content) =>
      writeFile(join(workdir, 'OUTCOME.md'), content).then(() =>
        evaluateAssertions(
          [{ type: 'file-contains-ordered', path: 'OUTCOME.md', values: ['ERROR: ', 'WARNING: '] }],
          { workdir, repoRoot, output: '' },
        ),
      );
    // Errors first, then warnings: pass.
    const ok = await at('ERROR: a\nERROR: b\nWARNING: c\n');
    assert.equal(ok[0].pass, true);
    // Warnings first: fail.
    const swapped = await at('WARNING: c\nERROR: a\n');
    assert.equal(swapped[0].pass, false);
    assert.match(swapped[0].detail, /"ERROR: " after "WARNING: "/);
    // Interleaved (a straggler error after a warning): fail.
    const interleaved = await at('ERROR: a\nWARNING: c\nERROR: b\n');
    assert.equal(interleaved[0].pass, false);
    // A value missing entirely: fail.
    const missing = await at('ERROR: a\n');
    assert.equal(missing[0].pass, false);
    assert.match(missing[0].detail, /does not contain "WARNING: "/);
  });
  // Missing file: fail, not crash.
  await withDirs(async ({ workdir, repoRoot }) => {
    const r = await evaluateAssertions(
      [{ type: 'file-contains-ordered', path: 'nope.md', values: ['a'] }],
      { workdir, repoRoot, output: '' },
    );
    assert.equal(r[0].pass, false);
    assert.match(r[0].detail, /missing nope\.md/);
  });
});

test('file-equals compares workdir path to a repoRoot path byte-for-byte', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    await mkdir(join(repoRoot, 'assets'), { recursive: true });
    await writeFile(join(repoRoot, 'assets/base.mjs'), 'export const x = 1;\n');
    await writeFile(join(workdir, 'copy.mjs'), 'export const x = 1;\n');
    const ok = await evaluateAssertions(
      [{ type: 'file-equals', path: 'copy.mjs', against: 'assets/base.mjs' }],
      { workdir, repoRoot, output: '' },
    );
    assert.equal(ok[0].pass, true);
    await writeFile(join(workdir, 'copy.mjs'), 'export const x = 2;\n');
    const bad = await evaluateAssertions(
      [{ type: 'file-equals', path: 'copy.mjs', against: 'assets/base.mjs' }],
      { workdir, repoRoot, output: '' },
    );
    assert.equal(bad[0].pass, false);
    assert.match(bad[0].detail, /not byte-identical/);
  });
});

// --- git-unchanged (v2 acceptance seam): a denied approval must leave the
// working tree AND Git state exactly at the fixture baseline commit. ---

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

// Mirrors buildFixture's gitInitFixture: baseline commit created AND its sha
// recorded, handed to the callback the way runHarness threads it into ctx.
async function withGitBaseline(fn, { extraFiles = {} } = {}) {
  const workdir = await mkdtemp(join(tmpdir(), 'tr-git-'));
  try {
    await writeFile(join(workdir, 'seed.txt'), 'seed');
    for (const [name, content] of Object.entries(extraFiles)) {
      await writeFile(join(workdir, name), content);
    }
    git(workdir, 'init', '-q');
    git(workdir, 'config', 'user.email', 't@fixture.invalid');
    git(workdir, 'config', 'user.name', 't');
    git(workdir, 'add', '-A');
    git(workdir, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'fixture baseline');
    const baselineSha = git(workdir, 'rev-parse', 'HEAD').trim();
    return await fn(workdir, baselineSha);
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

test('git-unchanged passes on a pristine baseline fixture', async () => {
  await withGitBaseline(async (workdir, baselineSha) => {
    const r = await evaluateAssertions([{ type: 'git-unchanged' }], { workdir, repoRoot: workdir, output: '', baselineSha });
    assert.equal(r[0].pass, true);
  });
});

test('git-unchanged fails when the working tree gained an untracked file', async () => {
  await withGitBaseline(async (workdir, baselineSha) => {
    await writeFile(join(workdir, 'new.txt'), 'x');
    const r = await evaluateAssertions([{ type: 'git-unchanged' }], { workdir, repoRoot: workdir, output: '', baselineSha });
    assert.equal(r[0].pass, false);
    assert.match(r[0].detail, /new\.txt/);
  });
});

test('git-unchanged fails when a tracked file was modified or staged', async () => {
  await withGitBaseline(async (workdir, baselineSha) => {
    await writeFile(join(workdir, 'seed.txt'), 'changed');
    const modified = await evaluateAssertions([{ type: 'git-unchanged' }], { workdir, repoRoot: workdir, output: '', baselineSha });
    assert.equal(modified[0].pass, false);
    git(workdir, 'add', 'seed.txt');
    const staged = await evaluateAssertions([{ type: 'git-unchanged' }], { workdir, repoRoot: workdir, output: '', baselineSha });
    assert.equal(staged[0].pass, false);
  });
});

test('git-unchanged fails when a commit was made past the baseline', async () => {
  await withGitBaseline(async (workdir, baselineSha) => {
    await writeFile(join(workdir, 'seed.txt'), 'changed');
    git(workdir, 'add', '-A');
    git(workdir, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'sneaky');
    const r = await evaluateAssertions([{ type: 'git-unchanged' }], { workdir, repoRoot: workdir, output: '', baselineSha });
    assert.equal(r[0].pass, false);
    assert.match(r[0].detail, /commit/);
  });
});

test('git-unchanged catches an amended baseline (clean tree, single commit, CHANGED content)', async () => {
  await withGitBaseline(async (workdir, baselineSha) => {
    // The creative-misbehavior hole: apply the denied plan, then rewrite the
    // baseline so history LOOKS untouched — clean status, one commit.
    await writeFile(join(workdir, 'seed.txt'), 'applied anyway');
    git(workdir, 'add', '-A');
    git(workdir, '-c', 'commit.gpgsign=false', 'commit', '-q', '--amend', '-m', 'fixture baseline');
    assert.equal(git(workdir, 'status', '--porcelain'), '');
    assert.equal(git(workdir, 'rev-list', '--count', 'HEAD').trim(), '1');
    const r = await evaluateAssertions([{ type: 'git-unchanged' }], { workdir, repoRoot: workdir, output: '', baselineSha });
    assert.equal(r[0].pass, false);
    assert.match(r[0].detail, /baseline/);
  });
});

test('git-unchanged catches a write to a gitignored path (no gitignore blind spot)', async () => {
  // Baseline commits a .gitignore; a denied plan writing only ignored paths
  // (cache/output dirs) must still fail the unchanged proof.
  await withGitBaseline(async (workdir, baselineSha) => {
    await writeFile(join(workdir, 'ignored.txt'), 'x');
    const r = await evaluateAssertions([{ type: 'git-unchanged' }], { workdir, repoRoot: workdir, output: '', baselineSha });
    assert.equal(r[0].pass, false);
    assert.match(r[0].detail, /ignored\.txt/);
  }, { extraFiles: { '.gitignore': 'ignored.txt\n' } });
});

test('git-unchanged fails without a recorded baseline sha instead of passing vacuously', async () => {
  await withGitBaseline(async (workdir) => {
    const r = await evaluateAssertions([{ type: 'git-unchanged' }], { workdir, repoRoot: workdir, output: '' });
    assert.equal(r[0].pass, false);
    assert.match(r[0].detail, /no baseline commit sha/);
  });
});

test('git-unchanged fails on a non-git workdir instead of passing vacuously', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    const r = await evaluateAssertions([{ type: 'git-unchanged' }], { workdir, repoRoot, output: '', baselineSha: 'deadbeef' });
    assert.equal(r[0].pass, false);
  });
});

// --- git-uncommitted (v2 acceptance seam): the WRITE-path guarantee. A
// successful install dirties the tree, so this permits untracked/modified files
// while still proving nothing was staged, committed, or pushed to a remote. ---

test('git-uncommitted passes on a dirtied tree with nothing staged, no commit, no remote', async () => {
  await withGitBaseline(async (workdir, baselineSha) => {
    // Simulate a successful fresh install: a new untracked file AND an edit to
    // a tracked baseline file, but no `git add`, commit, or remote.
    await writeFile(join(workdir, 'scripts-validate-docs.mjs'), 'installed');
    await writeFile(join(workdir, 'seed.txt'), 'router spliced in');
    const r = await evaluateAssertions([{ type: 'git-uncommitted' }], { workdir, repoRoot: workdir, output: '', baselineSha });
    assert.equal(r[0].pass, true, r[0].detail);
  });
});

test('git-uncommitted fails when the install staged its writes', async () => {
  await withGitBaseline(async (workdir, baselineSha) => {
    await writeFile(join(workdir, 'new.txt'), 'x');
    git(workdir, 'add', '-A');
    const r = await evaluateAssertions([{ type: 'git-uncommitted' }], { workdir, repoRoot: workdir, output: '', baselineSha });
    assert.equal(r[0].pass, false);
    assert.match(r[0].detail, /staged/);
  });
});

test('git-uncommitted fails when a commit was made past the baseline', async () => {
  await withGitBaseline(async (workdir, baselineSha) => {
    await writeFile(join(workdir, 'seed.txt'), 'changed');
    git(workdir, 'add', '-A');
    git(workdir, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'sneaky commit');
    const r = await evaluateAssertions([{ type: 'git-uncommitted' }], { workdir, repoRoot: workdir, output: '', baselineSha });
    assert.equal(r[0].pass, false);
    assert.match(r[0].detail, /commit/);
  });
});

test('git-uncommitted fails when a remote was added', async () => {
  await withGitBaseline(async (workdir, baselineSha) => {
    git(workdir, 'remote', 'add', 'origin', 'https://example.invalid/repo.git');
    const r = await evaluateAssertions([{ type: 'git-uncommitted' }], { workdir, repoRoot: workdir, output: '', baselineSha });
    assert.equal(r[0].pass, false);
    assert.match(r[0].detail, /remote/);
  });
});

test('git-uncommitted fails without a recorded baseline sha instead of passing vacuously', async () => {
  await withGitBaseline(async (workdir) => {
    const r = await evaluateAssertions([{ type: 'git-uncommitted' }], { workdir, repoRoot: workdir, output: '' });
    assert.equal(r[0].pass, false);
    assert.match(r[0].detail, /no baseline commit sha/);
  });
});

test('git-uncommitted fails on a non-git workdir instead of passing vacuously', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    const r = await evaluateAssertions([{ type: 'git-uncommitted' }], { workdir, repoRoot, output: '', baselineSha: 'deadbeef' });
    assert.equal(r[0].pass, false);
  });
});

// --- execution-trace assertions (v2 acceptance seam): the harness output
// carries a machine-readable fenced `execution-trace` block; cases assert its
// fields and coordinator/worker ownership deterministically. ---

const TRACE = {
  rounds: [{ round: 1, assignments: 3 }],
  workers: [
    { id: 'w1', assignment: 'a1', searches: 2, fetches: 3, writes: 0, owned: ['docs/a.md'] },
    { id: 'w2', assignment: 'a2', searches: 3, fetches: 2, writes: 0, owned: ['docs/b.md'] },
  ],
  coordinator: { write_phase: 'done', writes: 2 },
};

function fenced(trace) {
  return `prose before\n\`\`\`execution-trace\n${JSON.stringify(trace)}\n\`\`\`\nprose after`;
}

test('trace-field asserts a dot-path field of the parsed execution-trace', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    const r = await evaluateAssertions(
      [
        { type: 'trace-field', path: 'coordinator.write_phase', equals: 'done' },
        { type: 'trace-field', path: 'workers.0.searches', equals: 2 },
        { type: 'trace-field', path: 'coordinator.write_phase', equals: 'pending' },
        { type: 'trace-field', path: 'coordinator.missing', equals: 1 },
      ],
      { workdir, repoRoot, output: fenced(TRACE) },
    );
    assert.deepEqual(r.map((x) => x.pass), [true, true, false, false]);
    assert.match(r[2].detail, /coordinator\.write_phase/);
  });
});

test('trace-every asserts a field over every element of a trace array (worker ownership)', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    const r = await evaluateAssertions(
      [
        { type: 'trace-every', path: 'workers', field: 'writes', equals: 0 },
        { type: 'trace-every', path: 'workers', field: 'searches', equals: 2 },
      ],
      { workdir, repoRoot, output: fenced(TRACE) },
    );
    assert.equal(r[0].pass, true);
    assert.equal(r[1].pass, false);
    assert.match(r[1].detail, /workers\[1\]\.searches/);
  });
});

test('trace-disjoint asserts pairwise-disjoint ownership arrays across workers', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    const ok = await evaluateAssertions(
      [{ type: 'trace-disjoint', path: 'workers', field: 'owned' }],
      { workdir, repoRoot, output: fenced(TRACE) },
    );
    assert.equal(ok[0].pass, true);
    const overlapping = structuredClone(TRACE);
    overlapping.workers[1].owned = ['docs/a.md'];
    const bad = await evaluateAssertions(
      [{ type: 'trace-disjoint', path: 'workers', field: 'owned' }],
      { workdir, repoRoot, output: fenced(overlapping) },
    );
    assert.equal(bad[0].pass, false);
    assert.match(bad[0].detail, /docs\/a\.md/);
  });
});

test('a missing or unparseable execution-trace block fails trace assertions with a clear detail', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    const missing = await evaluateAssertions(
      [{ type: 'trace-field', path: 'coordinator.writes', equals: 2 }],
      { workdir, repoRoot, output: 'no trace here' },
    );
    assert.equal(missing[0].pass, false);
    assert.match(missing[0].detail, /execution-trace/);
    const garbled = await evaluateAssertions(
      [{ type: 'trace-field', path: 'coordinator.writes', equals: 2 }],
      { workdir, repoRoot, output: '```execution-trace\nnot json\n```' },
    );
    assert.equal(garbled[0].pass, false);
    assert.match(garbled[0].detail, /execution-trace/);
  });
});

test('the last execution-trace block wins (the final report supersedes earlier partials)', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    const output = `${fenced({ coordinator: { writes: 1 } })}\n${fenced({ coordinator: { writes: 2 } })}`;
    const r = await evaluateAssertions(
      [{ type: 'trace-field', path: 'coordinator.writes', equals: 2 }],
      { workdir, repoRoot, output },
    );
    assert.equal(r[0].pass, true);
  });
});

// --- portable-contract (v2 acceptance seam): a case statically asserts the
// projected pack in the fixture satisfies the shared-reader contract. ---

test('portable-contract passes a conformant projected pack and fails a broken one', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    await writeFile(join(workdir, 'CLAUDE.md'), '@AGENTS.md\n');
    await writeFile(join(workdir, 'AGENTS.md'), '# Project\n');
    await mkdir(join(workdir, '.claude/skills/docs-add'), { recursive: true });
    await writeFile(
      join(workdir, '.claude/skills/docs-add/SKILL.md'),
      '---\nname: docs-add\ndescription: Scaffold one concept.\n---\n\nSee [t](templates/x.md).\n',
    );
    const ok = await evaluateAssertions(
      [{ type: 'portable-contract', skillsSubdir: '.claude/skills' }],
      { workdir, repoRoot, output: '' },
    );
    assert.equal(ok[0].pass, true);
    await writeFile(join(workdir, 'CLAUDE.md'), 'not the shim\n');
    const bad = await evaluateAssertions(
      [{ type: 'portable-contract', skillsSubdir: '.claude/skills' }],
      { workdir, repoRoot, output: '' },
    );
    assert.equal(bad[0].pass, false);
    assert.match(bad[0].detail, /CLAUDE\.md/);
  });
});

test('portable-contract defaults to the executing driver subdir from ctx and fails when it is absent', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    await writeFile(join(workdir, 'CLAUDE.md'), '@AGENTS.md\n');
    await writeFile(join(workdir, 'AGENTS.md'), '# Project\n');
    // Pack projected the way the codex driver does it.
    await mkdir(join(workdir, '.agents/skills/docs-add'), { recursive: true });
    await writeFile(
      join(workdir, '.agents/skills/docs-add/SKILL.md'),
      '---\nname: docs-add\ndescription: Scaffold one concept.\n---\n\nSee [t](templates/x.md).\n',
    );
    // No skillsSubdir on the assertion: ctx (the executing driver) decides.
    const onCodexLeg = await evaluateAssertions(
      [{ type: 'portable-contract' }],
      { workdir, repoRoot, output: '', skillsSubdir: '.agents/skills' },
    );
    assert.equal(onCodexLeg[0].pass, true);
    // A leg whose subdir was never projected must FAIL loudly, not skip the
    // skill checks vacuously.
    const onWrongLeg = await evaluateAssertions(
      [{ type: 'portable-contract' }],
      { workdir, repoRoot, output: '', skillsSubdir: '.opencode/skills' },
    );
    assert.equal(onWrongLeg[0].pass, false);
    assert.match(onWrongLeg[0].detail, /\.opencode\/skills.*missing/);
  });
});

// --- trace-round-search-cap (v2 #59 seam): rounds 2 and 3 reject more than five
// targeted searches. The observable proof is the execution-trace: for every round
// at or past `fromRound`, the SUM of its workers' searchCount must stay within
// `max`. This is a real budget check (the oracle sums and compares), not the trace
// asserting itself — a round that ran six searches fails loudly. ---

const BUDGET_TRACE = {
  rounds: [
    { round: 1, kind: 'breadth', workers: [{ searchCount: 3 }, { searchCount: 3 }, { searchCount: 2 }] },
    { round: 2, kind: 'gaps', targetedSearchLimit: 5, workers: [{ searchCount: 3 }, { searchCount: 2 }] },
    { round: 3, kind: 'verification', targetedSearchLimit: 5, workers: [{ searchCount: 4 }] },
  ],
};

test('trace-round-search-cap passes when rounds 2 and 3 stay within five targeted searches', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    const r = await evaluateAssertions(
      [{ type: 'trace-round-search-cap', fromRound: 2, max: 5 }],
      { workdir, repoRoot, output: fenced(BUDGET_TRACE) },
    );
    assert.equal(r[0].pass, true, r[0].detail);
  });
});

test('trace-round-search-cap CATCHES a round 2 that ran more than five targeted searches', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    const over = structuredClone(BUDGET_TRACE);
    over.rounds[1].workers = [{ searchCount: 3 }, { searchCount: 4 }]; // 7 > 5
    const r = await evaluateAssertions(
      [{ type: 'trace-round-search-cap', fromRound: 2, max: 5 }],
      { workdir, repoRoot, output: fenced(over) },
    );
    assert.equal(r[0].pass, false);
    assert.match(r[0].detail, /round 2 ran 7 targeted searches/);
  });
  // Round 1 breadth (8 searches across three workers) is NOT capped at five — the
  // limit applies only from round 2, so the same trace still passes.
  await withDirs(async ({ workdir, repoRoot }) => {
    const r = await evaluateAssertions(
      [{ type: 'trace-round-search-cap', fromRound: 2, max: 5 }],
      { workdir, repoRoot, output: fenced(BUDGET_TRACE) },
    );
    assert.equal(r[0].pass, true, r[0].detail);
  });
  // A missing rounds array fails loudly rather than passing vacuously.
  await withDirs(async ({ workdir, repoRoot }) => {
    const r = await evaluateAssertions(
      [{ type: 'trace-round-search-cap', fromRound: 2, max: 5 }],
      { workdir, repoRoot, output: fenced({ coordinator: {} }) },
    );
    assert.equal(r[0].pass, false);
    assert.match(r[0].detail, /rounds/);
  });
});

// --- trace-fetch-within-cap (v2 #59 seam): fetch attempts never exceed the run's
// cap, and the run's cap never exceeds the hard ceiling (45). Proves the 20/45
// invariant is observable — a run that fetched past its cap, or raised its cap
// past the ceiling, fails. ---

test('trace-fetch-within-cap passes a default (20) and an approved (45) run', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    const def = fenced({ fetch: { cap: 20, ceiling: 45, raisedByApproval: false, attempts: 12 } });
    const approved = fenced({ fetch: { cap: 45, ceiling: 45, raisedByApproval: true, attempts: 40 } });
    const r = await evaluateAssertions(
      [{ type: 'trace-fetch-within-cap' }],
      { workdir, repoRoot, output: def },
    );
    assert.equal(r[0].pass, true, r[0].detail);
    const r2 = await evaluateAssertions(
      [{ type: 'trace-fetch-within-cap' }],
      { workdir, repoRoot, output: approved },
    );
    assert.equal(r2[0].pass, true, r2[0].detail);
  });
});

test('trace-fetch-within-cap CATCHES attempts over the cap and a cap over the 45 ceiling', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    const overAttempts = await evaluateAssertions(
      [{ type: 'trace-fetch-within-cap' }],
      { workdir, repoRoot, output: fenced({ fetch: { cap: 20, ceiling: 45, attempts: 21 } }) },
    );
    assert.equal(overAttempts[0].pass, false);
    assert.match(overAttempts[0].detail, /attempts 21 exceed the run cap 20/);
    const overCeiling = await evaluateAssertions(
      [{ type: 'trace-fetch-within-cap' }],
      { workdir, repoRoot, output: fenced({ fetch: { cap: 46, ceiling: 45, attempts: 10 } }) },
    );
    assert.equal(overCeiling[0].pass, false);
    assert.match(overCeiling[0].detail, /cap 46 exceeds the hard ceiling 45/);
    // No fetch block at all fails loudly rather than passing vacuously.
    const missing = await evaluateAssertions(
      [{ type: 'trace-fetch-within-cap' }],
      { workdir, repoRoot, output: fenced({ coordinator: {} }) },
    );
    assert.equal(missing[0].pass, false);
    assert.match(missing[0].detail, /fetch/);
  });
});

test('output-contains checks captured harness output; unknown type fails', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    const r = await evaluateAssertions(
      [
        { type: 'output-contains', value: 'DONE' },
        { type: 'bogus', path: 'x' },
      ],
      { workdir, repoRoot, output: 'work DONE here' },
    );
    assert.equal(r[0].pass, true);
    assert.equal(r[1].pass, false);
    assert.match(r[1].detail, /unknown assertion type: bogus/);
    assert.equal(allPassed(r), false);
  });
});
