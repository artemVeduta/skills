import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareOutcomes, comparisonsPassed } from './compare.mjs';

// Cross-harness comparison (v2 acceptance seam): the same scenario on every
// executed harness must yield EQUIVALENT repository outcomes — equal content
// for each case-declared path (file or whole directory), including equal
// absence. Prose is never compared.

async function withLegs(fn) {
  const a = await mkdtemp(join(tmpdir(), 'cmp-a-'));
  const b = await mkdtemp(join(tmpdir(), 'cmp-b-'));
  try {
    return await fn([
      { id: 'claude-code', fixtureRoot: a },
      { id: 'codex', fixtureRoot: b },
    ]);
  } finally {
    await rm(a, { recursive: true, force: true });
    await rm(b, { recursive: true, force: true });
  }
}

test('equal files across legs compare as pass', async () => {
  await withLegs(async (legs) => {
    for (const l of legs) await writeFile(join(l.fixtureRoot, 'out.md'), 'same\n');
    const r = await compareOutcomes(['out.md'], legs);
    assert.deepEqual(r, [{ path: 'out.md', status: 'compared', pass: true, detail: '' }]);
    assert.equal(comparisonsPassed(r), true);
  });
});

test('differing file content fails and names the diverging legs', async () => {
  await withLegs(async (legs) => {
    await writeFile(join(legs[0].fixtureRoot, 'out.md'), 'one\n');
    await writeFile(join(legs[1].fixtureRoot, 'out.md'), 'two\n');
    const r = await compareOutcomes(['out.md'], legs);
    assert.equal(r[0].pass, false);
    assert.match(r[0].detail, /claude-code/);
    assert.match(r[0].detail, /codex/);
    assert.equal(comparisonsPassed(r), false);
  });
});

test('directory trees compare recursively (structure + bytes)', async () => {
  await withLegs(async (legs) => {
    for (const l of legs) {
      await mkdir(join(l.fixtureRoot, 'docs/specs'), { recursive: true });
      await writeFile(join(l.fixtureRoot, 'docs/index.md'), '# idx\n');
      await writeFile(join(l.fixtureRoot, 'docs/specs/a.md'), 'a\n');
    }
    const equal = await compareOutcomes(['docs'], legs);
    assert.equal(equal[0].pass, true);
    await writeFile(join(legs[1].fixtureRoot, 'docs/specs/extra.md'), 'x\n');
    const diverged = await compareOutcomes(['docs'], legs);
    assert.equal(diverged[0].pass, false);
  });
});

test('a path missing in one leg fails; missing in every leg is equivalent (refusal parity)', async () => {
  await withLegs(async (legs) => {
    await writeFile(join(legs[0].fixtureRoot, 'only-here.md'), 'x\n');
    const oneSided = await compareOutcomes(['only-here.md'], legs);
    assert.equal(oneSided[0].pass, false);
    assert.match(oneSided[0].detail, /codex.*absent|absent.*codex/);
    const nowhere = await compareOutcomes(['nowhere.md'], legs);
    assert.equal(nowhere[0].pass, true, 'equal absence is an equivalent outcome');
  });
});

test('fewer than two legs yields skipped, never a vacuous verdict', async () => {
  const a = await mkdtemp(join(tmpdir(), 'cmp-a-'));
  try {
    const r = await compareOutcomes(['out.md'], [{ id: 'claude-code', fixtureRoot: a }]);
    assert.equal(r[0].status, 'skipped');
    assert.equal(comparisonsPassed(r), true, 'skipped comparisons never gate');
  } finally {
    await rm(a, { recursive: true, force: true });
  }
});
