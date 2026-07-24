import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

// Expand a leading ~ against home; leave other paths untouched.
export function expandHome(p, home = homedir()) {
  if (p === '~') return home;
  if (p.startsWith('~/')) return join(home, p.slice(2));
  return p;
}

// Resolve a profile selector to a configuration root.
// selector: a default-profile id (e.g. "personal"), or a path (custom profile).
export function resolveProfile(entry, selector, { home = homedir(), env = process.env } = {}) {
  if (selector && (selector.includes('/') || selector.startsWith('~'))) {
    return {
      harnessId: entry.id,
      profileId: 'custom',
      configRoot: resolve(expandHome(selector, home)),
      custom: true,
    };
  }
  const def = entry.configRoot.defaults.find((d) => d.id === selector);
  if (!def) return null;
  const envVar = entry.configRoot.env;
  const configRoot = envVar && env[envVar] ? resolve(env[envVar]) : join(home, def.dir);
  return { harnessId: entry.id, profileId: def.id, configRoot };
}

// (harness, profile, scope) -> absolute skill directory where links are written.
export function resolveSkillDir(entry, profile, scope, { projectDir = process.cwd() } = {}) {
  if (scope === 'project') {
    if (!entry.skillDirs.project) return null;
    return resolve(join(projectDir, entry.skillDirs.project));
  }
  return resolve(join(profile.configRoot, entry.skillDirs.global)); // global: relative to config root
}

// Absolute directories a harness ALSO discovers (OpenCode reads Claude's and the
// shared .agents locations). A selected Claude/Codex placement in one of these
// already exposes the pack, so the OpenCode target is redundant.
export function resolveReadDirs(entry, scope, { home = homedir(), projectDir = process.cwd() } = {}) {
  const templates = entry.readsSkillDirs?.[scope] ?? [];
  return templates.map((p) =>
    scope === 'project' ? resolve(join(projectDir, p)) : resolve(expandHome(p, home)),
  );
}

// Reduce resolved selections to the deduplicated set of write placements.
// 1. Selections resolving to the same directory collapse to one (first wins).
// 2. An OpenCode-style selection (one that declares `readsSkillDirs`) is dropped
//    when another selected harness already writes into a directory it reads, so
//    OpenCode adds no placement already exposed by a selected Claude or Codex target.
export function reduceSelections(selections, { home = homedir(), projectDir = process.cwd() } = {}) {
  const exposedByOthers = new Set(
    selections.filter((s) => !s.entry.readsSkillDirs).map((s) => s.skillDir),
  );
  const kept = selections.filter((s) => {
    if (!s.entry.readsSkillDirs) return true;
    const readDirs = resolveReadDirs(s.entry, s.scope, { home, projectDir });
    return !readDirs.some((d) => exposedByOthers.has(d));
  });
  const seen = new Set();
  const out = [];
  for (const s of kept) {
    if (seen.has(s.skillDir)) continue;
    seen.add(s.skillDir);
    out.push(s);
  }
  return out;
}
