import { execFileSync } from 'node:child_process';

// Report the checkout's Git provenance: commit SHA, symbolic ref, and dirty flag.
// Returns null when the checkout is not a Git working tree (best-effort provenance;
// checkout links never depend on Git). Pure of process state except the injected exec.
export function checkoutProvenance(checkout, { exec = execFileSync } = {}) {
  const git = (args) =>
    exec('git', args, { cwd: checkout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    const commit = git(['rev-parse', 'HEAD']);
    const ref = git(['rev-parse', '--abbrev-ref', 'HEAD']);
    const dirty = git(['status', '--porcelain']).length > 0;
    return { commit, ref, dirty };
  } catch {
    return null;
  }
}

export function formatProvenance(prov) {
  if (!prov) return 'Checkout provenance: not a Git working tree';
  const ref = prov.ref && prov.ref !== 'HEAD' ? ` (${prov.ref})` : ' (detached HEAD)';
  return `Checkout provenance: ${prov.commit}${ref}${prov.dirty ? ' [dirty]' : ''}`;
}
