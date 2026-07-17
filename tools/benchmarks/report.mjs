// tools/benchmarks/report.mjs
// Deterministic markdown report for ONE case (spec §6 step 4, AC-3). Pure: every
// value comes from the committed summary JSON — no Date, no git, no re-run —
// byte-identical output from identical input. Per decision 6 of the benchmark ADR
// there is NO cross-case blend: one summary in, one case's report out.
function pct(rate, passes, total) {
  return `${Math.round(rate * 100)}% (${passes}/${total})`;
}

export function renderReport(summary) {
  const lines = [];
  lines.push(`# Benchmark report — ${summary.case.skill} (${summary.preset})`);
  lines.push('');
  lines.push(`- Case: ${summary.case.skill} / ${summary.case.name}`);
  lines.push(`- Preset: ${summary.preset} (${summary.trials} trial${summary.trials === 1 ? '' : 's'})`);
  lines.push(`- Timestamp: ${summary.timestamp}`);
  lines.push(`- Commit: ${summary.commit} (${summary.dirty ? 'dirty' : 'clean'})`);
  const totalMarks = summary.harnesses.reduce((n, h) => n + h.trials.length, 0);
  const totalPasses = summary.harnesses.reduce((n, h) => n + h.trials.filter((t) => t.pass).length, 0);
  lines.push(`- Overall pass rate: ${pct(summary.overallPassRate, totalPasses, totalMarks)}`);
  lines.push('');
  lines.push('## Harnesses');
  lines.push('');
  lines.push('| Harness | Model | Version | Per-trial | Pass rate |');
  lines.push('|---|---|---|---|---|');
  for (const h of summary.harnesses) {
    const perTrial = h.trials
      .map((t) => (t.pass ? 'pass' : t.status === 'executed' ? 'fail' : t.status))
      .join(', ');
    const passes = h.trials.filter((t) => t.pass).length;
    lines.push(`| ${h.id} | ${h.model ?? ''} | ${h.version ?? ''} | ${perTrial} | ${pct(h.passRate, passes, h.trials.length)} |`);
  }
  lines.push('');
  return lines.join('\n');
}
