// tools/benchmarks/models.mjs
// The single, easily-editable per-harness MODEL KNOB for benchmark live runs.
// EDIT THIS MAP before a run to change which model each harness drives. These
// ids override each driver's baked-in defaultModel (tools/test-runner/drivers.mjs)
// via the supported harnessSelections {id, model} override: runHarness resolves
// `model ?? driver.defaultModel`, so a non-null value here reaches the actual
// --model/-m argument. That is how we bypass claude-code's MALFORMED dotted
// default (claude-opus-4.8) without modifying the wrap-frozen drivers.
//
// Kept separate from presets.mjs on purpose (SoC/SRP): presets.mjs owns WHAT
// harness set + HOW MANY trials; this file owns WHICH model per harness. A model
// is a per-harness axis shared across every preset, not a per-preset dimension.
export const MODELS = {
  'claude-code': 'claude-opus-4-8', // dashed id; NOT the malformed dotted claude-opus-4.8
  'codex': 'gpt-5.6-sol', // served by codex CLI 0.144.5
  'opencode': 'opencode-go/deepseek-v4-pro', // opencode-go provider prefix is load-bearing
};

// Returns the pinned model for a harness id, or null when the id is not in the
// map. null is a deliberate, composable fallback: harnessSelections carries it
// straight through to runHarness's `model ?? driver.defaultModel`, so an
// unmapped harness cleanly falls back to its driver default rather than crashing
// the run.
export function modelFor(id) {
  return MODELS[id] ?? null;
}
