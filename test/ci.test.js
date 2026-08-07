const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join, basename } = require('node:path');
const { describe, it } = require('node:test');
const assert = require('node:assert');

const ROOT = join(__dirname, '..');

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('repo structure', () => {
  it('has all required root files', () => {
    for (const f of ['README.md', 'AGENTS.md', 'CLAUDE.md', 'LICENSE', 'package.json']) {
      assert.ok(statSync(join(ROOT, f)).isFile(), `missing ${f}`);
    }
  });

  it('skills/ directory exists with entries', () => {
    const skills = readdirSync(join(ROOT, 'skills'));
    assert.ok(skills.length > 0, 'skills/ is empty');
  });

  it('every skill dir has a SKILL.md', () => {
    const skills = readdirSync(join(ROOT, 'skills'));
    for (const name of skills) {
      const skillDir = join(ROOT, 'skills', name);
      if (!statSync(skillDir).isDirectory()) continue;
      const skmd = join(skillDir, 'SKILL.md');
      assert.ok(statSync(skmd).isFile(), `${name} missing SKILL.md`);
    }
  });
});

describe('plugin manifests', () => {
  it('.claude-plugin/plugin.json is valid', () => {
    const p = loadJSON(join(ROOT, '.claude-plugin', 'plugin.json'));
    assert.ok(p.name, 'missing name');
    assert.ok(p.version, 'missing version');
  });

  it('.claude-plugin/marketplace.json is valid', () => {
    const m = loadJSON(join(ROOT, '.claude-plugin', 'marketplace.json'));
    assert.ok(m.name, 'missing name');
    assert.ok(Array.isArray(m.plugins) && m.plugins.length > 0, 'no plugins');
  });

  it('.codex-plugin/plugin.json is valid', () => {
    const p = loadJSON(join(ROOT, '.codex-plugin', 'plugin.json'));
    assert.ok(p.name, 'missing name');
    assert.ok(p.version, 'missing version');
  });
});

describe('package.json', () => {
  it('has required fields', () => {
    const pkg = loadJSON(join(ROOT, 'package.json'));
    assert.ok(pkg.name, 'missing name');
    assert.ok(pkg.version, 'missing version');
    assert.ok(pkg.license === 'MIT', 'license must be MIT');
  });
});
