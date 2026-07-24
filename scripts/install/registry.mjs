// Declarative harness registry — the single source of truth for the wizard and
// the README development-links guidance. It models the three harness products
// (Claude Code, Codex, OpenCode) and their exact supported project/global skill
// paths. Entries carry installation metadata only; the wizard grows no per-harness
// branch for anything expressible here.
//
// Canonical checkout placements (OKF docs skill-suite v2):
//   Claude Code  project .claude/skills   global <CLAUDE_CONFIG_DIR>/skills (default ~/.claude/skills)
//   Codex        project .agents/skills    global ~/.agents/skills
//   OpenCode     project .agents/skills    global ~/.agents/skills
//
// OpenCode also discovers Claude's and the shared .agents locations, so `readsSharedWith`
// names the products whose canonical skill directories already expose the pack to it; a
// selected OpenCode target that would only re-expose one of those adds no placement. The
// directories are derived from those products' own `skillDirs`/`configRoot`, so every
// placement path keeps a single definition and the two cannot drift out of sync.
export const REGISTRY = [
  {
    id: 'claude-code',
    displayName: 'Claude Code',
    skillDirs: { global: 'skills', project: '.claude/skills' },
    configRoot: {
      env: 'CLAUDE_CONFIG_DIR',
      defaults: [
        { id: 'personal', dir: '.claude' },
        { id: 'work', dir: '.claude-work' },
      ],
    },
    scopes: ['global', 'project'],
    channels: ['development', 'portable', 'native'],
    customProfileValidation: { allowHomeRelative: true },
  },
  {
    id: 'codex',
    displayName: 'Codex',
    // Codex discovers the cross-client .agents/skills tree (project and global).
    skillDirs: { global: 'skills', project: '.agents/skills' },
    configRoot: { env: null, defaults: [{ id: 'default', dir: '.agents' }] },
    scopes: ['global', 'project'],
    channels: ['development', 'portable', 'native'],
    customProfileValidation: { allowHomeRelative: true },
  },
  {
    id: 'opencode',
    displayName: 'OpenCode',
    skillDirs: { global: 'skills', project: '.agents/skills' },
    configRoot: { env: null, defaults: [{ id: 'default', dir: '.agents' }] },
    scopes: ['global', 'project'],
    channels: ['development', 'portable'], // no native aggregate plugin for OpenCode
    // Products whose canonical (default-root) skill directories OpenCode also reads, so
    // a selected Claude/Codex placement there already exposes the pack and OpenCode
    // contributes no redundant placement. Paths are sourced from those entries'
    // skillDirs/configRoot — never re-typed here.
    readsSharedWith: ['claude-code', 'codex'],
    customProfileValidation: { allowHomeRelative: true },
  },
];

export function findEntry(registry, id) {
  return registry.find((e) => e.id === id) || null;
}
