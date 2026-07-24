import { mkdir, lstat, rm, symlink, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

// Reproduce `ln -sfn src dest`: force, no-dereference of an existing link.
export async function linkSkill(src, dest) {
  await mkdir(dirname(dest), { recursive: true });
  try {
    const st = await lstat(dest);
    if (st.isSymbolicLink()) await unlink(dest); // replace the link in place
    else await rm(dest, { recursive: true, force: true }); // real (non-symlink) collision
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    /* nothing there yet */
  }
  await symlink(src, dest);
}

// Remove a stale checkout-owned link, tolerating its prior disappearance: the
// plan→confirm→apply gap lets the user delete it first, and a vanished link is
// already in the desired end state (idempotent, like linkSkill's ENOENT swallow).
async function prune(dest) {
  try {
    await unlink(dest);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

export async function applyTarget(target) {
  await mkdir(target.skillDir, { recursive: true });
  for (const p of target.prunes ?? []) await prune(p.dest); // remove stale checkout-owned links
  for (const l of target.links) await linkSkill(l.src, l.dest);
}
