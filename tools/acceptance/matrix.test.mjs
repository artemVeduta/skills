// CI-gated acceptance-matrix invariant (issue #63 capstone). This is the gate
// that closes the v2 delivery contract: the advertised distribution surface must
// be EXACTLY the set of cells with BOTH deterministic packaging evidence AND a
// committed live behavioral attestation (advertised == proven). It is a pure,
// deterministic test — it reads committed data and NEVER spawns a harness, so it
// runs in `npm test`/CI while genuinely gating live-verified parity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import {
  CHANNELS,
  HARNESSES,
  CELLS,
  cellFor,
  resolveDeterministicEvidence,
  liveProvenHarnesses,
  provenHarnessesByChannel,
  advertisedHarnessesByChannel,
  loadAttestations,
} from './matrix.mjs';
import { REGISTRY } from '../../scripts/install/registry.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const attestations = loadAttestations();

// --- structural completeness: no cell is silently skipped ------------------

test('every (channel × harness) combination is represented exactly once', () => {
  const seen = new Set();
  for (const c of CELLS) {
    const key = `${c.channel}:${c.harness}`;
    assert.ok(!seen.has(key), `duplicate cell ${key}`);
    seen.add(key);
    assert.ok(CHANNELS.includes(c.channel), `unknown channel ${c.channel}`);
    assert.ok(HARNESSES.includes(c.harness), `unknown harness ${c.harness}`);
  }
  for (const channel of CHANNELS) {
    for (const harness of HARNESSES) {
      assert.ok(seen.has(`${channel}:${harness}`), `missing cell ${channel}:${harness}`);
    }
  }
  assert.equal(CELLS.length, CHANNELS.length * HARNESSES.length);
});

test('OpenCode native is PRESENT and marked unsupported — never silently skipped', () => {
  const cell = cellFor('native', 'opencode');
  assert.ok(cell, 'the native × opencode cell must exist');
  assert.equal(cell.support, 'unsupported');
  assert.equal(cell.live, 'absence', 'an unsupported cell needs deterministic absence evidence, not live behavior');
});

test('every supported cell needs live behavioral evidence; the unsupported cell needs absence evidence', () => {
  for (const c of CELLS) {
    if (c.support === 'supported') assert.equal(c.live, 'behavioral', `${c.channel}:${c.harness}`);
    else assert.equal(c.live, 'absence', `${c.channel}:${c.harness}`);
  }
});

// --- deterministic evidence must resolve (no dangling references) -----------

test('every cell references at least one deterministic evidence test', () => {
  for (const c of CELLS) {
    assert.ok(Array.isArray(c.deterministic) && c.deterministic.length > 0,
      `${c.channel}:${c.harness} has no deterministic evidence`);
  }
});

test('every deterministic evidence reference resolves to a real committed test', () => {
  for (const c of CELLS) {
    const { present, missing } = resolveDeterministicEvidence(c, { repoRoot: REPO_ROOT });
    assert.ok(present, `${c.channel}:${c.harness}: dangling deterministic evidence: ${JSON.stringify(missing)}`);
  }
});

test('deterministic evidence files named by the matrix are part of the npm test suite', () => {
  // Every referenced file must be a *.test.mjs under scripts/ or tools/ — the
  // globs `npm test` runs — so "deterministic evidence" is genuinely CI-gated.
  const files = new Set(CELLS.flatMap((c) => c.deterministic.map((d) => d.file)));
  for (const f of files) {
    assert.match(f, /\.test\.mjs$/, `${f} is not a test file`);
    assert.match(f, /^(scripts|tools)\//, `${f} is not under a suite root`);
    assert.ok(existsSync(join(REPO_ROOT, f)), `${f} does not exist`);
  }
});

// --- live attestations are genuine-shaped (honesty guard) ------------------

test('live attestations carry full run provenance (harness, model, version, commit, date, verdict)', () => {
  for (const a of attestations.behavioral) {
    assert.ok(HARNESSES.includes(a.harness), `unknown harness in attestation: ${a.harness}`);
    for (const field of ['case', 'model', 'harnessVersion', 'commit', 'date', 'verdict']) {
      assert.ok(typeof a[field] === 'string' && a[field].length > 0,
        `attestation for ${a.harness} missing ${field}`);
    }
    // Provenance must be genuinely SHAPED, not merely non-empty: a full 40-hex
    // git SHA and an ISO date. A hand-typed placeholder ("TODO", "abc") then
    // fails the gate — a cheap honesty guard over the recorded provenance.
    assert.match(a.commit, /^[0-9a-f]{40}$/,
      `attestation for ${a.harness}: commit must be a full git SHA, got ${a.commit}`);
    assert.match(a.date, /^\d{4}-\d{2}-\d{2}$/,
      `attestation for ${a.harness}: date must be ISO YYYY-MM-DD, got ${a.date}`);
    assert.ok(['pass', 'fail'].includes(a.verdict), `attestation verdict must be pass|fail, got ${a.verdict}`);
  }
});

test('a harness is live-proven only when it has a passing behavioral attestation', () => {
  const proven = liveProvenHarnesses(attestations);
  for (const h of proven) assert.ok(HARNESSES.includes(h));
  // A failing attestation never proves a harness.
  for (const a of attestations.behavioral) {
    if (a.verdict === 'fail') {
      const stillPassing = attestations.behavioral.some((b) => b.harness === a.harness && b.verdict === 'pass');
      if (!stillPassing) assert.ok(!proven.has(a.harness), `${a.harness} has only failing attestations but is proven`);
    }
  }
});

// --- THE INVARIANT: advertised == proven -----------------------------------

test('advertised support surface is EXACTLY the set of proven cells (advertised == proven)', () => {
  const advertised = advertisedHarnessesByChannel(REGISTRY);
  const proven = provenHarnessesByChannel(CELLS, attestations, { repoRoot: REPO_ROOT });
  for (const channel of CHANNELS) {
    const adv = [...advertised[channel]].sort();
    const prv = [...proven[channel]].sort();
    assert.deepEqual(adv, prv,
      `channel "${channel}": advertised ${JSON.stringify(adv)} != proven ${JSON.stringify(prv)}. ` +
      'A cell is advertised iff it has BOTH deterministic and live evidence; withhold un-proven cells.');
  }
});

test('the registry never advertises an unsupported cell', () => {
  const advertised = advertisedHarnessesByChannel(REGISTRY);
  for (const c of CELLS) {
    if (c.support === 'unsupported') {
      assert.ok(!advertised[c.channel].has(c.harness),
        `${c.channel}:${c.harness} is unsupported but advertised`);
    }
  }
});
