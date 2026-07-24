import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  REGISTRY, MANAGED_PACKAGE, nativeCommands, portableCommand,
  portableHarnesses, nativeHarnesses, findEntry,
} from './install/registry.mjs';
import {
  renderPortableSection, renderNativeSection, validateReadme, writeReadme, BLOCKS,
} from './install/readme.mjs';
import { discoverSkills } from './install/discovery.mjs';

const README = readFileSync(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8');

// Slice the text between a generated block's markers (throws if either is absent).
function blockOf(name) {
  const b = BLOCKS.find((x) => x.name === name);
  assert.ok(b, `no such block: ${name}`);
  const start = README.indexOf(b.begin);
  const end = README.indexOf(b.end);
  assert.ok(start !== -1 && end !== -1 && end > start, `${name} markers present and ordered`);
  return README.slice(start + b.begin.length, end);
}

// --- source-of-truth helpers ---------------------------------------------

test('MANAGED_PACKAGE carries one repo slug and the native marketplace/plugin ids', () => {
  assert.equal(MANAGED_PACKAGE.repo, 'artemVeduta/skills');
  assert.equal(MANAGED_PACKAGE.pluginId, 'skills');
  assert.equal(MANAGED_PACKAGE.marketplaceId, 'artemveduta');
});

test('portableCommand is the whole-pack shape derived from the one repo slug', () => {
  assert.equal(portableCommand(), "npx skills@latest add artemVeduta/skills --skill '*'");
});

test('nativeCommands derives the exact documented Claude operations', () => {
  const c = nativeCommands(findEntry(REGISTRY, 'claude-code'));
  assert.equal(c.marketplaceAdd, 'claude plugin marketplace add artemVeduta/skills');
  assert.equal(c.install, 'claude plugin install skills@artemveduta');
  assert.equal(c.update, 'claude plugin marketplace update artemveduta');
});

test('nativeCommands derives the exact documented Codex operations', () => {
  const c = nativeCommands(findEntry(REGISTRY, 'codex'));
  assert.equal(c.marketplaceAdd, 'codex plugin marketplace add artemVeduta/skills');
  assert.equal(c.install, 'codex plugin add skills@artemveduta');
  assert.equal(c.update, 'codex plugin marketplace upgrade artemveduta');
});

test('portable channel is offered to all three harnesses; native only to Claude Code and Codex', () => {
  assert.deepEqual(portableHarnesses(REGISTRY).map((e) => e.id).sort(),
    ['claude-code', 'codex', 'opencode']);
  assert.deepEqual(nativeHarnesses(REGISTRY).map((e) => e.id).sort(),
    ['claude-code', 'codex']);
});

test('OpenCode has no native channel and no native adapter (native install never accepted)', () => {
  const oc = findEntry(REGISTRY, 'opencode');
  assert.ok(!oc.channels.includes('native'), 'opencode carries no native channel');
  assert.equal(oc.native, undefined, 'opencode carries no native adapter data');
});

// --- generated section shape ---------------------------------------------

test('portable section documents the whole-pack shape for all three harnesses', () => {
  const s = renderPortableSection(REGISTRY);
  assert.match(s, /npx skills@latest add artemVeduta\/skills --skill '\*'/);
  for (const name of ['Claude Code', 'Codex', 'OpenCode']) assert.ok(s.includes(name), name);
  // no per-skill picker advertised
  assert.match(s, /no supported per-skill picker|never a per-skill selection|whole pack/i);
  // Git-ref provenance for portable copies
  assert.match(s, /Git commit\/ref/);
  // mixing warning adjacent
  assert.match(s, /Do not mix package shapes/);
  // managed update never mutates a docs-setup-configured repo
  assert.match(s, /never mutates a repository[\s\S]*docs-setup/);
});

test('native section documents verified Claude+Codex ops and never advertises OpenCode native', () => {
  const s = renderNativeSection(REGISTRY);
  assert.match(s, /claude plugin marketplace add artemVeduta\/skills/);
  assert.match(s, /claude plugin install skills@artemveduta/);
  assert.match(s, /claude plugin marketplace update artemveduta/);
  assert.match(s, /codex plugin marketplace add artemVeduta\/skills/);
  assert.match(s, /codex plugin add skills@artemveduta/);
  assert.match(s, /codex plugin marketplace upgrade artemveduta/);
  // plugin version/release provenance for native copies
  assert.match(s, /plugin version\/release/);
  // mixing warning + no-mutation adjacent
  assert.match(s, /Do not mix package shapes/);
  assert.match(s, /never mutates a repository[\s\S]*docs-setup/);
  // OpenCode is only pointed at the portable channel, never offered a native plugin
  assert.match(s, /no OpenCode native plugin/);
  assert.doesNotMatch(s, /opencode plugin (add|install|marketplace)/i);
});

// The "N-skill pack" prose is spelled out in both managed sections. Nothing else
// asserts the count, so pin the word to the real pack size: adding or removing a
// skill fails here and forces the prose to be corrected in lockstep (anti-drift).
test('both managed sections state the pack size matching the actual skill count', async () => {
  const skills = await discoverSkills(fileURLToPath(new URL('../skills', import.meta.url)));
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const word = WORDS[skills.length];
  assert.ok(word, `no count word for ${skills.length} skills; extend WORDS`);
  const phrase = new RegExp(`\\bcomplete ${word}-skill pack\\b`);
  assert.match(renderPortableSection(REGISTRY), phrase);
  assert.match(renderNativeSection(REGISTRY), phrase);
});

// --- multi-block validate/write round trip --------------------------------

test('validateReadme accepts freshly generated blocks and rejects a tampered one', () => {
  const good = writeReadme(REGISTRY, README);
  assert.deepEqual(validateReadme(REGISTRY, good), { ok: true });

  const tampered = good.replace("npx skills@latest add artemVeduta/skills --skill '*'", 'npx skills add foo');
  const v = validateReadme(REGISTRY, tampered);
  assert.equal(v.ok, false);
  assert.match(v.reason, /portable-install/);
});

test('writeReadme is idempotent: regenerating an already-generated README is a no-op', () => {
  const once = writeReadme(REGISTRY, README);
  const twice = writeReadme(REGISTRY, once);
  assert.equal(once, twice);
});

// --- committed README doc-shape (acceptance) ------------------------------

test('committed README: portable block advertises the whole-pack shape for all three harnesses', () => {
  const block = blockOf('portable-install');
  assert.match(block, /npx skills@latest add artemVeduta\/skills --skill '\*'/);
  for (const name of ['Claude Code', 'Codex', 'OpenCode']) assert.ok(block.includes(name), name);
});

test('committed README: no supported journey advertises a per-skill picker', () => {
  // The only skill selector documented anywhere in the install guidance is the
  // whole-pack glob; no `--skill <name>` picker and no "select individual skills".
  const dev = blockOf('dev-install');
  const portable = blockOf('portable-install');
  const native = blockOf('native-install');
  for (const block of [dev, portable, native]) {
    assert.doesNotMatch(block, /--skill\s+(?!'\*')[a-z]/, 'no per-skill --skill <name> picker');
    assert.doesNotMatch(block, /select (individual |specific )?skills/i);
  }
});

test('committed README: native block documents Claude+Codex ops and excludes OpenCode native', () => {
  const block = blockOf('native-install');
  assert.match(block, /claude plugin install skills@artemveduta/);
  assert.match(block, /codex plugin add skills@artemveduta/);
  assert.match(block, /no OpenCode native plugin/);
  assert.doesNotMatch(block, /opencode plugin/i);
});

test('committed README: the mixing warning sits adjacent to BOTH managed install paths', () => {
  assert.match(blockOf('portable-install'), /Do not mix package shapes/);
  assert.match(blockOf('native-install'), /Do not mix package shapes/);
});

test('committed README: provenance is stated for both managed forms', () => {
  assert.match(blockOf('portable-install'), /Git commit\/ref/);
  assert.match(blockOf('native-install'), /plugin version\/release/);
});

test('committed README: updating a managed pack never mutates a docs-setup repo', () => {
  for (const name of ['portable-install', 'native-install']) {
    assert.match(blockOf(name), /never mutates a repository[\s\S]*docs-setup/, name);
  }
});
