const ACTION_TAG = {
  create: 'create',
  'replace-symlink': 'replace link',
  'replace-nonsymlink': 'REPLACE non-symlink',
};

export function renderPreview(plan) {
  const lines = ['Installation preview', '====================', `Skills to link: ${plan.skills.length}`];
  for (const t of plan.targets) {
    lines.push('', `Harness ${t.harnessId} · profile ${t.profileId} · scope ${t.scope}`, `  Skill directory: ${t.skillDir}`);
    for (const l of t.links) lines.push(`    [${ACTION_TAG[l.action]}] ${l.name} -> ${l.src}`);
  }
  if (plan.warnings.length) {
    lines.push('', 'Warnings:');
    for (const w of plan.warnings) lines.push(`  ! ${w}`);
  }
  lines.push('', 'Nothing has been changed yet.');
  return lines.join('\n');
}
