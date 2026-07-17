// tools/benchmarks/presets.mjs
// Single source of truth for benchmark presets (spec §4, §5 D2). BOTH dimensions
// — harness breadth AND trial count — of BOTH presets live only here; neither the
// flow module nor the CLI hard-codes them. At 1 trial with no comparison arm,
// harness breadth is what distinguishes smoke from full today; trial count stays
// an independent, adjustable knob per preset (§4).
export const PRESETS = {
  smoke: { harnesses: ['claude-code'], trials: 1 },
  full: { harnesses: ['claude-code', 'codex', 'opencode'], trials: 1 },
};

export function resolvePreset(name) {
  const preset = PRESETS[name];
  if (!preset) {
    throw new Error(`unknown preset: ${name} (expected one of: ${Object.keys(PRESETS).join(', ')})`);
  }
  return preset;
}
