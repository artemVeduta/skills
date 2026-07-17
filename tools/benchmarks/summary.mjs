// tools/benchmarks/summary.mjs
import { allPassed } from '../test-runner/oracle.mjs';

// A single (harness, trial) mark passes iff #24's own gate would pass it: the
// harness actually executed (not skipped), the guarded source trees were
// unmodified, and every deterministic assertion passed — mirroring exitCodeFor in
// tools/test-runner/report.mjs. Harness process exit status is deliberately NOT
// part of this (assertions + source immutability are the verdict).
export function trialPassed(leg) {
  return leg.status === 'executed'
    && leg.sourcesUnmodified === true
    && Array.isArray(leg.assertions)
    && leg.assertions.length > 0
    && allPassed(leg.assertions);
}

// Pure aggregation into the committed summary shape (spec §6 step 3). No disk, no
// git, no runCase — the impure orchestrator (run.mjs) feeds it fully-read `legs`.
// Single-arm only: there is no without-skill data anywhere here (§3).
export function aggregate({
  presetName, harnessIds, skillName, caseName, trialCount, provenance, legs,
}) {
  const harnesses = harnessIds.map((id) => {
    const forId = legs.filter((l) => l.id === id).sort((a, b) => a.trial - b.trial);
    const trials = forId.map((l) => ({
      trial: l.trial,
      status: l.status,
      pass: trialPassed(l),
      sourcesUnmodified: l.status === 'executed' ? l.sourcesUnmodified === true : null,
    }));
    const passes = trials.filter((t) => t.pass).length;
    const first = forId[0] ?? {};
    return {
      id,
      model: first.model ?? null,
      version: first.version ?? null,
      trials,
      passRate: trials.length ? passes / trials.length : 0,
    };
  });
  const allMarks = harnesses.flatMap((h) => h.trials);
  const overallPasses = allMarks.filter((t) => t.pass).length;
  return {
    case: { skill: skillName, name: caseName },
    preset: presetName,
    trials: trialCount,
    timestamp: provenance.timestamp,
    commit: provenance.commit,
    dirty: provenance.dirty,
    harnesses,
    overallPassRate: allMarks.length ? overallPasses / allMarks.length : 0,
  };
}
