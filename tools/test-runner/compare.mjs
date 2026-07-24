// Cross-harness outcome comparison (v2 acceptance seam, spec §Parity and
// distribution): the same scenario on Claude Code, Codex, and OpenCode must
// yield EQUIVALENT repository outcomes. Equivalence is content equality per
// case-declared path — a stable digest per file or directory tree — including
// equal ABSENCE (refusal scenarios must refuse everywhere). Observable
// repository state only; prose is never compared.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { hashTree } from './fixture.mjs';

// Digest of one path inside a leg's fixture: sha256 for a file, the stable
// tree hash for a directory, null when absent — so "absent" is a comparable
// outcome, distinct from every content digest.
async function digestPath(root, relPath) {
  const abs = join(root, relPath);
  let s;
  try {
    s = await stat(abs);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  if (s.isDirectory()) return `tree:${await hashTree(abs)}`;
  return `file:${createHash('sha256').update(await readFile(abs)).digest('hex')}`;
}

// One entry per declared path. Requires at least two executed legs to mean
// anything — fewer yields `skipped` (recorded, never a vacuous verdict).
export async function compareOutcomes(paths, legs) {
  const results = [];
  for (const path of paths) {
    if (legs.length < 2) {
      results.push({ path, status: 'skipped', pass: true, detail: 'fewer than two executed harnesses — nothing to compare' });
      continue;
    }
    const digests = [];
    for (const leg of legs) {
      digests.push({ id: leg.id, digest: await digestPath(leg.fixtureRoot, path) });
    }
    const first = digests[0].digest;
    const pass = digests.every((d) => d.digest === first);
    const detail = pass
      ? ''
      : `outcome for ${path} diverges: ${digests.map((d) => `${d.id}=${d.digest === null ? 'absent' : d.digest.slice(0, 17)}`).join(', ')}`;
    results.push({ path, status: 'compared', pass, detail });
  }
  return results;
}

export function comparisonsPassed(comparisons) {
  return comparisons.every((c) => c.status !== 'compared' || c.pass);
}
