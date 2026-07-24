import { lstat, readlink, readdir, realpath, readFile } from 'node:fs/promises';
import { join, dirname, resolve, sep } from 'node:path';

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

// A symlink is owned by this checkout when its (possibly dangling) target points
// into <checkout>/skills. readlink is used rather than realpath so a stale link to
// a since-removed skill still resolves its literal target for the ownership test.
async function ownedByCheckout(dest, skillsRoot) {
  let raw;
  try {
    raw = await readlink(dest);
  } catch {
    return false;
  }
  const target = resolve(dirname(dest), raw);
  return target === skillsRoot || target.startsWith(skillsRoot + sep);
}

// Stale links to prune: entries in the skill directory that are symlinks OWNED by
// this checkout but are no longer pack members. Real (non-symlink) entries and
// links owned by another checkout are never pruned — they are not ours to remove.
async function planPrunes(skillDir, memberNames, checkout) {
  const skillsRoot = resolve(join(checkout, 'skills'));
  let entries;
  try {
    entries = await readdir(skillDir, { withFileTypes: true });
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return [];
  }
  const prunes = [];
  for (const e of entries) {
    if (memberNames.has(e.name)) continue; // current member: handled as a link action
    const dest = join(skillDir, e.name);
    let st;
    try {
      st = await lstat(dest);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      continue;
    }
    if (!st.isSymbolicLink()) continue; // unrelated real entry: never remove
    if (await ownedByCheckout(dest, skillsRoot)) prunes.push({ name: e.name, dest });
  }
  prunes.sort((a, b) => a.name.localeCompare(b.name));
  return prunes;
}

// Build the per-target plan: one link per discovered skill, plus any stale
// checkout-owned links to prune so a rerun converges on current pack membership.
export async function planTarget(entry, profile, scope, skills, skillDir, checkout) {
  const links = [];
  for (const s of skills) {
    const dest = join(skillDir, s.name);
    links.push({ name: s.name, src: s.srcDir, dest, action: await linkAction(dest) });
  }
  const memberNames = new Set(skills.map((s) => s.name));
  const prunes = await planPrunes(skillDir, memberNames, checkout);
  return {
    harnessId: entry.id,
    profileId: profile.profileId,
    scope,
    skillDir,
    custom: !!profile.custom,
    links,
    prunes,
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

// A profile uses exactly one package shape; checkout links never overlay a managed
// portable or native install. A managed channel records ownership in a
// `.okf-managed.json` marker at its managed root (the skill directory for portable,
// the configuration root — the skill directory's parent — for a native plugin).
// Returns the conflict (path + channel) when one is detected, else null.
const MANAGED_MARKER = '.okf-managed.json';

export async function managedShapeGuard(skillDir) {
  for (const dir of [skillDir, dirname(skillDir)]) {
    const marker = join(dir, MANAGED_MARKER);
    let text;
    try {
      text = await readFile(marker, 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      continue;
    }
    let channel = 'managed';
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.channel === 'string') channel = parsed.channel;
    } catch {
      /* corrupt marker: still a managed profile, report the generic channel */
    }
    return {
      path: marker,
      channel,
      message: `${skillDir} already holds a ${channel} managed install (${marker}); a profile uses exactly one package shape, so checkout links must not overlay the ${channel} package. Remove the ${channel} install first.`,
    };
  }
  return null;
}
