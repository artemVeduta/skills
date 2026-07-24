// Managed-install README guidance, generated from the harness registry so the docs
// and the installer cannot drift. Three generated blocks — development links,
// portable whole-pack, and native aggregate plugins — each delimited by stable
// markers. Pure functions; the registry is injected.
import {
  portableCommand, nativeCommands, portableHarnesses, nativeHarnesses, MANAGED_PACKAGE,
} from './registry.mjs';

// Oxford-comma join: "A", "A and B", "A, B, and C".
function joinAnd(items) {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

// The mixing incompatibility warning, rendered adjacent to each managed install
// path (a profile uses exactly one package shape). One definition, two call sites.
function mixingWarning(shape, other) {
  return [
    '> **Do not mix package shapes in one profile.** A harness profile that installs',
    `> the pack ${shape} must not also install it ${other} (or overlay checkout`,
    '> links) — the harness would then expose duplicate namespaced and unnamespaced',
    '> capabilities. Pick exactly one package shape per profile.',
  ].join('\n');
}

// Updating a managed pack refreshes only the installed copies; it never reaches back
// into a repository docs-setup configured. One definition, two call sites.
function noMutationNote(what) {
  return [
    `Updating the managed pack refreshes only ${what}; it never mutates a repository`,
    'you previously configured with `docs-setup`. Upgrade a repository\'s docs tooling',
    'by running `docs-setup` again, and reconcile its bundle with `docs-sync` — never',
    'through a pack update.',
  ].join('\n');
}

export function renderInstallSection(registry) {
  const harnesses = registry
    .filter((e) => e.channels.includes('development'))
    .map((e) => `- **${e.displayName}** (\`${e.id}\`)`)
    .join('\n');
  return [
    '### Development links',
    '',
    'Clone the repository and run the interactive installer; it symlinks every',
    'library skill from the working checkout into the harness profiles you select,',
    'so edits and `git pull` reach every linked profile live:',
    '',
    '```bash',
    'git clone https://github.com/artemVeduta/skills.git',
    'cd skills',
    './scripts/install.sh',
    '```',
    '',
    'Supported harnesses:',
    '',
    harnesses,
    '',
    'Update path: `git pull` (no reinstall).',
  ].join('\n');
}

export function renderPortableSection(registry) {
  const names = portableHarnesses(registry).map((e) => e.displayName);
  return [
    '### Portable pure skills (managed whole-pack)',
    '',
    'Managed, updatable skill copies without cloning the repository, via the upstream',
    '`skills` CLI. Install the complete five-skill pack — the whole pack, never a',
    `per-skill selection — into any supported harness (${joinAnd(names)}):`,
    '',
    '```bash',
    portableCommand(),
    '```',
    '',
    '`--skill \'*\'` installs the whole pack, so every skill\'s `## Required skills`',
    'dependency ships with it. There is no supported per-skill picker: a partial',
    'selection could omit a required capability. The upstream CLI owns project vs.',
    'global scope, its own storage, lock state, and updates (`skills update`).',
    '',
    `Provenance: portable copies are installed from the \`${MANAGED_PACKAGE.repo}\` Git`,
    'repository, so their provenance is a Git commit/ref — the source ref the `skills`',
    'CLI recorded — not a plugin version.',
    '',
    noMutationNote('these managed skill copies'),
    '',
    mixingWarning('through the portable channel', 'as a native plugin'),
  ].join('\n');
}

export function renderNativeSection(registry) {
  const harnesses = nativeHarnesses(registry);
  const lines = [
    '### Native aggregate plugins (managed whole-pack)',
    '',
    'Install the complete five-skill pack as one native plugin; the harness CLI owns',
    'install, caching, namespacing, enablement, and updates, per configuration root',
    `(\`CLAUDE_CONFIG_DIR\` / \`CODEX_HOME\`). Native plugins are available for ${joinAnd(harnesses.map((e) => e.displayName))}`,
    'only. There is no OpenCode native plugin; use the portable channel above for OpenCode.',
    '',
  ];
  for (const entry of harnesses) {
    const c = nativeCommands(entry);
    lines.push(`**${entry.displayName}:**`, '', '```bash', c.marketplaceAdd, c.install, '```', '');
    if (entry.native.namespaced) {
      lines.push('Skills install namespaced (e.g. `/skills:docs-setup`). Update path:', `\`${c.update}\`.`, '');
    } else {
      lines.push(`Update path: \`${c.update}\`.`, '');
    }
  }
  lines.push(
    'Provenance: native copies carry a plugin version/release — both plugin manifests',
    'mirror the release tag — so a `<harness> plugin` listing answers "what version is',
    'installed".',
    '',
    noMutationNote('the installed plugin'),
    '',
    mixingWarning('as a native plugin', 'through the portable channel'),
  );
  return lines.join('\n');
}

// The generated blocks, in document order. Each owns its markers and its renderer;
// validate/write iterate this one list so adding a block is a data change.
export const BLOCKS = [
  {
    name: 'dev-install',
    begin: '<!-- BEGIN dev-install (generated from registry) -->',
    end: '<!-- END dev-install -->',
    render: renderInstallSection,
  },
  {
    name: 'portable-install',
    begin: '<!-- BEGIN portable-install (generated from registry) -->',
    end: '<!-- END portable-install -->',
    render: renderPortableSection,
  },
  {
    name: 'native-install',
    begin: '<!-- BEGIN native-install (generated from registry) -->',
    end: '<!-- END native-install -->',
    render: renderNativeSection,
  },
];

function locate(text, block) {
  const start = text.indexOf(block.begin);
  const end = text.indexOf(block.end);
  if (start === -1 || end === -1 || end < start) return null;
  return { start, end };
}

export function validateReadme(registry, text) {
  for (const b of BLOCKS) {
    const at = locate(text, b);
    if (!at) return { ok: false, reason: `${b.name} markers not found in README` };
    const found = text.slice(at.start + b.begin.length, at.end).trim();
    if (found !== b.render(registry).trim()) {
      return { ok: false, reason: `README ${b.name} block does not match the registry` };
    }
  }
  return { ok: true };
}

export function writeReadme(registry, text) {
  let out = text;
  for (const b of BLOCKS) {
    const at = locate(out, b);
    if (!at) {
      throw new Error(`${b.name} markers not found in README; add them around the block first`);
    }
    const before = out.slice(0, at.start + b.begin.length);
    const after = out.slice(at.end);
    out = `${before}\n${b.render(registry)}\n${after}`;
  }
  return out;
}
