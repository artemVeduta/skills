import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readManifest = (rel) =>
  JSON.parse(readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'));

const SEMVER = /^\d+\.\d+\.\d+$/;

test('claude plugin manifest is valid and complete', () => {
  const m = readManifest('.claude-plugin/plugin.json');
  assert.equal(m.name, 'skills');
  assert.match(m.version, SEMVER);
  assert.ok(m.description, 'description present');
});

test('claude marketplace lists the aggregate plugin from the repo root', () => {
  const mk = readManifest('.claude-plugin/marketplace.json');
  assert.equal(mk.name, 'artemveduta');
  assert.ok(mk.owner && mk.owner.name, 'owner.name present');
  assert.ok(Array.isArray(mk.plugins) && mk.plugins.length === 1);
  assert.equal(mk.plugins[0].name, 'skills');
  assert.equal(mk.plugins[0].source, './');
});

test('codex plugin manifest is valid and points at the skills tree', () => {
  const m = readManifest('.codex-plugin/plugin.json');
  assert.equal(m.name, 'skills');
  assert.match(m.version, SEMVER);
  assert.equal(m.skills, './skills/');
});

test('codex marketplace lists the aggregate plugin from the repo root', () => {
  const mk = readManifest('.agents/plugins/marketplace.json');
  assert.equal(mk.name, 'artemveduta');
  assert.ok(Array.isArray(mk.plugins) && mk.plugins.length === 1);
  assert.equal(mk.plugins[0].name, 'skills');
  const src = mk.plugins[0].source;
  const isRepoRoot = src === './' || src === '.' ||
    (src && src.source === 'local' && (src.path === './' || src.path === '.'));
  assert.ok(isRepoRoot, 'plugin source resolves to the repo root');
});

test('both plugin manifests carry the same version', () => {
  const cc = readManifest('.claude-plugin/plugin.json');
  const cx = readManifest('.codex-plugin/plugin.json');
  assert.equal(cc.version, cx.version);
});
