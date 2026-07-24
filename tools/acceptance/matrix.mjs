// The acceptance matrix — the single committed source of truth mapping every
// (channel × harness) distribution cell to its evidence (issue #63 capstone,
// spec §Distribution and update contract / §Acceptance). A cell is ADVERTISED
// (offered as supported by the harness registry, which generates the README
// install blocks) only when it is PROVEN: it carries committed DETERMINISTIC
// packaging evidence AND a committed LIVE behavioral attestation.
//
// This module is pure data + pure predicates. The CI-gated invariant test
// (matrix.test.mjs) reads it and NEVER spawns a harness, so the advertised ==
// proven gate runs in `npm test`/CI while genuinely gating live-verified parity.
// Live evidence is a GENUINE recorded attestation (live-attestations.json);
// absent an attestation a harness's supported cells are pending and WITHHELD.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const CHANNELS = ['portable', 'native', 'checkout'];
export const HARNESSES = ['claude-code', 'codex', 'opencode'];

// The registry (single source of truth for README advertising) names the
// checkout channel `development`; the matrix names it `checkout`.
const CHANNEL_TO_REGISTRY = { portable: 'portable', native: 'native', checkout: 'development' };

// --- deterministic evidence reference groups (DRY: shared across cells) -----
// Each ref is { file, contains }: a committed *.test.mjs the `npm test` globs
// run, plus a stable substring of a test title it must contain. The invariant
// test verifies every ref resolves, so evidence can never silently dangle.

// Whole-pack packaging shared by every managed/checkout cell: dependency
// completeness of the packaged pack and of the projected pack.
const PACK_COMPLETENESS = [
  { file: 'scripts/manifests.test.mjs', contains: 'dependency-complete and self-contained (whole-pack closure)' },
  { file: 'tools/test-runner/static-contract.test.mjs', contains: 'fails a projected pack that omits a required dependency' },
  { file: 'tools/test-runner/static-contract.test.mjs', contains: 'passes a conformant fixture' },
];

// Portable channel: whole-pack shape advertised to all three harnesses, Git-ref
// provenance, and the strict shared-reader contract over the projected pack.
const PORTABLE_EVIDENCE = [
  { file: 'scripts/managed-channels.test.mjs', contains: 'portable section documents the whole-pack shape for all three harnesses' },
  { file: 'scripts/managed-channels.test.mjs', contains: 'portable channel is offered to all three harnesses' },
  { file: 'scripts/managed-channels.test.mjs', contains: 'provenance is stated for both managed forms' },
  ...PACK_COMPLETENESS,
];

// Native channel: the four exact manifest/catalog paths, complete tree, mirrored
// plugin-version provenance, and the verified Claude/Codex operations.
const NATIVE_EVIDENCE = [
  { file: 'scripts/manifests.test.mjs', contains: 'all four documented native manifest/catalog paths exist' },
  { file: 'scripts/manifests.test.mjs', contains: 'both plugin manifests expose the complete skills tree' },
  { file: 'scripts/manifests.test.mjs', contains: 'both plugin manifests carry the same snapshot release version' },
  { file: 'scripts/manifests.test.mjs', contains: 'the documented native operations reference the real manifest ids (verified)' },
  { file: 'scripts/managed-channels.test.mjs', contains: 'native section documents verified Claude+Codex ops and never advertises OpenCode native' },
  ...PACK_COMPLETENESS,
];

// Checkout channel: exact project + global paths, idempotence, safe
// reconciliation, Git provenance, dependency availability, no Git hooks, and the
// portable+checkout / native+checkout refuse-before-mutation guards.
const CHECKOUT_EVIDENCE = [
  { file: 'scripts/install.test.mjs', contains: 'exact global targets' },
  { file: 'scripts/install.test.mjs', contains: 'exact project targets' },
  { file: 'scripts/install.test.mjs', contains: 're-runs are idempotent' },
  { file: 'scripts/install.test.mjs', contains: 'reconciliation converges pack membership without deleting unrelated user content' },
  { file: 'scripts/install.test.mjs', contains: 'inspect and install output report checkout Git provenance' },
  { file: 'scripts/install.test.mjs', contains: 'installs no Git hooks' },
  { file: 'scripts/install.test.mjs', contains: 'a missing canonical dependency rejects the install' },
  { file: 'scripts/install.test.mjs', contains: 'an existing portable managed shape is refused before mutation' },
  { file: 'scripts/install.test.mjs', contains: 'an existing native managed shape is refused before mutation' },
  ...PACK_COMPLETENESS,
];

// Exactly-once discovery evidence, per harness: Claude and Codex each resolve
// their own project/global identity once; OpenCode adds no redundant placement
// and resolves each coincident identity exactly once (dedup).
const DISCOVERY_ONCE = {
  'claude-code': [
    { file: 'scripts/install.test.mjs', contains: 'exact project targets' },
  ],
  codex: [
    { file: 'scripts/install.test.mjs', contains: 'exact project targets' },
  ],
  opencode: [
    { file: 'scripts/install.test.mjs', contains: 'OpenCode adds no placement already exposed by a selected Claude target' },
    { file: 'scripts/install.test.mjs', contains: 'coexisting Claude and Codex project placements expose each identity once' },
    { file: 'scripts/install.test.mjs', contains: 'are deduplicated' },
  ],
};

// Per-harness native manifest validity.
const NATIVE_PER_HARNESS = {
  'claude-code': [{ file: 'scripts/manifests.test.mjs', contains: 'claude plugin manifest is valid and complete' }],
  codex: [{ file: 'scripts/manifests.test.mjs', contains: 'codex plugin manifest is valid and points at the skills tree' }],
};

// Deterministic ABSENCE evidence for the one unsupported cell (native ×
// opencode): the packaging is proven ABSENT rather than silently skipped.
const OPENCODE_NATIVE_ABSENT = [
  { file: 'scripts/manifests.test.mjs', contains: 'OpenCode native plugin packaging is absent (never accepted)' },
  { file: 'scripts/managed-channels.test.mjs', contains: 'OpenCode has no native channel and no native adapter (native install never accepted)' },
];

function supported(channel, harness, evidence) {
  return { channel, harness, support: 'supported', live: 'behavioral', deterministic: evidence };
}

// The matrix. Every (channel × harness) combination appears exactly once.
export const CELLS = [
  supported('portable', 'claude-code', PORTABLE_EVIDENCE),
  supported('portable', 'codex', PORTABLE_EVIDENCE),
  supported('portable', 'opencode', PORTABLE_EVIDENCE),

  supported('native', 'claude-code', [...NATIVE_EVIDENCE, ...NATIVE_PER_HARNESS['claude-code']]),
  supported('native', 'codex', [...NATIVE_EVIDENCE, ...NATIVE_PER_HARNESS.codex]),
  { channel: 'native', harness: 'opencode', support: 'unsupported', live: 'absence', deterministic: OPENCODE_NATIVE_ABSENT },

  supported('checkout', 'claude-code', [...CHECKOUT_EVIDENCE, ...DISCOVERY_ONCE['claude-code']]),
  supported('checkout', 'codex', [...CHECKOUT_EVIDENCE, ...DISCOVERY_ONCE.codex]),
  supported('checkout', 'opencode', [...CHECKOUT_EVIDENCE, ...DISCOVERY_ONCE.opencode]),
];

export function cellFor(channel, harness) {
  return CELLS.find((c) => c.channel === channel && c.harness === harness) || null;
}

// Resolve a cell's deterministic evidence: each ref's file must exist and
// contain its substring. Returns { present, missing }.
export function resolveDeterministicEvidence(cell, { repoRoot }) {
  const missing = [];
  for (const ref of cell.deterministic) {
    let text;
    try {
      text = readFileSync(join(repoRoot, ref.file), 'utf8');
    } catch {
      missing.push(ref);
      continue;
    }
    if (!text.includes(ref.contains)) missing.push(ref);
  }
  return { present: missing.length === 0, missing };
}

// The committed live attestations. Genuine recorded runs only — never
// fabricated. A missing file or a missing `behavioral` array is treated as "no
// live evidence yet" (all supported cells pending), not an error.
export function loadAttestations() {
  const path = fileURLToPath(new URL('./live-attestations.json', import.meta.url));
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { behavioral: [] };
  }
  return { behavioral: Array.isArray(data.behavioral) ? data.behavioral : [] };
}

// A harness is live-proven when it has at least one PASSING behavioral
// attestation — genuine proof the pack, placed at that harness's canonical
// discovery path, is discovered and produces the semantic outcome.
export function liveProvenHarnesses(attestations) {
  const proven = new Set();
  for (const a of attestations.behavioral) {
    if (a.verdict === 'pass') proven.add(a.harness);
  }
  return proven;
}

// The proven surface: per channel, the harnesses whose supported cell has BOTH
// deterministic evidence present AND a passing live attestation.
export function provenHarnessesByChannel(cells, attestations, { repoRoot }) {
  const liveProven = liveProvenHarnesses(attestations);
  const out = {};
  for (const channel of CHANNELS) out[channel] = new Set();
  for (const c of cells) {
    if (c.support !== 'supported') continue;
    if (resolveDeterministicEvidence(c, { repoRoot }).present && liveProven.has(c.harness)) {
      out[c.channel].add(c.harness);
    }
  }
  return out;
}

// The advertised surface, derived from the harness registry that generates the
// README install blocks (single source of truth — no fragile prose parsing).
export function advertisedHarnessesByChannel(registry) {
  const out = {};
  for (const channel of CHANNELS) {
    const regName = CHANNEL_TO_REGISTRY[channel];
    out[channel] = new Set(registry.filter((e) => e.channels.includes(regName)).map((e) => e.id));
  }
  return out;
}
