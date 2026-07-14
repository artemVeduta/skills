import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCase } from './case-loader.mjs';

test('loadCase reads case.mjs and prompt.md from the skill case dir', async () => {
  const casesRoot = await mkdtemp(join(tmpdir(), 'tr-cases-'));
  try {
    const dir = join(casesRoot, 'demo');
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'case.mjs'),
      `export default ${JSON.stringify({
        inputs: [{ path: 'package.json', content: '{}' }],
        assertions: [{ type: 'file-exists', path: 'docs/index.md' }],
      })};\n`,
    );
    await writeFile(join(dir, 'prompt.md'), 'do the thing\n');
    const c = await loadCase('demo', { casesRoot });
    assert.equal(c.skill, 'demo');
    assert.equal(c.prompt, 'do the thing\n');
    assert.equal(c.inputs.length, 1);
    assert.equal(c.assertions[0].type, 'file-exists');
  } finally {
    await rm(casesRoot, { recursive: true, force: true });
  }
});

test('loadCase defaults inputs/assertions to empty arrays', async () => {
  const casesRoot = await mkdtemp(join(tmpdir(), 'tr-cases-'));
  try {
    const dir = join(casesRoot, 'bare');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'case.mjs'), 'export default {};\n');
    await writeFile(join(dir, 'prompt.md'), 'x');
    const c = await loadCase('bare', { casesRoot });
    assert.deepEqual(c.inputs, []);
    assert.deepEqual(c.assertions, []);
  } finally {
    await rm(casesRoot, { recursive: true, force: true });
  }
});
