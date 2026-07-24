import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { findEntry } from './registry.mjs';

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

// Absolute directories a harness ALSO discovers: OpenCode reads the CANONICAL
// (default-root) skill directories of the products named in `readsSharedWith`. Each
// path is derived from that product's own `skillDirs`/`configRoot` via resolveSkillDir,
// so a placement has exactly one definition. Resolution uses the product's canonical
// default config root — never a per-run env override such as CLAUDE_CONFIG_DIR —
// because OpenCode scans the standard locations regardless of how another product is
// configured, so a Claude install into a custom root is NOT discovered by OpenCode.
export function resolveReadDirs(entry, scope, registry, { home = homedir(), projectDir = process.cwd() } = {}) {
  const dirs = [];
  for (const id of entry.readsSharedWith ?? []) {
    const other = findEntry(registry, id);
    const def = other?.configRoot?.defaults?.[0];
    if (!def || !other.skillDirs[scope]) continue;
    dirs.push(resolveSkillDir(other, { configRoot: join(home, def.dir) }, scope, { projectDir }));
  }
  return dirs;
}

// Reduce resolved selections to the deduplicated set of write placements.
// 1. Selections resolving to the same directory collapse to one (first wins).
// 2. An OpenCode-style selection (one that declares `readsSharedWith`) is dropped
//    when another selected harness already writes into a directory it discovers, so
//    OpenCode adds no placement already exposed by a selected Claude or Codex target.
export function reduceSelections(selections, registry, { home = homedir(), projectDir = process.cwd() } = {}) {
  const exposedByOthers = new Set(
    selections.filter((s) => !s.entry.readsSharedWith).map((s) => s.skillDir),
  );
  const kept = selections.filter((s) => {
    if (!s.entry.readsSharedWith) return true;
    const readDirs = resolveReadDirs(s.entry, s.scope, registry, { home, projectDir });
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
