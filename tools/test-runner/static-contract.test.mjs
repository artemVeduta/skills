import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  INSTRUCTION_CHAIN_BUDGET_BYTES,
  checkSkillMetadata,
  checkSupportPaths,
  checkMemoryRouting,
  checkInstructionChainBudget,
  checkPortableContract,
} from './static-contract.mjs';

// --- skill metadata (spec: name 1–64 chars, ^[a-z0-9]+(-[a-z0-9]+)*$, equals
// the directory name; description 1–1,024 chars) ---

test('conformant skill metadata produces no errors', () => {
  const errors = checkSkillMetadata({
    dirName: 'docs-add', name: 'docs-add', description: 'Scaffold one concept.',
  });
  assert.deepEqual(errors, []);
});

test('a name outside the pattern is rejected', () => {
  for (const bad of ['Docs-Add', 'docs_add', '-docs', 'docs-', 'docs--add', '']) {
    const errors = checkSkillMetadata({ dirName: bad, name: bad, description: 'd' });
    assert.ok(errors.length > 0, `expected rejection for ${JSON.stringify(bad)}`);
  }
});

test('limits count characters (code points), not UTF-16 code units', () => {
  // 512 astronaut emoji = 1,024 UTF-16 units but only 512 characters — within
  // the spec's 1,024-character description limit.
  const emoji = '\u{1F680}'.repeat(512);
  assert.equal(emoji.length, 1024);
  assert.deepEqual(checkSkillMetadata({ dirName: 'x', name: 'x', description: emoji }), []);
  assert.ok(checkSkillMetadata({ dirName: 'x', name: 'x', description: '\u{1F680}'.repeat(1025) }).length > 0);
});

test('a name over 64 characters is rejected; exactly 64 passes', () => {
  const name64 = 'a'.repeat(64);
  assert.deepEqual(checkSkillMetadata({ dirName: name64, name: name64, description: 'd' }), []);
  const name65 = 'a'.repeat(65);
  const errors = checkSkillMetadata({ dirName: name65, name: name65, description: 'd' });
  assert.ok(errors.some((e) => e.includes('64')));
});

test('a directory/name mismatch is rejected', () => {
  const errors = checkSkillMetadata({ dirName: 'docs-add', name: 'docs-validate', description: 'd' });
  assert.ok(errors.some((e) => e.includes('docs-add') && e.includes('docs-validate')));
});

test('a missing or over-1,024-character description is rejected; exactly 1,024 passes', () => {
  assert.ok(checkSkillMetadata({ dirName: 'x', name: 'x', description: undefined }).length > 0);
  assert.ok(checkSkillMetadata({ dirName: 'x', name: 'x', description: '' }).length > 0);
  assert.deepEqual(checkSkillMetadata({ dirName: 'x', name: 'x', description: 'a'.repeat(1024) }), []);
  assert.ok(checkSkillMetadata({ dirName: 'x', name: 'x', description: 'a'.repeat(1025) }).length > 0);
});

// --- support references (spec: relative-path progressive disclosure; static
// fixtures reject absolute cross-skill support paths) ---

test('relative support references and external URLs pass', () => {
  const body = 'See [template](templates/decision.md), [ref](./assets/okf.md), and [OKF](https://example.com/okf).';
  assert.deepEqual(checkSupportPaths('docs-add', body, new Set(['docs-add', 'docs-validate'])), []);
});

test('an absolute support path is rejected', () => {
  const body = 'Use [template](/skills/docs-add/templates/decision.md).';
  const errors = checkSupportPaths('docs-add', body, new Set(['docs-add']));
  assert.ok(errors.some((e) => e.includes('/skills/docs-add/templates/decision.md')));
});

test('a cross-skill support path is rejected', () => {
  const body = 'Read skills/docs-validate/SKILL.md first.';
  const errors = checkSupportPaths('docs-add', body, new Set(['docs-add', 'docs-validate']));
  assert.ok(errors.length > 0);
});

test('absolute targets in reference-style definitions and angle-bracket destinations are rejected', () => {
  const referenceStyle = 'See [the template][t].\n\n[t]: /abs/ref-target.md\n';
  const refErrors = checkSupportPaths('docs-add', referenceStyle, new Set(['docs-add']));
  assert.ok(refErrors.some((e) => e.includes('/abs/ref-target.md')));
  const angleBracket = 'Use [template](</abs path with spaces.md>).';
  const angleErrors = checkSupportPaths('docs-add', angleBracket, new Set(['docs-add']));
  assert.ok(angleErrors.some((e) => e.includes('/abs path with spaces.md')));
  // Relative targets in the same forms stay clean.
  const relative = 'See [a][t] and [b](<templates/x y.md>).\n\n[t]: templates/x.md\n';
  assert.deepEqual(checkSupportPaths('docs-add', relative, new Set(['docs-add'])), []);
});

// --- project-memory routing (spec: root CLAUDE.md is exactly @AGENTS.md) ---

test('the exact CLAUDE.md shim with a non-empty AGENTS.md passes', () => {
  assert.deepEqual(checkMemoryRouting({ claudeMd: '@AGENTS.md\n', agentsMd: '# AGENTS.md\n' }), []);
});

test('a CLAUDE.md that is not exactly the shim is rejected', () => {
  const errors = checkMemoryRouting({ claudeMd: '@AGENTS.md\nExtra guidance.\n', agentsMd: '# A\n' });
  assert.ok(errors.some((e) => e.includes('CLAUDE.md')));
});

test('a missing or empty AGENTS.md is rejected', () => {
  assert.ok(checkMemoryRouting({ claudeMd: '@AGENTS.md\n', agentsMd: null }).length > 0);
  assert.ok(checkMemoryRouting({ claudeMd: '@AGENTS.md\n', agentsMd: '  \n' }).length > 0);
});

// --- instruction-chain size budget (spec: root-to-working-directory AGENTS.md
// chain within Codex's default 32 KiB budget) ---

test('a chain within 32 KiB passes; over budget is rejected', () => {
  assert.deepEqual(checkInstructionChainBudget(['a'.repeat(1000), 'b'.repeat(1000)]), []);
  const errors = checkInstructionChainBudget(['a'.repeat(INSTRUCTION_CHAIN_BUDGET_BYTES), 'b']);
  assert.ok(errors.some((e) => e.includes('32')));
});

test('the budget is measured in bytes, not characters', () => {
  // 3 bytes per char in UTF-8; 11000 chars = 33000 bytes > 32 KiB.
  const errors = checkInstructionChainBudget(['€'.repeat(11000)]);
  assert.ok(errors.length > 0);
});

// --- aggregate walk over a projected pack / fixture root ---

async function writeFixture(root, { claudeMd, agentsMd, skills }) {
  if (claudeMd !== undefined) await writeFile(join(root, 'CLAUDE.md'), claudeMd);
  if (agentsMd !== undefined) await writeFile(join(root, 'AGENTS.md'), agentsMd);
  // The subdir always exists (buildFixture always projects it); an EMPTY
  // projected subdir is conformant, an ABSENT one is an explicit error.
  await mkdir(join(root, '.claude/skills'), { recursive: true });
  for (const [dirName, skillMd] of Object.entries(skills ?? {})) {
    await mkdir(join(root, '.claude/skills', dirName), { recursive: true });
    await writeFile(join(root, '.claude/skills', dirName, 'SKILL.md'), skillMd);
  }
}

test('checkPortableContract passes a conformant fixture', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sc-fx-'));
  try {
    await writeFixture(root, {
      claudeMd: '@AGENTS.md\n',
      agentsMd: '# Project\n',
      skills: {
        'docs-add': '---\nname: docs-add\ndescription: Scaffold one concept.\n---\n\nSee [t](templates/x.md).\n',
      },
    });
    const { errors } = await checkPortableContract(root, { skillsSubdir: '.claude/skills' });
    assert.deepEqual(errors, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('checkPortableContract reports metadata, routing, and support-path violations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sc-fx-'));
  try {
    await writeFixture(root, {
      claudeMd: 'Long-form guidance that is not the shim.\n',
      agentsMd: '# Project\n',
      skills: {
        'docs-add': '---\nname: Docs-Add\ndescription: d\n---\n\nUse [t](/abs/path.md).\n',
      },
    });
    const { errors } = await checkPortableContract(root, { skillsSubdir: '.claude/skills' });
    assert.ok(errors.some((e) => e.includes('Docs-Add')), 'name pattern violation reported');
    assert.ok(errors.some((e) => e.includes('/abs/path.md')), 'absolute support path reported');
    assert.ok(errors.some((e) => e.includes('CLAUDE.md')), 'memory-routing violation reported');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('checkPortableContract fails an over-budget AGENTS.md chain', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sc-fx-'));
  try {
    await writeFixture(root, {
      claudeMd: '@AGENTS.md\n',
      agentsMd: 'a'.repeat(INSTRUCTION_CHAIN_BUDGET_BYTES + 1),
    });
    const { errors } = await checkPortableContract(root, {});
    assert.ok(errors.some((e) => e.includes('32')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('an absent skills subdir is an explicit error, never a vacuous pass', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sc-fx-'));
  try {
    await writeFile(join(root, 'CLAUDE.md'), '@AGENTS.md\n');
    await writeFile(join(root, 'AGENTS.md'), '# Project\n');
    // No skills subdir at all — e.g. a pack that was never projected, or a
    // check pointed at the wrong per-harness discovery dir.
    const { errors } = await checkPortableContract(root, { skillsSubdir: '.agents/skills' });
    assert.ok(errors.some((e) => e.includes('.agents/skills') && e.includes('missing')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a nested AGENTS.md along the workdir path counts toward the chain budget', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sc-fx-'));
  try {
    const half = Math.ceil(INSTRUCTION_CHAIN_BUDGET_BYTES / 2) + 1;
    await writeFixture(root, { claudeMd: '@AGENTS.md\n', agentsMd: 'a'.repeat(half) });
    await mkdir(join(root, 'packages/web'), { recursive: true });
    await writeFile(join(root, 'packages/web/AGENTS.md'), 'b'.repeat(half));
    const over = await checkPortableContract(root, { workdirRel: 'packages/web' });
    assert.ok(over.errors.some((e) => e.includes('32')), 'combined chain exceeds the budget');
    const rootOnly = await checkPortableContract(root, {});
    assert.deepEqual(rootOnly.errors, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
