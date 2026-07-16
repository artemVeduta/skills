// tools/benchmarks/provenance.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gitProvenance } from './provenance.mjs';

test('gitProvenance captures commit, dirty=false on a clean tree, and an ISO timestamp', () => {
  const exec = (cmd, args) => {
    if (args[0] === 'rev-parse') return 'abc123\n';
    if (args[0] === 'status') return '';           // clean working tree
    throw new Error(`unexpected git args: ${args.join(' ')}`);
  };
  const p = gitProvenance('/repo', { exec, now: () => new Date('2026-07-16T00:00:00.000Z') });
  assert.equal(p.commit, 'abc123');
  assert.equal(p.dirty, false);
  assert.equal(p.timestamp, '2026-07-16T00:00:00.000Z');
});

test('gitProvenance reports dirty=true when the working tree has changes', () => {
  const exec = (cmd, args) => (args[0] === 'rev-parse' ? 'def456\n' : ' M tools/x.mjs\n');
  const p = gitProvenance('/repo', { exec, now: () => new Date('2026-07-16T00:00:00.000Z') });
  assert.equal(p.commit, 'def456');
  assert.equal(p.dirty, true);
});
