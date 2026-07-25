---
type: Reference
title: Benchmark run artifacts
description: Where committed benchmark summary JSON and rendered markdown reports live, and what schema they follow.
resource: tools/benchmarks/
timestamp: 2026-07-25
---

# Benchmark run artifacts

The benchmark test + report flow (`npm run bench`, `tools/benchmarks/run.mjs`)
commits two artifacts per run, so a run's verdict and provenance are shared truth
without churning the knowledge graph with per-run data. The two homes below are the
flow's write DESTINATIONS rather than populated directories: `runBench` resolves each
from its own path constant and creates it recursively immediately before writing, so a
home exists in the tree only once a run has recorded into it — and consumers tolerate
its absence (`checkBenchmarkStaleness` in `scripts/release.mjs` reads a missing
summaries directory as "no committed full-preset summaries yet" and skips the baseline
freshness check instead of failing).

- `tools/benchmarks/summaries/` — one summary JSON per run: preset name and trial
  count, per-harness per-trial pass/fail marks, per-harness and overall pass rate,
  and the provenance identity set (ISO timestamp; library commit SHA + dirty flag;
  case id = skill + case name; per harness the name, version, and model id). The
  per-harness/per-trial provenance is #24's `run.json` shape (`writeRunJson` in
  `tools/test-runner.mjs`), aggregated — not a second scheme. The per-harness model
  is a run-time knob, not a driver default: `tools/benchmarks/models.mjs` maps each
  harness id to the model it drives, threaded into `runCase` via
  `harnessSelections {id, model}`. Single-arm: no without-skill data.
- `tools/benchmarks/reports/` — one deterministically-rendered markdown report per
  run, generated from the summary JSON, byte-identical from identical input, scoped
  to one case (no cross-case blend).

Raw per-run transcripts stay git-ignored under `tools/runs/` (unchanged from #24);
only the summary JSON and the report are committed. The run spends real inference
against locally-authenticated harness profiles, so it is local-only and never wired
into CI.

Governing concepts — retention, provenance, and no-blend decisions:
[Benchmark metrics and comparison design](/decisions/benchmark-metrics-and-comparison-design.md);
end-to-end map of what a run does:
[Benchmark and test run flow handoff](/superpowers/handoffs/2026-07-17-benchmark-run-flow-handoff.md).

# Citations

- `tools/benchmarks/summaries/` and `tools/benchmarks/reports/` — the committed
  artifact homes (schema in `tools/benchmarks/summary.mjs`; renderer in
  `tools/benchmarks/report.mjs`).
- `tools/benchmarks/run.mjs` — the flow entry point (`npm run bench`).
- `tools/benchmarks/models.mjs` — the per-harness model knob threaded into each run.
