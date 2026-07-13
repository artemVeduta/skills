// Declarative harness registry — the single source of truth for the wizard and
// the README development-links guidance. Entries carry installation metadata only.
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
    sharedStorage: false,
  },
  {
    id: 'codex',
    displayName: 'Codex',
    // NOTE: confirm Codex's actual skill directory before relying on it in anger.
    skillDirs: { global: 'skills' },
    configRoot: {
      env: 'CODEX_HOME',
      defaults: [{ id: 'default', dir: '.codex' }],
    },
    scopes: ['global'],
    channels: ['development', 'portable', 'native'],
    customProfileValidation: { allowHomeRelative: true },
    sharedStorage: false,
  },
  {
    id: 'agents',
    displayName: 'Shared agents directory',
    skillDirs: { global: 'skills' },
    configRoot: { env: null, defaults: [{ id: 'shared', dir: '.agents' }] },
    scopes: ['global'],
    channels: ['development', 'portable'],
    customProfileValidation: { allowHomeRelative: true },
    sharedStorage: true, // ~/.agents/skills doubles as the portable CLI's own storage
  },
];

export function findEntry(registry, id) {
  return registry.find((e) => e.id === id) || null;
}
