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
    // Native aggregate-plugin adapter (Claude Code marketplace CLI). Present only on
    // harnesses that ship a native plugin; the command verbs and manifest paths are
    // the single source of truth the README native guidance and its tests both read.
    native: {
      cli: 'claude',
      installVerb: 'install',
      updateVerb: 'update',
      pluginManifest: '.claude-plugin/plugin.json',
      marketplaceManifest: '.claude-plugin/marketplace.json',
      namespaced: true, // installs as /skills:<skill>
    },
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
    native: {
      cli: 'codex',
      installVerb: 'add',
      updateVerb: 'upgrade',
      pluginManifest: '.codex-plugin/plugin.json',
      // Not the Claude catalog path, which would collide with the Claude marketplace.
      marketplaceManifest: '.agents/plugins/marketplace.json',
      namespaced: false,
    },
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

// The one managed-pack identity shared by both managed channels. The portable CLI
// installs from the `repo` slug; the native plugin is `pluginId` in marketplace
// `marketplaceId`. Keeping these in one place lets the README guidance, the plugin
// manifests, and their tests agree on a single set of ids.
export const MANAGED_PACKAGE = {
  repo: 'artemVeduta/skills',
  pluginId: 'skills',
  marketplaceId: 'artemveduta',
};

// The supported portable install: the whole pack, never a per-skill picker.
export function portableCommand(pkg = MANAGED_PACKAGE) {
  return `npx skills@latest add ${pkg.repo} --skill '*'`;
}

// Derive a native harness's exact marketplace add / install / update operations from
// its adapter verbs and the shared package identity. This is the definition the
// README documents and the manifest tests verify against the real manifest ids.
export function nativeCommands(entry, pkg = MANAGED_PACKAGE) {
  const { cli, installVerb, updateVerb } = entry.native;
  return {
    marketplaceAdd: `${cli} plugin marketplace add ${pkg.repo}`,
    install: `${cli} plugin ${installVerb} ${pkg.pluginId}@${pkg.marketplaceId}`,
    update: `${cli} plugin marketplace ${updateVerb} ${pkg.marketplaceId}`,
  };
}

// Harnesses offered the portable whole-pack channel (all three products).
export function portableHarnesses(registry) {
  return registry.filter((e) => e.channels.includes('portable'));
}

// Harnesses that ship a native aggregate plugin (Claude Code and Codex only).
export function nativeHarnesses(registry) {
  return registry.filter((e) => e.channels.includes('native') && e.native);
}
