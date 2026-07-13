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
