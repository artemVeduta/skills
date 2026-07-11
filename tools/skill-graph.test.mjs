import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRequiredSkills,
  parseRuntimeInvocations,
  reconcileInvocations,
  missingNodes,
  findCycles,
  transitiveClosure,
} from './skill-graph.mjs';

test('parseRequiredSkills reads bare names and stops at the next heading', () => {
  const body = [
    '## Required skills',
    '',
    '- domain-modeling',
    '- skill-builder',
    '',
    '## Integration',
    '- not-a-dependency',
  ].join('\n');
  assert.deepEqual(parseRequiredSkills(body), ['domain-modeling', 'skill-builder']);
});

test('parseRequiredSkills returns [] when the section is absent', () => {
  assert.deepEqual(parseRequiredSkills('## Overview\n\nno deps here'), []);
});

test('parseRuntimeInvocations captures bare invocations and excludes namespaced ones', () => {
  const body = 'Invoke `/domain-modeling` then `/skill-builder`. See `/superpowers:brainstorming`.';
  assert.deepEqual(parseRuntimeInvocations(body).sort(), ['domain-modeling', 'skill-builder']);
});

test('parseRuntimeInvocations de-duplicates repeated invocations', () => {
  assert.deepEqual(parseRuntimeInvocations('`/a` and again `/a`'), ['a']);
});

test('reconcileInvocations returns invocations that lack a declaration', () => {
  assert.deepEqual(reconcileInvocations(['a'], ['a', 'b']), ['b']);
  assert.deepEqual(reconcileInvocations(['a', 'b'], ['a']), []);
});

test('missingNodes flags a declared dependency absent from the graph', () => {
  const graph = new Map([['a', ['b']], ['b', []]]);
  assert.deepEqual(missingNodes(graph), []);
  const dangling = new Map([['a', ['ghost']]]);
  assert.deepEqual(missingNodes(dangling), [{ from: 'a', missing: 'ghost' }]);
});

test('findCycles detects a direct cycle', () => {
  const graph = new Map([['a', ['b']], ['b', ['a']]]);
  const cycles = findCycles(graph);
  assert.equal(cycles.length >= 1, true);
  assert.deepEqual([...cycles[0]].sort(), ['a', 'b']);
});

test('findCycles returns no cycles for a DAG', () => {
  const graph = new Map([['a', ['b']], ['b', ['c']], ['c', []]]);
  assert.deepEqual(findCycles(graph), []);
});

test('findCycles ignores edges to missing nodes', () => {
  const graph = new Map([['a', ['ghost']]]);
  assert.deepEqual(findCycles(graph), []);
});

test('transitiveClosure includes start and all reachable dependencies', () => {
  const graph = new Map([['a', ['b']], ['b', ['c']], ['c', []]]);
  assert.deepEqual([...transitiveClosure(graph, 'a')].sort(), ['a', 'b', 'c']);
});
