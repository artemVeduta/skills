import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { loadCase } from './case-loader.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const casesRoot = join(REPO_ROOT, 'tools/tests');

// Canonical suite identity: the fresh-install setup case is `docs-setup-approve`
// (its manifest projects the `docs-setup` skill). Issue #60 retired the old
// `okf-docs-setup` identity.

test('the docs-setup fresh-install case loads and targets the right skill', async () => {
  const c = await loadCase('docs-setup-approve', { casesRoot });
  assert.equal(c.skill, 'docs-setup');
  assert.ok(c.assertions.length >= 10);
});

test('the case includes the byte-identity assertion on validate-docs.mjs', async () => {
  const c = await loadCase('docs-setup-approve', { casesRoot });
  const eq = c.assertions.find(
    (a) => a.type === 'file-equals' && a.path === 'scripts/validate-docs.mjs',
  );
  assert.equal(eq.path, 'scripts/validate-docs.mjs');
  assert.equal(eq.against, 'skills/docs-setup/assets/scripts/validate-docs.mjs');
});

test('the prompt neutralizes Phase 0 (no asking) and Phase 2 (no fan-out)', async () => {
  const c = await loadCase('docs-setup-approve', { casesRoot });
  assert.match(c.prompt, /do NOT ask/i);
  assert.match(c.prompt, /Subsystems: none yet/);
  assert.match(c.prompt, /none/i);
});
