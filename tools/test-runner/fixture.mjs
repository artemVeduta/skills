// Projects a skill + its transitive `## Required skills` closure UNMODIFIED
// into a disposable per-harness fixture, shaped to that harness's discovery
// path. Sources are only READ (copied out) — never mutated. Closure comes from
// the shared graph module (tools/skill-graph.mjs); skill enumeration + front-
// matter stripping are reused from scripts/install/discovery.mjs so "what is a
// skill and where does it live" has one implementation.
import { cp, mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { discoverSkills, stripFrontmatter } from '../../scripts/install/discovery.mjs';
import { parseRequiredSkills, transitiveClosure } from '../skill-graph.mjs';

// Copy the closure of `skillName` into <fixtureRoot>/<driver.discoverySubdir>/<name>/
// and seed any case `inputs` into the fixture working dir (fixtureRoot). Returns
// the sorted projected closure names. Throws if the skill is not in the library.
export async function buildFixture({ skillName, skillsRoot, driver, fixtureRoot, inputs = [] }) {
  const skills = await discoverSkills(skillsRoot);
  const srcByName = new Map(skills.map((s) => [s.name, s.srcDir]));
  if (!srcByName.has(skillName)) {
    throw new Error(`unknown skill: ${skillName}`);
  }
  const graph = new Map(
    skills.map((s) => [s.name, parseRequiredSkills(stripFrontmatter(s.text))]),
  );
  const closure = [...transitiveClosure(graph, skillName)].sort();

  const skillsDest = join(fixtureRoot, driver.discoverySubdir);
  await mkdir(skillsDest, { recursive: true });
  for (const name of closure) {
    await cp(srcByName.get(name), join(skillsDest, name), { recursive: true });
  }

  for (const input of inputs) {
    const dest = join(fixtureRoot, input.path);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, input.content);
  }
  return closure;
}

// Stable content hash of a directory tree: for each file (sorted by rel path)
// hash "<relPath>\0<sha256(content)>\n". Used to prove sources are unmodified.
export async function hashTree(dir) {
  const files = [];
  async function walk(rel) {
    const entries = await readdir(join(dir, rel), { withFileTypes: true });
    for (const e of entries) {
      const childRel = rel ? join(rel, e.name) : e.name;
      if (e.isDirectory()) await walk(childRel);
      else files.push(childRel);
    }
  }
  await walk('');
  files.sort();
  const h = createHash('sha256');
  for (const rel of files) {
    const content = await readFile(join(dir, rel));
    h.update(rel);
    h.update('\0');
    h.update(createHash('sha256').update(content).digest('hex'));
    h.update('\n');
  }
  return h.digest('hex');
}

// Committed trees a run must never mutate (the fixture/runs area lives elsewhere).
// Composes hashTree over each; a missing dir hashes to '' so this works in any repo.
export async function hashGuardedTrees(repoRoot, dirs) {
  const parts = [];
  for (const d of dirs) {
    let h = '';
    try { h = await hashTree(join(repoRoot, d)); }
    catch (err) { if (err.code !== 'ENOENT') throw err; }
    parts.push(`${d}:${h}`);
  }
  return parts.join('\n');
}
