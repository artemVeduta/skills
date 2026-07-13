import { lstat } from 'node:fs/promises';
import { join } from 'node:path';

// Decide what will happen to one link destination.
async function linkAction(dest) {
  try {
    const st = await lstat(dest);
    return st.isSymbolicLink() ? 'replace-symlink' : 'replace-nonsymlink';
  } catch {
    return 'create';
  }
}

// Build the per-target plan: one link per discovered skill.
export async function planTarget(entry, profile, scope, skills, skillDir) {
  const links = [];
  for (const s of skills) {
    const dest = join(skillDir, s.name);
    links.push({ name: s.name, src: s.srcDir, dest, action: await linkAction(dest) });
  }
  return {
    harnessId: entry.id,
    profileId: profile.profileId,
    scope,
    skillDir,
    sharedStorage: !!entry.sharedStorage,
    custom: !!profile.custom,
    links,
  };
}
