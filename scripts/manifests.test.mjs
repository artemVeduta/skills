import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transitiveClosure } from '../tools/skill-graph.mjs';
import { discoverSkills } from './install/discovery.mjs';
import { buildGraph, validateGraph } from './install/graph.mjs';
import {
  REGISTRY, MANAGED_PACKAGE, findEntry, nativeCommands, nativeHarnesses,
} from './install/registry.mjs';

const url = (rel) => new URL(`../${rel}`, import.meta.url);
const readManifest = (rel) => JSON.parse(readFileSync(url(rel), 'utf8'));
const exists = (rel) => existsSync(fileURLToPath(url(rel)));

const SEMVER = /^\d+\.\d+\.\d+$/;

// The canonical suite is exactly these five top-level skills (okf-docs-setup gone, #60).
const CANONICAL = ['docs-add', 'docs-autoresearch', 'docs-setup', 'docs-sync', 'docs-validate'];

// The four documented native manifest/catalog paths.
const MANIFEST_PATHS = [
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.codex-plugin/plugin.json',
  '.agents/plugins/marketplace.json',
];

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

test('both plugin manifests carry the same snapshot release version', () => {
  const cc = readManifest('.claude-plugin/plugin.json');
  const cx = readManifest('.codex-plugin/plugin.json');
  assert.match(cc.version, SEMVER);
  assert.equal(cc.version, cx.version);
});

// --- #62: complete managed whole-pack packaging ---------------------------

test('all four documented native manifest/catalog paths exist', () => {
  for (const p of MANIFEST_PATHS) assert.ok(exists(p), `missing manifest: ${p}`);
});

test('the canonical skills tree is exactly the five top-level suite skills', () => {
  const skillsRoot = fileURLToPath(url('skills'));
  const dirs = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  assert.deepEqual(dirs, CANONICAL);
  for (const name of CANONICAL) assert.ok(exists(`skills/${name}/SKILL.md`), `${name}/SKILL.md`);
});

test('both plugin manifests expose the complete skills tree', () => {
  // Codex names the tree explicitly; Claude auto-discovers the repo-root `skills/`.
  const cx = readManifest('.codex-plugin/plugin.json');
  assert.equal(cx.skills, './skills/');
  const cc = readManifest('.claude-plugin/plugin.json');
  assert.ok(!('skills' in cc) || cc.skills === './skills/', 'claude uses the repo-root skills tree');
  assert.ok(exists('skills'), 'the skills/ tree the manifests package exists at the repo root');
});

test('the packaged suite is dependency-complete and self-contained (whole-pack closure)', async () => {
  const skills = await discoverSkills(fileURLToPath(url('skills')));
  assert.deepEqual(skills.map((s) => s.name).sort(), CANONICAL);
  const graph = buildGraph(skills);
  // No missing dependency node and no cycle anywhere in the pack.
  assert.deepEqual(validateGraph(graph), { ok: true, defects: [] });
  // Every skill's transitive closure resolves entirely within the packaged pack —
  // a whole-pack install can never omit a required capability.
  const members = new Set(CANONICAL);
  for (const name of CANONICAL) {
    for (const dep of transitiveClosure(graph, name)) {
      assert.ok(members.has(dep), `${name} depends on ${dep}, which is outside the pack`);
    }
  }
});

test('marketplace catalogs advertise the aggregate plugin under the source-of-truth ids', () => {
  const claudeMk = readManifest('.claude-plugin/marketplace.json');
  assert.equal(claudeMk.name, MANAGED_PACKAGE.marketplaceId);
  assert.equal(claudeMk.plugins[0].name, MANAGED_PACKAGE.pluginId);

  const codexMk = readManifest('.agents/plugins/marketplace.json');
  assert.equal(codexMk.name, MANAGED_PACKAGE.marketplaceId);
  assert.equal(codexMk.plugins[0].name, MANAGED_PACKAGE.pluginId);
});

test('the documented native operations reference the real manifest ids (verified)', () => {
  for (const entry of nativeHarnesses(REGISTRY)) {
    const plugin = readManifest(entry.native.pluginManifest);
    const marketplace = readManifest(entry.native.marketplaceManifest);
    // The plugin the install command targets is the one the manifests declare.
    assert.equal(plugin.name, MANAGED_PACKAGE.pluginId, `${entry.id} plugin name`);
    assert.equal(marketplace.name, MANAGED_PACKAGE.marketplaceId, `${entry.id} marketplace id`);
    assert.equal(marketplace.plugins[0].name, MANAGED_PACKAGE.pluginId, `${entry.id} catalog plugin`);

    const c = nativeCommands(entry);
    assert.ok(c.install.includes(`${MANAGED_PACKAGE.pluginId}@${MANAGED_PACKAGE.marketplaceId}`));
    assert.ok(c.marketplaceAdd.includes(MANAGED_PACKAGE.repo));
    assert.ok(c.update.includes(MANAGED_PACKAGE.marketplaceId));
  }
});

test('OpenCode native plugin packaging is absent (never accepted)', () => {
  // No OpenCode-native manifest exists anywhere, and the registry offers OpenCode
  // no native adapter.
  assert.ok(!exists('.opencode-plugin/plugin.json'), 'no .opencode-plugin/plugin.json');
  assert.ok(!exists('.opencode/plugin.json'), 'no .opencode/plugin.json');
  const oc = findEntry(REGISTRY, 'opencode');
  assert.ok(!oc.channels.includes('native'));
  assert.equal(oc.native, undefined);
  // The two native manifests belong to Claude and Codex only.
  assert.deepEqual(nativeHarnesses(REGISTRY).map((e) => e.id).sort(), ['claude-code', 'codex']);
});
