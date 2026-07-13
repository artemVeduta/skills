import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Return the SKILL.md body with any leading YAML frontmatter removed.
export function stripFrontmatter(text) {
  if (!text.startsWith('---')) return text;
  const close = text.indexOf('\n---', 3);
  if (close === -1) return text;
  const nl = text.indexOf('\n', close + 1);
  return nl === -1 ? '' : text.slice(nl + 1);
}

// A skill is exactly <skillsRoot>/<name>/SKILL.md (flat). Nested SKILL.md files
// are never discovered. Returns skills sorted by name; [] if the root is absent.
export async function discoverSkills(skillsRoot) {
  let entries;
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const skills = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const srcDir = join(skillsRoot, e.name);
    let text;
    try {
      text = await readFile(join(srcDir, 'SKILL.md'), 'utf8');
    } catch {
      continue;
    }
    skills.push({ name: e.name, srcDir, text });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}
