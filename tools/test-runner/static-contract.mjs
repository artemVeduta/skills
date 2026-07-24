// Static portable-contract checks for the v2 acceptance seam (spec §Parity and
// distribution): every SKILL.md must satisfy the strictest shared-reader
// contract, support references must be relative, project memory must route
// through the exact CLAUDE.md shim, and the root-to-workdir AGENTS.md
// instruction chain must fit Codex's default 32 KiB budget. These run over a
// PROJECTED pack or fixture root (what an install/run actually sees) — the
// advisory linter checks the library tree at rest; this module GATES cases.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFrontmatter, lintCrossSkillPaths } from '../lint-skills.mjs';

// Codex's default project-doc budget: the whole root-to-working-directory
// AGENTS.md chain must stay within it (spec §Portable semantic contract).
export const INSTRUCTION_CHAIN_BUDGET_BYTES = 32 * 1024;

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Code POINTS, not UTF-16 code units: the spec limits are in "characters", and
// `.length` double-counts non-BMP characters (emoji in a description).
function charLength(str) {
  return [...str].length;
}

// Strictest shared-reader SKILL.md metadata contract: name is 1–64 chars,
// matches the pattern, and equals the directory name; description is 1–1,024
// chars. Returns plain error strings (empty = conformant).
//
// INTENTIONAL overlap with tools/lint-skills.mjs (lintName, lintFrontmatter):
// the linter is the ADVISORY check over the library tree at rest with the
// looser repo rules (name==dir, non-empty keys); this is the GATING contract
// over a projected pack with the strict shared-reader bounds (pattern, 64/1024
// character limits). The two deliberately do not delegate to each other — do
// not "deduplicate" one into the other without deciding which rule set gates.
export function checkSkillMetadata({ dirName, name, description }) {
  const errors = [];
  if (typeof name !== 'string' || charLength(name) < 1 || charLength(name) > 64) {
    errors.push(`${dirName}: skill name must be 1–64 characters, got ${typeof name === 'string' ? charLength(name) : typeof name}`);
  } else if (!NAME_PATTERN.test(name)) {
    errors.push(`${dirName}: skill name ${JSON.stringify(name)} does not match ^[a-z0-9]+(-[a-z0-9]+)*$`);
  } else if (name !== dirName) {
    errors.push(`${dirName}: skill name "${name}" does not equal its directory name "${dirName}"`);
  }
  if (typeof description !== 'string' || charLength(description) < 1) {
    errors.push(`${dirName}: missing skill description`);
  } else if (charLength(description) > 1024) {
    errors.push(`${dirName}: description is ${charLength(description)} characters (> 1,024 limit)`);
  }
  return errors;
}

// Support files must be referenced by relative path (progressive disclosure).
// Rejects absolute link targets (root-anchored paths break once the pack is
// projected anywhere else) and any cross-skill path reference (delegated to
// the linter's single implementation of that rule).
export function checkSupportPaths(skillName, body, knownSkillNames) {
  const errors = [];
  // Every Markdown link form with an absolute destination: inline `](/abs)`,
  // angle-bracket inline `](</abs path>)`, and reference-style definitions
  // (`[t]: /abs/path.md`) — a root-anchored target hides in any of them.
  const absoluteTargets = [
    ...body.matchAll(/\]\((\/[^)\s]*)\)/g),
    ...body.matchAll(/\]\(<(\/[^>]*)>\)/g),
    ...body.matchAll(/^ {0,3}\[[^\]]+\]:\s*<?(\/\S*?)>?(?:\s|$)/gm),
  ];
  for (const m of absoluteTargets) {
    errors.push(`${skillName}: absolute support path ${m[1]} — support references must be relative`);
  }
  errors.push(...lintCrossSkillPaths(skillName, skillName, body, knownSkillNames).errors);
  return errors;
}

// Project-memory routing (spec §Discovery and adapters): root CLAUDE.md is
// exactly the `@AGENTS.md` shim and the routed-to AGENTS.md carries content.
export function checkMemoryRouting({ claudeMd, agentsMd }) {
  const errors = [];
  if (typeof claudeMd !== 'string' || claudeMd.trim() !== '@AGENTS.md') {
    errors.push('CLAUDE.md: root project memory must be exactly the `@AGENTS.md` shim');
  }
  if (typeof agentsMd !== 'string' || agentsMd.trim() === '') {
    errors.push('AGENTS.md: missing or empty — project memory routes through it');
  }
  return errors;
}

// Byte size of the whole instruction chain (each entry is one AGENTS.md body,
// root first). Bytes, not characters — the budget is a file-size budget.
export function checkInstructionChainBudget(texts) {
  const total = texts.reduce((sum, t) => sum + Buffer.byteLength(t, 'utf8'), 0);
  if (total > INSTRUCTION_CHAIN_BUDGET_BYTES) {
    return [`AGENTS.md instruction chain is ${total} bytes (> 32 KiB budget of ${INSTRUCTION_CHAIN_BUDGET_BYTES})`];
  }
  return [];
}

// Shared "read a file or null on ENOENT" helper — also used by the oracle.
export async function readIf(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// Aggregate: run every static check over a fixture/pack root. `skillsSubdir`
// names the projected discovery dir — its ABSENCE is an explicit error, never
// a silent skip: the metadata/support checks would otherwise vanish exactly
// when the pack was never projected (or the wrong subdir was targeted). An
// EMPTY existing subdir is fine (projected, zero skills). `workdirRel` extends
// the AGENTS.md chain from the root down to a nested working directory.
export async function checkPortableContract(rootDir, { skillsSubdir = '.claude/skills', workdirRel = '' } = {}) {
  const errors = [];

  const skillsRoot = join(rootDir, skillsSubdir);
  let entries = [];
  try {
    entries = (await readdir(skillsRoot, { withFileTypes: true })).filter((e) => e.isDirectory());
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    errors.push(`${skillsSubdir}: skills subdir is missing — the pack was never projected here, so no skill was checked`);
  }
  const skillDirs = entries.map((e) => e.name);
  const knownSkillNames = new Set(skillDirs);
  for (const dirName of skillDirs) {
    const text = await readIf(join(skillsRoot, dirName, 'SKILL.md'));
    if (text === null) {
      errors.push(`${dirName}: missing SKILL.md`);
      continue;
    }
    const fm = parseFrontmatter(text);
    if (!fm.ok) {
      errors.push(`${dirName}: ${fm.reason}`);
      continue;
    }
    errors.push(...checkSkillMetadata({ dirName, name: fm.data.name, description: fm.data.description }));
    errors.push(...checkSupportPaths(dirName, fm.body, knownSkillNames));
  }

  errors.push(...checkMemoryRouting({
    claudeMd: await readIf(join(rootDir, 'CLAUDE.md')),
    agentsMd: await readIf(join(rootDir, 'AGENTS.md')),
  }));

  // Chain = root AGENTS.md plus every AGENTS.md on the path down to workdirRel.
  const chain = [];
  const segments = workdirRel === '' ? [] : workdirRel.split('/');
  for (let depth = 0; depth <= segments.length; depth++) {
    const dir = join(rootDir, ...segments.slice(0, depth));
    const text = await readIf(join(dir, 'AGENTS.md'));
    if (text !== null) chain.push(text);
  }
  errors.push(...checkInstructionChainBudget(chain));

  return { errors };
}
