import { lstat, realpath } from 'node:fs/promises';
import { join } from 'node:path';

// Decide what will happen to one link destination.
async function linkAction(dest) {
  try {
    const st = await lstat(dest);
    return st.isSymbolicLink() ? 'replace-symlink' : 'replace-nonsymlink';
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
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

// Refuse a skill directory that resolves into the checkout — we would write the
// per-skill links back into the working copy. Returns null when it is safe.
export async function selfSymlinkGuard(skillDir, checkout) {
  let realCheckout;
  try {
    realCheckout = await realpath(checkout);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return null;
  }
  let realTarget;
  try {
    realTarget = await realpath(skillDir);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return null; // does not exist yet → cannot resolve into the repo
  }
  if (realTarget === realCheckout || realTarget.startsWith(realCheckout + '/')) {
    return {
      skillDir,
      resolved: realTarget,
      message: `${skillDir} resolves into this repository (${realTarget}); refusing to write links into the working copy. Remove it (rm "${skillDir}") and re-run.`,
    };
  }
  return null;
}
