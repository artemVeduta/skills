const ACTION_TAG = {
  create: 'create',
  'replace-symlink': 'replace link',
  'replace-nonsymlink': 'REPLACE non-symlink',
};

export function renderPreview(plan) {
  const lines = ['Installation preview', '===================='];
  if (plan.provenance) lines.push(plan.provenance);
  lines.push(`Skills to link: ${plan.skills.length}`);
  for (const t of plan.targets) {
    lines.push('', `Harness ${t.harnessId} · profile ${t.profileId} · scope ${t.scope}`, `  Skill directory: ${t.skillDir}`);
    for (const l of t.links) lines.push(`    [${ACTION_TAG[l.action]}] ${l.name} -> ${l.src}`);
    for (const p of t.prunes ?? []) lines.push(`    [remove stale] ${p.name} (checkout-owned link no longer in the pack)`);
  }
  lines.push('', 'Nothing has been changed yet.');
  return lines.join('\n');
}
