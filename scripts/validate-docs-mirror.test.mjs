// Repository-only enforcement of the validator mirror pairs: the authoritative
// assets under skills/okf-docs-setup/assets/scripts/ and their installed
// copies under scripts/ must stay byte-identical. Compared as raw buffers, so
// even a newline-only difference fails. This test reports; it never repairs —
// fix by copying the authoritative asset over the install (or, when the
// contract itself changes, editing the asset and re-copying).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// [authoritative asset, installed copy]. During the v2 EXPAND phase the legacy
// okf-docs-setup and the new docs-setup ship parallel asset trees; both must
// mirror the one authoritative installed validator under scripts/, so both
// pairs are enforced until the legacy identity is removed (#60).
const MIRROR_PAIRS = [
  [
    'skills/okf-docs-setup/assets/scripts/validate-docs.mjs',
    'scripts/validate-docs.mjs',
  ],
  [
    'skills/okf-docs-setup/assets/scripts/validate-docs.test.mjs',
    'scripts/validate-docs.test.mjs',
  ],
  [
    'skills/docs-setup/assets/scripts/validate-docs.mjs',
    'scripts/validate-docs.mjs',
  ],
  [
    'skills/docs-setup/assets/scripts/validate-docs.test.mjs',
    'scripts/validate-docs.test.mjs',
  ],
];

function readRaw(rel) {
  try {
    return readFileSync(join(repoRoot, rel));
  } catch (err) {
    assert.fail(`mirror file missing or unreadable: ${rel} (${err.code ?? err.message})`);
  }
}

for (const [asset, installed] of MIRROR_PAIRS) {
  test(`mirror pair is byte-identical: ${asset} <-> ${installed}`, () => {
    const assetBuf = readRaw(asset);
    const installedBuf = readRaw(installed);
    assert.ok(
      assetBuf.equals(installedBuf),
      `byte difference between the authoritative asset ${asset} and its installed copy ${installed}; ` +
        `the asset is authoritative — recopy it over ${installed} (or update both together when changing the contract)`
    );
  });
}
