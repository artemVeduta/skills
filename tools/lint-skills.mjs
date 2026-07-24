import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseRequiredSkills,
  parseRuntimeInvocations,
  reconcileInvocations,
  missingNodes,
  findCycles,
} from './skill-graph.mjs';

export const ALLOWED_KEYS = new Set([
  'name',
  'description',
  'disable-model-invocation',
  'argument-hint',
]);

export const CANONICAL_HEADINGS = [
  '## Overview',
  '## Required skills',
  '## Integration',
  '## When to Use',
  '## Common Mistakes',
  '## Quick Reference',
];

// Role-named support subdirs a skill may carry. `references/` is the
// progressive-disclosure home for heavy reference material pulled out of SKILL.md
// (Anthropic/superpowers skill-authoring convention: SKILL.md summarizes, a
// references/ file carries the detail) — a first-class support role alongside
// executable scripts/, scaffolding templates/, and copied assets/.
export const ROLE_SUBDIRS = new Set(['scripts', 'templates', 'assets', 'references']);

export function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0].trim() !== '---') {
    return { ok: false, reason: 'no opening --- frontmatter fence' };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { ok: false, reason: 'unterminated frontmatter (no closing ---)' };
  }
  const data = {};
  for (let i = 1; i < end; i += 1) {
    const m = lines[i].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    data[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return { ok: true, data, body: lines.slice(end + 1).join('\n') };
}

function stripFences(text) {
  return text.replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*?\n[ \t]*\1[ \t]*$/gm, '');
}

export function lintFrontmatter(relPath, data) {
  const errors = [];
  const warnings = [];
  for (const req of ['name', 'description']) {
    if (typeof data[req] !== 'string' || data[req].trim() === '') {
      errors.push(`${relPath}: missing or empty required frontmatter key \`${req}\``);
    }
  }
  if ('disable-model-invocation' in data) {
    const v = data['disable-model-invocation'];
    if (v !== 'true' && v !== 'false') {
      errors.push(`${relPath}: \`disable-model-invocation\` must be true or false, got "${v}"`);
    }
  }
  for (const key of Object.keys(data)) {
    if (!ALLOWED_KEYS.has(key)) {
      warnings.push(
        `${relPath}: unknown frontmatter key \`${key}\` (allowed: name, description, disable-model-invocation, argument-hint)`
      );
    }
  }
  return { errors, warnings };
}

// NOTE: the name==dirName rule (and lintFrontmatter's presence rules above)
// intentionally ALSO exist, with stricter bounds, in
// tools/test-runner/static-contract.mjs (checkSkillMetadata): this linter is
// advisory over the library at rest; that module gates projected packs with
// the shared-reader pattern/length limits. Keep both; see the note there.
export function lintName(relPath, name, dirName) {
  const errors = [];
  if (name !== dirName) {
    errors.push(`${relPath}: frontmatter name "${name}" != directory name "${dirName}"`);
  }
  return { errors, warnings: [] };
}

export function lintBody(relPath, body) {
  const errors = [];
  const warnings = [];
  const count = body.split('\n').length;
  if (count > 500) {
    errors.push(`${relPath}: body is ${count} lines (> 500 hard limit)`);
  } else if (count > 200) {
    warnings.push(`${relPath}: body is ${count} lines (> 200 soft limit)`);
  }
  return { errors, warnings };
}

export function lintHeadings(relPath, body) {
  const warnings = [];
  const canonicalByLower = new Map(
    CANONICAL_HEADINGS.map((h) => [h.toLowerCase(), h])
  );
  for (const line of stripFences(body).split(/\r?\n/)) {
    if (!/^##\s+\S/.test(line)) continue;
    const heading = line.trim();
    const canonical = canonicalByLower.get(heading.toLowerCase());
    if (canonical && canonical !== heading) {
      warnings.push(`${relPath}: heading "${heading}" is a near-miss of canonical "${canonical}"`);
    }
  }
  return { errors: [], warnings };
}

export function lintDependencies(relPath, body, knownSkills) {
  const errors = [];
  const declared = parseRequiredSkills(body);
  const invoked = parseRuntimeInvocations(body);
  for (const name of reconcileInvocations(declared, invoked)) {
    errors.push(`${relPath}: runtime invocation \`/${name}\` is not declared in ## Required skills`);
  }
  for (const dep of declared) {
    if (knownSkills.has(dep) && knownSkills.get(dep).userInvoked) {
      errors.push(
        `${relPath}: required skill "${dep}" is user-invoked (disable-model-invocation: true) and cannot be a dependency`
      );
    }
  }
  return { errors, warnings: [] };
}

export function lintCrossSkillPaths(relPath, skillName, body, knownSkillNames) {
  const errors = [];
  for (const other of knownSkillNames) {
    if (other === skillName) continue;
    if (new RegExp(`(?:skills/|\\.\\./)${other}/`).test(body)) {
      errors.push(
        `${relPath}: references another skill's files by path (skills/${other}/ …); invoke by canonical name instead`
      );
    }
  }
  return { errors, warnings: [] };
}

export function lintSupportSubdirs(relPath, subdirNames) {
  const warnings = [];
  for (const name of subdirNames) {
    if (!ROLE_SUBDIRS.has(name)) {
      warnings.push(`${relPath}: support subdir "${name}/" is not role-named (scripts/, templates/, assets/)`);
    }
  }
  return { errors: [], warnings };
}

export function lintReadmeInventory(skillNames, readmeText) {
  const warnings = [];
  const listed = new Set();
  for (const m of readmeText.matchAll(/\]\(skills\/([^/)]+)\/SKILL\.md\)/g)) {
    listed.add(m[1]);
  }
  const actual = new Set(skillNames);
  for (const name of actual) {
    if (!listed.has(name)) {
      warnings.push(`README.md: skill "${name}" is missing from the inventory`);
    }
  }
  for (const name of listed) {
    if (!actual.has(name)) {
      warnings.push(`README.md: inventory lists "${name}" but no such skill directory exists`);
    }
  }
  return { errors: [], warnings };
}

// Advisory WARN: a skill with no central test-case directory under tools/tests/.
// The sibling of lintReadmeInventory's drift check — cases are central, so this
// is a repo-level check over directory names, not a per-skill subdir check.
export function lintTestCases(skillNames, caseDirNames) {
  const have = new Set(caseDirNames);
  const warnings = [];
  for (const name of skillNames) {
    if (!have.has(name)) {
      warnings.push(`${name}: skill has no central test-case directory (tools/tests/${name}/)`);
    }
  }
  return { errors: [], warnings };
}

export async function collectSkills(skillsRoot) {
  const skills = new Map();
  let entries;
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true });
  } catch {
    return skills;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dirName = e.name;
    const skillDir = join(skillsRoot, dirName);
    let text;
    try {
      text = await readFile(join(skillDir, 'SKILL.md'), 'utf8');
    } catch {
      continue;
    }
    const fm = parseFrontmatter(text);
    const children = await readdir(skillDir, { withFileTypes: true });
    const subdirNames = children.filter((c) => c.isDirectory()).map((c) => c.name);
    skills.set(dirName, {
      relPath: dirName,
      dirName,
      text,
      data: fm.ok ? fm.data : {},
      body: fm.ok ? fm.body : '',
      fmOk: fm.ok,
      fmReason: fm.ok ? null : fm.reason,
      subdirNames,
    });
  }
  return skills;
}

export async function lintSkillTree(skillsRoot, readmeText, caseDirNames = null) {
  const errors = [];
  const warnings = [];
  const skills = await collectSkills(skillsRoot);
  const knownSkillNames = new Set(skills.keys());
  const knownSkills = new Map();
  for (const [name, s] of skills) {
    knownSkills.set(name, { userInvoked: s.data['disable-model-invocation'] === 'true' });
  }

  const collect = (r) => {
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  };

  for (const [name, s] of skills) {
    const rel = `${s.relPath}/SKILL.md`;
    if (!s.fmOk) {
      errors.push(`${rel}: ${s.fmReason}`);
      continue;
    }
    collect(lintFrontmatter(rel, s.data));
    collect(lintName(rel, s.data.name, s.dirName));
    collect(lintBody(rel, s.body));
    collect(lintHeadings(rel, s.body));
    collect(lintDependencies(rel, s.body, knownSkills));
    collect(lintCrossSkillPaths(rel, name, s.body, knownSkillNames));
    collect(lintSupportSubdirs(s.relPath, s.subdirNames));
  }

  const graph = new Map();
  for (const [name, s] of skills) {
    graph.set(name, s.fmOk ? parseRequiredSkills(s.body) : []);
  }
  for (const { from, missing } of missingNodes(graph)) {
    errors.push(`${from}/SKILL.md: required skill "${missing}" does not exist in the library`);
  }
  for (const cycle of findCycles(graph)) {
    errors.push(`dependency cycle: ${cycle.join(' -> ')} -> ${cycle[0]}`);
  }

  collect(lintReadmeInventory([...knownSkillNames], readmeText));
  if (caseDirNames !== null) {
    collect(lintTestCases([...knownSkillNames], caseDirNames));
  }
  return { errors, warnings };
}

export function formatReport({ errors, warnings }) {
  if (errors.length === 0 && warnings.length === 0) {
    return 'lint:skills — all skills conform; no findings.';
  }
  const lines = [];
  if (errors.length > 0) {
    lines.push(`ERRORS — contract breaks (${errors.length}):`);
    for (const e of errors) lines.push(`  ${e}`);
    lines.push('');
  }
  if (warnings.length > 0) {
    lines.push(`Warnings — style drift (${warnings.length}):`);
    for (const w of warnings) lines.push(`  ${w}`);
    lines.push('');
  }
  lines.push(`${errors.length} error(s), ${warnings.length} warning(s).`);
  return lines.join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');
  const positional = argv.filter((a) => !a.startsWith('--'));
  const skillsRoot = positional[0] || 'skills';
  const readmePath = positional[1] || 'README.md';
  let readmeText = '';
  try {
    readmeText = await readFile(readmePath, 'utf8');
  } catch {
  }
  let caseDirNames = [];
  try {
    const entries = await readdir('tools/tests', { withFileTypes: true });
    caseDirNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    // No tools/tests/ yet — every skill will be flagged (advisory only).
  }
  const result = await lintSkillTree(skillsRoot, readmeText, caseDirNames);
  console.log(formatReport(result));
  process.exit(strict && result.errors.length > 0 ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
