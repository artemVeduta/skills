// Development-links README guidance, generated from the harness registry so the
// docs and the installer cannot drift. Pure functions; registry is injected.
export const README_BEGIN = '<!-- BEGIN dev-install (generated from registry) -->';
export const README_END = '<!-- END dev-install -->';

export function renderInstallSection(registry) {
  const harnesses = registry.map((e) => `- **${e.displayName}** (\`${e.id}\`)`).join('\n');
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

export function validateReadme(registry, text) {
  const start = text.indexOf(README_BEGIN);
  const end = text.indexOf(README_END);
  if (start === -1 || end === -1 || end < start) {
    return { ok: false, reason: 'dev-install markers not found in README' };
  }
  const block = text.slice(start + README_BEGIN.length, end).trim();
  const expected = renderInstallSection(registry).trim();
  return block === expected ? { ok: true } : { ok: false, reason: 'README dev-install block does not match the registry' };
}

export function writeReadme(registry, text) {
  const start = text.indexOf(README_BEGIN);
  const end = text.indexOf(README_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error('dev-install markers not found in README; add them around the Development links block first');
  }
  const before = text.slice(0, start + README_BEGIN.length);
  const after = text.slice(end);
  return `${before}\n${renderInstallSection(registry)}\n${after}`;
}
