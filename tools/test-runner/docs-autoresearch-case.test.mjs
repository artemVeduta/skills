// Deterministic recognition tests for the canonical docs-autoresearch skill
// (issue #58, spec §docs-autoresearch). docs-autoresearch is the DEFAULT
// Reference-enrichment tracer for explicit, bounded, safe research: it is
// top-level, REQUIRES docs-add AND docs-validate (a two-node canonical-name
// dependency closure), ships ONLY its portable workflow plus ONE flat defaults
// file (RESEARCH-DEFAULTS.md — no scripts/templates/hooks/agent-definition
// sprawl), is explicit-only (generic research neither invokes nor writes),
// dispatches 3–5 read-only workers behind a per-round BARRIER that NEVER
// delegate, meters fetches against a hard cap, gates every durable write behind
// ONE complete filing plan, mutates at most three concepts per run, and exposes
// a machine-readable fenced `execution-trace` block as the cross-harness
// observable contract.
//
// Live behavioral evidence comes from the two sibling cases via the test-runner
// CLI: docs-autoresearch proves the filing-plan GATE (a denied plan leaves the
// bundle EXACTLY at baseline — git-unchanged, Reference absent) and
// docs-autoresearch-approve proves the DEFAULT-mode write path (an approved plan
// files ONE curated multi-source Reference through docs-add, then validates and
// reads it back). These tests are the CI-reachable deterministic layer and never
// run a model or touch the network. The Specification-resolution and
// reconnaissance modes, repository overrides, the hard 45-fetch ceiling, and the
// full failure/partial taxonomy are #59 and out of scope here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { loadCase } from './case-loader.mjs';
import { buildFixture } from './fixture.mjs';
import { checkPortableContract } from './static-contract.mjs';
import { evaluateAssertions, allPassed, extractExecutionTrace } from './oracle.mjs';
import { discoverSkills, stripFrontmatter } from '../../scripts/install/discovery.mjs';
import { parseRequiredSkills, transitiveClosure } from '../skill-graph.mjs';
import { lintReadmeInventory } from '../lint-skills.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const casesRoot = join(REPO_ROOT, 'tools/tests');
const skillsRoot = join(REPO_ROOT, 'skills');
const skillDir = join(skillsRoot, 'docs-autoresearch');

// --- AC1: dependency closure (docs-autoresearch → docs-add, docs-validate) ---

test('docs-autoresearch REQUIRES docs-add and docs-validate (canonical-name deps)', async () => {
  const skills = await discoverSkills(skillsRoot);
  const graph = new Map(skills.map((s) => [s.name, parseRequiredSkills(stripFrontmatter(s.text))]));
  assert.ok(graph.has('docs-autoresearch'), 'docs-autoresearch is not a library skill');
  assert.deepEqual([...graph.get('docs-autoresearch')].sort(), ['docs-add', 'docs-validate']);
  // The whole closure is discoverable — no missing dependency node.
  assert.deepEqual(
    [...transitiveClosure(graph, 'docs-autoresearch')].sort(),
    ['docs-add', 'docs-autoresearch', 'docs-validate'],
  );
});

test('the root README inventory lists docs-autoresearch', async () => {
  const readme = await readFile(join(REPO_ROOT, 'README.md'), 'utf8');
  const { warnings } = lintReadmeInventory(['docs-autoresearch'], readme);
  assert.deepEqual(warnings.filter((w) => !w.includes('but no such skill directory')), []);
});

// --- AC1: one-flat-defaults-file shape (SKILL.md + RESEARCH-DEFAULTS.md only;
// no scripts/templates/hooks/agent-definition sprawl) ---

test('docs-autoresearch ships ONLY SKILL.md plus one flat RESEARCH-DEFAULTS.md — no support sprawl', async () => {
  const entries = await readdir(skillDir, { withFileTypes: true });
  // No subdirectories at all: the skill ships no scripts/, templates/, hooks/,
  // commands/, references/, assets/, or agents/ — the defaults are ONE flat file.
  const subdirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  assert.deepEqual(subdirs, [], `docs-autoresearch must ship no support subdirs, found: ${subdirs.join(', ')}`);
  const files = entries.filter((e) => e.isFile()).map((e) => e.name).sort();
  assert.deepEqual(files, ['RESEARCH-DEFAULTS.md', 'SKILL.md'], `unexpected files: ${files.join(', ')}`);
  // The flat defaults file is a real, non-empty file at the skill root.
  const defaults = await stat(join(skillDir, 'RESEARCH-DEFAULTS.md'));
  assert.ok(defaults.isFile() && defaults.size > 0, 'RESEARCH-DEFAULTS.md must be a non-empty flat file');
});

test('RESEARCH-DEFAULTS.md is the single source of the shipped default values', async () => {
  const defaults = await readFile(join(skillDir, 'RESEARCH-DEFAULTS.md'), 'utf8');
  // The default write mode is Reference enrichment.
  assert.match(defaults, /reference enrichment/i);
  // The normal fetch cap and the recommended per-round split.
  assert.match(defaults, /\b20\b/);
  assert.match(defaults, /12\D+5\D+3/);
  // The three-concept mutation ceiling.
  assert.match(defaults, /\bthree\b|\b3\b/i);
  // The confidence vocabulary and the source hierarchy.
  assert.match(defaults, /high/i);
  assert.match(defaults, /medium/i);
  assert.match(defaults, /low/i);
  assert.match(defaults, /primary/i);
  // The default Reference shape headings.
  for (const heading of ['Overview', 'Key Findings', 'Contradictions', 'Open Questions', 'Citations']) {
    assert.match(defaults, new RegExp(heading, 'i'), `defaults must document the ${heading} section`);
  }
});

// --- The SKILL.md documents the full v2 docs-autoresearch contract ---

test('the SKILL.md documents the v2 docs-autoresearch contract (all #58 acceptance criteria)', async () => {
  const skill = await readFile(join(skillDir, 'SKILL.md'), 'utf8');

  // AC1 — requires both skills by canonical name; reads a flat defaults file.
  assert.match(skill, /##\s+Required skills/);
  assert.match(skill, /docs-add/);
  assert.match(skill, /docs-validate/);
  assert.match(skill, /RESEARCH-DEFAULTS\.md/);

  // AC2 — explicit-only: generic research neither invokes nor writes; topic is
  // an explicit topic, a selected frontier candidate, or a user-provided topic;
  // the skill never improvises a topic.
  assert.match(skill, /explicit/i);
  assert.match(skill, /generic research/i);
  assert.match(skill, /frontier/i);
  assert.match(skill, /(never|not)[^.\n]*(improvise|choose|invent)[^.\n]*topic|topic[^.\n]*(never|not)[^.\n]*(improvise|choose|invent)/i);

  // AC3 — default mode creates OR materially enriches ONE curated multi-source
  // Reference and NEVER persists raw source bodies.
  assert.match(skill, /Reference enrichment/i);
  assert.match(skill, /(one|single)[^.\n]*Reference/i);
  assert.match(skill, /multi-source|multiple sources/i);
  assert.match(skill, /raw[- ]source|raw bodies|raw source bodies/i);

  // AC4 — Round 1 dispatches 3–5 independent read-only workers behind a
  // BARRIER; later rounds obey targeted-search limits; workers NEVER delegate.
  assert.match(skill, /3\s*[–-]\s*5|three to five/i);
  assert.match(skill, /barrier/i);
  assert.match(skill, /read-only/i);
  assert.match(skill, /(never|cannot|not)[^.\n]*delegat/i);
  assert.match(skill, /sole writer|only writer|coordinator[^.\n]*writes/i);
  // Targeted-search limits for the later rounds (at most five).
  assert.match(skill, /(at most|up to|max(?:imum)?)\s*(five|5)[^.\n]*(search|target)/i);

  // AC5 — every evidence packet reports assignment, confidence-labelled claims,
  // counterevidence, contradictions, open questions, consumed attempts, and
  // exactly classified source outcomes.
  assert.match(skill, /evidence packet/i);
  assert.match(skill, /assignment/i);
  assert.match(skill, /confidence/i);
  assert.match(skill, /counter[- ]?evidence/i);
  assert.match(skill, /contradiction/i);
  assert.match(skill, /open questions/i);
  assert.match(skill, /consumed|attempts/i);
  assert.match(skill, /fetched/i);
  assert.match(skill, /rejected/i);
  assert.match(skill, /failed/i);

  // AC6 — fetch accounting includes failures and retries, respects the normal
  // total cap, and stops early only when evidence sufficiency is met.
  assert.match(skill, /failures?\s+and\s+retries|failures?,?\s*retries/i);
  assert.match(skill, /\b20\b/);
  assert.match(skill, /stop early|early stop|stop(?:ping)? early/i);
  assert.match(skill, /sufficien/i);

  // AC7 — only public HTTP(S) URLs; unsafe destinations and fetched
  // instructions are rejected or treated as untrusted data.
  assert.match(skill, /HTTPS?|http\(s\)/i);
  assert.match(skill, /public/i);
  assert.match(skill, /localhost|private|metadata|credential/i);
  assert.match(skill, /untrusted|data, not instructions|never (?:follow|execute)/i);

  // AC8 — one complete filing plan before any durable write, covering content,
  // contradictions, low-confidence claims, indexes, and one lifecycle entry.
  assert.match(skill, /filing plan/i);
  assert.match(skill, /before any (?:durable )?write|before[^.\n]*write/i);
  assert.match(skill, /low[- ]confidence/i);
  assert.match(skill, /index/i);
  assert.match(skill, /(one|single|consolidated)[^.\n]*lifecycle/i);

  // AC9 — new concepts reuse the approved plan through docs-add; existing
  // concepts update directly; at most three concepts mutated in one run.
  assert.match(skill, /docs-add/);
  assert.match(skill, /(at most|no more than)\s*(three|3)\s*concepts/i);

  // AC10 — the report AND a fenced execution-trace expose rounds, workers,
  // quotas, counts, source outcomes, writes, validation, open questions, and
  // partial failures.
  assert.match(skill, /```execution-trace/);
  assert.match(skill, /round/i);
  assert.match(skill, /worker/i);
  assert.match(skill, /quota/i);
  assert.match(skill, /source outcome/i);
  assert.match(skill, /validat/i);
  assert.match(skill, /partial fail/i);

  // AC11 — a denied filing plan leaves the bundle unchanged; a later failure
  // stops with an exact partial-state report and NO destructive rollback.
  assert.match(skill, /denied|deny/i);
  assert.match(skill, /unchanged/i);
  assert.match(skill, /partial[- ]state/i);
  assert.match(skill, /(no|never)[^.\n]*rollback/i);

  // Never touches Git.
  assert.match(skill, /commit/i);
  assert.match(skill, /stage|staging/i);
});

// --- the fenced execution-trace schema the SKILL.md documents is oracle-checkable
// (AC10 "trace fields"): a representative trace passes the trace-* assertions,
// proving read-only workers (never delegate), the round barrier, the fetch cap,
// and coordinator-only writes are all observable deterministically ---

const SAMPLE_TRACE = {
  mode: 'reference-enrichment',
  topic: 'Semantic Versioning precedence rules',
  rounds: [
    {
      round: 1,
      kind: 'breadth',
      workers: [
        { assignmentId: 'r1-a1', workerId: 'w1', role: 'research', delegated: false, searchQuota: 3, searchCount: 2, fetchQuota: 4, fetchCount: 3, sourceOutcomes: { fetched: 2, rejected: 1, failed: 0 }, packetReceived: true },
        { assignmentId: 'r1-a2', workerId: 'w2', role: 'research', delegated: false, searchQuota: 3, searchCount: 3, fetchQuota: 4, fetchCount: 2, sourceOutcomes: { fetched: 2, rejected: 0, failed: 0 }, packetReceived: true },
        { assignmentId: 'r1-a3', workerId: 'w3', role: 'research', delegated: false, searchQuota: 2, searchCount: 2, fetchQuota: 4, fetchCount: 4, sourceOutcomes: { fetched: 3, rejected: 0, failed: 1 }, packetReceived: true },
      ],
    },
  ],
  fetch: { cap: 20, attempts: 9, failures: 1, retries: 0 },
  coordinator: { soleWriter: true, writePhase: 'filed', conceptsMutated: 1 },
};

function traceOutput(trace) {
  return `Here is the run.\n\n\`\`\`execution-trace\n${JSON.stringify(trace, null, 2)}\n\`\`\`\n`;
}

test('the documented execution-trace schema passes the trace-* oracle assertions', async () => {
  const output = traceOutput(SAMPLE_TRACE);
  // The parse round-trips (the block is valid JSON).
  assert.equal(extractExecutionTrace(output).error, null);
  const assertions = [
    { type: 'trace-field', path: 'mode', equals: 'reference-enrichment' },
    { type: 'trace-field', path: 'rounds.0.round', equals: 1 },
    // read-only workers that NEVER delegate (AC4) — every Round-1 worker.
    { type: 'trace-every', path: 'rounds.0.workers', field: 'delegated', equals: false },
    { type: 'trace-every', path: 'rounds.0.workers', field: 'role', equals: 'research' },
    // the barrier collected every packet.
    { type: 'trace-every', path: 'rounds.0.workers', field: 'packetReceived', equals: true },
    // fetch cap and coordinator-only writes (AC6 + AC4).
    { type: 'trace-field', path: 'fetch.cap', equals: 20 },
    { type: 'trace-field', path: 'coordinator.soleWriter', equals: true },
    { type: 'trace-field', path: 'coordinator.writePhase', equals: 'filed' },
    { type: 'trace-field', path: 'coordinator.conceptsMutated', equals: 1 },
  ];
  const results = await evaluateAssertions(assertions, { output });
  assert.ok(allPassed(results), `trace assertions failed: ${results.filter((r) => !r.pass).map((r) => r.detail).join('; ')}`);
});

test('the trace oracle CATCHES a delegating worker and a missing trace block', async () => {
  // A worker that delegated must fail the read-only/no-delegation check.
  const delegating = structuredClone(SAMPLE_TRACE);
  delegating.rounds[0].workers[1].delegated = true;
  const bad = await evaluateAssertions(
    [{ type: 'trace-every', path: 'rounds.0.workers', field: 'delegated', equals: false }],
    { output: traceOutput(delegating) },
  );
  assert.equal(allPassed(bad), false, 'a delegating worker must fail the no-delegation trace check');
  // No trace block at all fails loudly rather than passing vacuously.
  const missing = await evaluateAssertions(
    [{ type: 'trace-field', path: 'coordinator.soleWriter', equals: true }],
    { output: 'a report with no fenced execution-trace block' },
  );
  assert.equal(allPassed(missing), false, 'a missing trace block must fail, not pass vacuously');
});

// --- AC2/AC8/AC11: the deny case proves the filing-plan gate on a NO-WRITE path ---

test('the deny case loads, targets docs-autoresearch, and proves the filing-plan gate', async () => {
  const c = await loadCase('docs-autoresearch', { casesRoot });
  assert.equal(c.skill, 'docs-autoresearch');
  // Turn 1 researches an explicit topic and presents ONE filing plan and pauses;
  // the follow-up denies, so the gate is observable on a no-write path.
  assert.equal(c.followUpPrompts.length, 1);
  const types = c.assertions.map((a) => a.type);
  // git-unchanged is the headline: a denied plan leaves the bundle and Git state
  // EXACTLY at the fixture baseline (AC11 + never-touch-Git).
  assert.ok(types.includes('git-unchanged'), 'the deny case must assert git-unchanged');
  // The proposed Reference was NOT created without approval (AC8/AC11).
  assert.ok(
    c.assertions.some((a) => a.type === 'file-absent'),
    'the deny case must assert the proposed Reference is absent',
  );
  // Static shared-reader contract over the projected pack (AC1).
  assert.ok(types.includes('portable-contract'));
});

// --- AC3/AC9/AC10: the approve case proves the DEFAULT-mode Reference write path ---

test('the approve case projects the full closure and proves the one-Reference write via docs-add', async () => {
  const c = await loadCase('docs-autoresearch-approve', { casesRoot });
  // The case directory is docs-autoresearch-approve; the manifest projects the
  // real docs-autoresearch skill so one skill carries both sibling cases.
  assert.equal(c.skill, 'docs-autoresearch');
  assert.equal(c.followUpPrompts.length, 1);
  // AC3/AC9: exactly ONE curated Reference is written at a references path...
  const refPaths = c.assertions
    .filter((a) => a.type === 'file-exists' && /^docs\/references\/[^/]+\.md$/.test(a.path))
    .map((a) => a.path);
  assert.equal(refPaths.length, 1, 'the approve case must assert exactly one Reference concept was written');
  const ref = refPaths[0];
  // ...as a conformant Reference (frontmatter type landed — the read-back).
  assert.ok(
    c.assertions.some((a) => a.type === 'file-contains' && a.path === ref && /type:\s*Reference/.test(a.value)),
    'the approve case must read the Reference back and confirm its frontmatter type',
  );
  // ...carrying the default Reference shape (AC3).
  assert.ok(
    c.assertions.some((a) => a.type === 'file-contains' && a.path === ref && /Key Findings/.test(a.value)),
    'the approve case must assert the Reference carries the default Key Findings section',
  );
  assert.ok(
    c.assertions.some((a) => a.type === 'file-contains' && a.path === ref && /Citations/.test(a.value)),
    'the approve case must assert the Reference carries a Citations section',
  );
  // AC9 bookkeeping: the parent references index gained the concept bullet and
  // the nearest log gained one Creation entry.
  assert.ok(
    c.assertions.some((a) => a.type === 'file-contains' && a.path === 'docs/references/index.md'),
    'the approve case must assert the references index gained the concept bullet',
  );
  assert.ok(
    c.assertions.some((a) => a.type === 'file-contains' && a.path === 'docs/references/log.md' && a.value.includes('Creation')),
    'the approve case must assert the nearest log gained a Creation entry',
  );
  // AC10 on the WRITE path: a genuine write that leaves Git untouched.
  assert.ok(
    c.assertions.some((a) => a.type === 'git-uncommitted'),
    'the approve case must assert git-uncommitted (a genuine write that leaves Git untouched)',
  );
  // AC10 trace: the case carries execution-trace assertions covering read-only
  // workers and coordinator-only writes (the cross-harness observable contract).
  const traceAssertions = c.assertions.filter((a) => a.type.startsWith('trace-'));
  assert.ok(traceAssertions.length > 0, 'the approve case must carry execution-trace assertions');
  assert.ok(
    traceAssertions.some((a) => a.type === 'trace-every' && a.field === 'delegated' && a.equals === false),
    'the approve trace must assert workers never delegate (delegated: false)',
  );
  assert.ok(
    traceAssertions.some((a) => a.type === 'trace-field' && a.path === 'coordinator.soleWriter' && a.equals === true),
    'the approve trace must assert the coordinator is the sole writer',
  );
  assert.ok(c.assertions.some((a) => a.type === 'portable-contract'));

  // buildFixture projects the skill with its full docs-add + docs-validate
  // closure — exactly what the CLI would run for this case.
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'dar-approve-'));
  try {
    const { closure } = await buildFixture({
      skillName: c.skill,
      skillsRoot,
      driver: { discoverySubdir: '.claude/skills' },
      fixtureRoot,
      inputs: c.inputs,
    });
    assert.deepEqual(closure, ['docs-add', 'docs-autoresearch', 'docs-validate']);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('the projected docs-autoresearch pack passes the static portable contract', async () => {
  const c = await loadCase('docs-autoresearch', { casesRoot });
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'dar-static-'));
  try {
    const { closure } = await buildFixture({
      skillName: 'docs-autoresearch',
      skillsRoot,
      driver: { discoverySubdir: '.claude/skills' },
      fixtureRoot,
      inputs: c.inputs,
    });
    assert.deepEqual(
      closure,
      ['docs-add', 'docs-autoresearch', 'docs-validate'],
      'docs-autoresearch projects with its docs-add + docs-validate closure',
    );
    const { errors } = await checkPortableContract(fixtureRoot, { skillsSubdir: '.claude/skills' });
    assert.deepEqual(errors, []);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
