// Projects a skill + its transitive `## Required skills` closure UNMODIFIED
// into a disposable per-harness fixture, shaped to that harness's discovery
// path. Sources are only READ (copied out) — never mutated. Closure comes from
// the shared graph module (tools/skill-graph.mjs); skill enumeration + front-
// matter stripping are reused from scripts/install/discovery.mjs so "what is a
// skill and where does it live" has one implementation.
import { cp, mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
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

  gitInitFixture(fixtureRoot);
  return closure;
}

// opencode's `run` does not confine to the process cwd: it walks up from cwd
// looking for a `.git` dir and resolves a project via its own registry, so a
// non-git fixture cwd can resolve to an unrelated project and escape the
// fixture entirely (root cause of the opencode fixture-escape bug). Making
// every fixture a real, pinned git repo — committed once fully populated, so
// nothing case-specific is left uncommitted — gives the walk-up something to
// bind to right there. Harness-agnostic (applies regardless of which driver
// built this fixture): codex already tolerates a git fixture via
// --skip-git-repo-check, and claude-code confines to cwd regardless of git.
function gitInitFixture(fixtureRoot) {
  const runGit = (args) => {
    const r = spawnSync('git', args, { cwd: fixtureRoot, encoding: 'utf8' });
    if (r.status !== 0) {
      throw new Error(`git ${args.join(' ')} failed in fixture ${fixtureRoot}: ${r.stderr || r.error?.message}`);
    }
    return r;
  };
  runGit(['init', '-q']);
  // Local, fixture-scoped identity — never touches the developer's real git
  // config (no --global), so commits succeed even with no user-level identity.
  runGit(['config', 'user.email', 'test-runner@fixture.invalid']);
  runGit(['config', 'user.name', 'test-runner fixture']);
  runGit(['add', '-A']);
  // -c commit.gpgsign=false: this is a disposable, synthetic baseline commit
  // inside a throwaway tmpdir fixture (not a real project commit), so it must
  // not hang or fail in dev environments with global commit signing enabled.
  runGit(['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'fixture baseline']);
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
