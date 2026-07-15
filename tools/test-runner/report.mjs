// Pure human report + exit-code decision for a run result. The runner is
// GATING: the exit code is load-bearing and derives ONLY from deterministic
// assertion results and source immutability — never from advisory signal.
import { allPassed } from './oracle.mjs';

export function formatRunReport(run) {
  const lines = [`test-runner — case: ${run.skill}${run.dryRun ? ' (dry run)' : ''}`];
  for (const h of run.harnesses) {
    switch (h.status) {
      case 'skipped':
        lines.push(`  ${h.id}: SKIPPED (${h.skipReason})`);
        break;
      case 'dry-run': {
        // Show exactly what WOULD execute: full args (long values elided for
        // readability — the prompt is a whole file) plus the profile env.
        const shownArgs = h.invocation.args.map((a) => (a.length > 80 ? `${a.slice(0, 77)}...` : a));
        lines.push(`  ${h.id}: would run \`${[h.invocation.command, ...shownArgs].join(' ')}\` with ${h.closure.length} skill(s): ${h.closure.join(', ')}`);
        for (const [k, v] of Object.entries(h.invocation.env)) lines.push(`    env ${k}=${v}`);
        if (!h.sourcesUnmodified) lines.push('    ! canonical sources were modified');
        break;
      }
      case 'executed': {
        if (h.exitStatus !== 0) {
          lines.push(`    ! harness exited abnormally (status ${h.exitStatus}${h.timedOut ? ', timed out' : ''}${h.harnessError ? ': ' + h.harnessError : ''})`);
        }
        const failed = h.assertions.filter((r) => !r.pass);
        const pass = h.assertions.length > 0 && failed.length === 0 && h.sourcesUnmodified;
        lines.push(`  ${h.id}: ${pass ? 'PASS' : 'FAIL'} (${h.assertions.length - failed.length}/${h.assertions.length} assertions)`);
        lines.push(`    provenance: model ${h.model}, harness ${h.harnessVersion}`);
        if (!h.sourcesUnmodified) lines.push('    ! canonical sources were modified');
        for (const r of failed) lines.push(`    ✗ ${r.detail}`);
        break;
      }
    }
  }
  return lines.join('\n');
}

export function exitCodeFor(run) {
  if (run.dryRun) {
    return run.harnesses.every((h) => h.sourcesUnmodified) ? 0 : 1;
  }
  const executed = run.harnesses.filter((h) => h.status === 'executed');
  if (executed.length === 0) return 1; // nothing ran — cannot gate
  const ok = executed.every((h) => h.assertions.length > 0 && h.sourcesUnmodified && allPassed(h.assertions));
  return ok ? 0 : 1;
}
