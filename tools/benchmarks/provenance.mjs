// tools/benchmarks/provenance.mjs
// The library-identity provenance NOT carried by #24's run.json: ISO timestamp,
// commit SHA, and dirty flag (spec §3, §6 step 3; decision 5 of
// docs/decisions/benchmark-metrics-and-comparison-design.md). run.json supplies
// per-harness model + version; this supplies the run-level library identity.
import { execFileSync } from 'node:child_process';

export function gitProvenance(repoRoot, { exec = execFileSync, now = () => new Date() } = {}) {
  const commit = exec('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const dirty = exec('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim().length > 0;
  return { timestamp: now().toISOString(), commit, dirty };
}
