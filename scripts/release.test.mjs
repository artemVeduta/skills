import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  validateTag, parseArgs, bumpManifest, checkBenchmarkStaleness, planReleaseSteps,
} from './release.mjs';

test('validateTag accepts vX.Y.Z and rejects everything else', () => {
  for (const good of ['v0.1.0', 'v10.20.30']) assert.ok(validateTag(good), good);
  for (const bad of ['0.1.0', 'v1.2', 'v1.2.3.4', 'v1.0.0-rc.1', 'latest', '', undefined]) assert.ok(!validateTag(bad), String(bad));
});

test('parseArgs extracts the tag and the flags', () => {
  assert.deepEqual(parseArgs(['v0.1.0', '--dry-run']), { tag: 'v0.1.0', dryRun: true, force: false });
  assert.deepEqual(parseArgs(['v2.0.0', '--force']), { tag: 'v2.0.0', dryRun: false, force: true });
});

test('bumpManifest updates version and preserves formatting', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rel-'));
  const p = join(dir, 'plugin.json');
  writeFileSync(p, '{\n  "name": "skills",\n  "version": "0.0.0"\n}\n');
  const r = bumpManifest(p, '0.1.0', { dryRun: false });
  assert.equal(r.status, 'changed');
  assert.equal(r.previous, '0.0.0');
  assert.equal(r.next, '0.1.0');
  const after = readFileSync(p, 'utf8');
  assert.match(after, /"version": "0\.1\.0"/);
  assert.ok(after.endsWith('\n'), 'trailing newline preserved');
  rmSync(dir, { recursive: true, force: true });
});

test('bumpManifest tolerates an absent manifest', () => {
  const r = bumpManifest(join(tmpdir(), 'nope-xyz', 'plugin.json'), '0.1.0', { dryRun: false });
  assert.equal(r.status, 'missing');
});

test('bumpManifest is a no-op when already at the target version', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rel-'));
  const p = join(dir, 'plugin.json');
  writeFileSync(p, '{\n  "version": "0.1.0"\n}\n');
  assert.equal(bumpManifest(p, '0.1.0', {}).status, 'unchanged');
  rmSync(dir, { recursive: true, force: true });
});

test('bumpManifest --dry-run computes but does not write', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rel-'));
  const p = join(dir, 'plugin.json');
  writeFileSync(p, '{\n  "version": "0.0.0"\n}\n');
  const r = bumpManifest(p, '0.1.0', { dryRun: true });
  assert.equal(r.status, 'changed');
  assert.match(readFileSync(p, 'utf8'), /"version": "0\.0\.0"/);
  rmSync(dir, { recursive: true, force: true });
});

test('checkBenchmarkStaleness warns when the summaries dir is absent or empty', () => {
  assert.match(checkBenchmarkStaleness(join(tmpdir(), 'no-such-dir-xyz')), /no committed full-preset/);
  const empty = mkdtempSync(join(tmpdir(), 'sum-'));
  assert.match(checkBenchmarkStaleness(empty), /no committed full-preset/);
  rmSync(empty, { recursive: true, force: true });
});

test('checkBenchmarkStaleness returns null when a summary exists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sum-'));
  writeFileSync(join(dir, 'okf-docs-setup.full.json'), '{}');
  assert.equal(checkBenchmarkStaleness(dir), null);
  rmSync(dir, { recursive: true, force: true });
});

test('planReleaseSteps commits only when manifests changed, always tags + releases', () => {
  const changed = planReleaseSteps({ tag: 'v0.1.0', branch: 'main', changed: ['.claude-plugin/plugin.json'] });
  assert.ok(changed.includes('git commit -m "Release v0.1.0"'));
  assert.ok(changed.includes('git tag -a v0.1.0 -m "v0.1.0"'));
  assert.ok(changed.some((s) => s.startsWith('gh release create v0.1.0 --verify-tag')));
  const none = planReleaseSteps({ tag: 'v0.1.0', branch: 'main', changed: [] });
  assert.ok(none.includes('(no manifest changes to commit)'));
  assert.ok(!none.some((s) => s.startsWith('git commit')));
});
