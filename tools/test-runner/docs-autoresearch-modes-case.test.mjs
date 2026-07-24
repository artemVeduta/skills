// Deterministic recognition tests for docs-autoresearch's #59 MODES and
// FAILURE handling (spec §docs-autoresearch). #58 built the DEFAULT
// Reference-enrichment tracer (see docs-autoresearch-case.test.mjs); #59
// completes the SAME skill with:
//   - Specification-resolution mode (target Specification + question; edit only
//     when evidence resolves/narrows; Reference only when independently reusable);
//   - pre-work reconnaissance mode (one dated brief OUTSIDE the bundle, no OKF
//     ceremony);
//   - frontier discovery (at most five deduplicated owned candidates, nothing
//     written before selection);
//   - the repository-policy OVERRIDE mechanism, distinct from the shipped
//     RESEARCH-DEFAULTS.md fallback (announce defaults when missing, field-by-
//     field fallback on partial invalidity, corrupt-install stop when the shipped
//     defaults are missing/unreadable; refine + lower only, never override fixed
//     mechanics/safety/hard ceilings);
//   - the fetch-cap rules (normal 20, one approved run up to the 45 hard ceiling,
//     reset next run, unused quota only at round boundaries, rounds 2/3 at most
//     five targeted searches);
//   - the distinct deterministic report contracts for collision, cap exhaustion,
//     failed fetch, unsafe URL, concept ceiling, denied approval, and mid-write
//     failure; and the insufficient-fanout unsupported-capability failure with
//     no inline or reduced-fanout execution;
//   - additional References only for independently reusable subjects, all within
//     the three-concept mutation ceiling in every mode.
//
// These are the CI-reachable deterministic layer (run by `npm test`); they never
// run a model or touch the network. They prove (a) the SKILL.md prose documents
// the full contract, (b) the documented execution-trace schema is oracle-checkable
// for every mode and stop kind, and (c) the live cases load with the right
// structure and project the full closure. Live behavioural evidence comes from
// four sibling cases via the test-runner CLI (docs-autoresearch-spec,
// docs-autoresearch-spec-unresolved, docs-autoresearch-recon,
// docs-autoresearch-collision).
//
// AC12 coverage note. "Without persisting secrets, sensitive inputs, fetched
// instructions, or raw bodies" is enforced on two fronts:
//   - RAW BODIES: a behavioural negative — the spec-success and reconnaissance
//     live cases assert `file-not-contains '<!DOCTYPE'` on the written concept/
//     brief (a raw fetched HTML body would carry that marker), and every live
//     prompt instructs "Persist summaries and citations only".
//   - UNSAFE URLs / fetched instructions: because CI excludes the network and the
//     enumerated case list ships no unsafe-URL fixture, this half is carried by
//     (1) SKILL.md prose (Source safety and web hygiene + the unsafe-URL failure
//     contract), and (2) the oracle-checkable `unsafe-url` stop kind paired with a
//     `rejected` source outcome and no write — asserted deterministically below.
//     A live unsafe-URL run is out of scope for the CI-reachable layer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { loadCase } from './case-loader.mjs';
import { buildFixture } from './fixture.mjs';
import { checkPortableContract } from './static-contract.mjs';
import { evaluateAssertions, allPassed, extractExecutionTrace } from './oracle.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const casesRoot = join(REPO_ROOT, 'tools/tests');
const skillsRoot = join(REPO_ROOT, 'skills');
const skillDir = join(skillsRoot, 'docs-autoresearch');
const readSkill = () => readFile(join(skillDir, 'SKILL.md'), 'utf8');
const readDefaults = () => readFile(join(skillDir, 'RESEARCH-DEFAULTS.md'), 'utf8');

// --- Specification-resolution mode (spec §docs-autoresearch mode 2) ---

test('SKILL.md documents Specification-resolution mode (target + question, edit only on resolution)', async () => {
  const skill = await readSkill();
  assert.match(skill, /Specification[- ]resolution/i);
  // Requires a target Specification AND a question.
  assert.match(skill, /target Specification/i);
  assert.match(skill, /question/i);
  // Changes the target ONLY when evidence resolves or materially narrows it.
  assert.match(
    skill,
    /(edit|change|update)[^.\n]*only[^.\n]*(resolve|narrow)|only[^.\n]*(resolve|narrow)[^.\n]*(edit|change|target)/i,
    'must state the target changes only when evidence resolves or materially narrows the question',
  );
  assert.match(skill, /materially narrow/i);
  // Creates a Reference ONLY when the evidence is independently reusable.
  assert.match(
    skill,
    /Reference[^.\n]*only[^.\n]*independently reusable|independently reusable[^.\n]*Reference/i,
    'Specification mode creates a Reference only when the evidence is independently reusable',
  );
});

// --- Pre-work reconnaissance mode (spec §docs-autoresearch mode 3) ---

test('SKILL.md documents reconnaissance mode (one dated brief outside the bundle, no ceremony)', async () => {
  const skill = await readSkill();
  assert.match(skill, /reconnaissance/i);
  // Writes ONLY research/YYYY-MM-DD-<slug>.md.
  assert.match(skill, /research\/[^\s`]*YYYY-MM-DD|research\/YYYY-MM-DD/i);
  // Outside the OKF bundle, with NO index/log/lifecycle ceremony.
  assert.match(skill, /outside[^.\n]*bundle|no[^.\n]*(index|log|lifecycle)[^.\n]*ceremony|no OKF[^.\n]*ceremony/i);
  assert.match(
    skill,
    /(no|without)[^.\n]*(index|log|lifecycle|ceremony)/i,
    'reconnaissance must perform no index/log/lifecycle ceremony',
  );
  // Later promotion requires explicit curation + re-verification (not automatic).
  assert.match(skill, /promot/i);
});

// --- Frontier discovery (spec §docs-autoresearch "Topic and mode") ---

test('SKILL.md documents frontier discovery (at most five owned candidates, nothing written before selection)', async () => {
  const skill = await readSkill();
  assert.match(skill, /frontier/i);
  assert.match(skill, /(at most|up to)\s*(five|5)\b[^.\n]*candidate|candidate[^.\n]*(at most|up to)\s*(five|5)/i);
  // Deduplicated, with the owning concept.
  assert.match(skill, /deduplicat/i);
  assert.match(skill, /owner|owning/i);
  // Writes nothing before selection.
  assert.match(skill, /(writes? nothing|no[^.\n]*write|nothing[^.\n]*written)[^.\n]*(before|until)[^.\n]*(selection|select)/i);
});

// --- Repository-policy override mechanism (distinct from the shipped defaults) ---

test('SKILL.md documents the repository-policy override mechanism and its three resolution paths', async () => {
  const skill = await readSkill();
  // The override lives in docs/conventions/research.md, created lazily via docs-add.
  assert.match(skill, /docs\/conventions\/research\.md/);
  // 1. Missing override announces the shipped defaults.
  assert.match(skill, /(missing|absent|no)[^.\n]*(override|research\.md|deviation)[^.\n]*(announce|shipped default)|announce[^.\n]*shipped default/i);
  // 2. Partially invalid override falls back FIELD-BY-FIELD, reporting rejected
  //    values and preserving valid ones.
  assert.match(skill, /field[- ]by[- ]field/i);
  assert.match(skill, /reject/i);
  assert.match(skill, /(preserv|keep)[^.\n]*valid|valid[^.\n]*(preserv|kept|retained)/i);
  // 3. Missing/unreadable SHIPPED defaults stop the run as a corrupt installation.
  assert.match(skill, /corrupt install/i);
  assert.match(skill, /(missing|unreadable)[^.\n]*(shipped )?default|(shipped )?default[^.\n]*(missing|unreadable)/i);
  // Refine allowed fields and LOWER budgets only — never override fixed mechanics,
  // safety, or hard ceilings.
  assert.match(skill, /refine/i);
  assert.match(skill, /lower[^.\n]*budget|budget[^.\n]*lower/i);
  assert.match(
    skill,
    /cannot[^.]*(override|weaken|raise)[^.]*(fixed mechanic|safety|hard ceiling)/i,
    'the override must not override fixed mechanics, safety rules, or hard ceilings',
  );
});

// --- Fetch-cap rules (normal 20, one approved run up to 45, reset next run) ---

test('SKILL.md documents the 20/45/reset fetch-cap rules and round budgets', async () => {
  const skill = await readSkill();
  // The hard one-run ceiling (45) is single-sourced in SKILL.md (not the defaults).
  assert.match(skill, /\b45\b/);
  // One approved run raises the cap no higher than 45; the next run resets.
  assert.match(skill, /(one|single)[- ]?run[^.\n]*(increase|raise)|approv[^.\n]*(increase|raise)/i);
  assert.match(skill, /reset/i);
  // Unused quota moves only at round boundaries.
  assert.match(skill, /unused[^.\n]*(quota|budget)[^.\n]*(round boundar|only at)|round boundar/i);
  // Rounds 2 and 3 allow at most five targeted searches each.
  assert.match(skill, /(at most|up to)\s*(five|5)[^.\n]*(targeted )?search/i);
  // Repository policy may lower budgets but never persistently raise them.
  assert.match(skill, /lower[^.\n]*budget|budget[^.\n]*lower/i);
});

// --- Distinct failure/stop report contracts (spec §Filing + §Fanout and budgets) ---

test('SKILL.md documents each distinct stop/failure report contract', async () => {
  const skill = await readSkill();
  // Each named failure appears as a distinct contract.
  assert.match(skill, /collision/i);
  assert.match(skill, /cap exhaust|exhaust[^.\n]*cap|exhaustion/i);
  assert.match(skill, /(failed|failure)[^.\n]*fetch|fetch[^.\n]*(failed|failure)/i);
  assert.match(skill, /unsafe URL|unsafe[- ]?url/i);
  assert.match(skill, /concept[- ]ceiling|three[- ]concept/i);
  assert.match(skill, /denied|denial/i);
  assert.match(skill, /(mid-write|later write)[^.\n]*fail|partial[- ]state/i);
  // Insufficient fanout → explicit unsupported-capability failure, NO inline or
  // reduced-fanout execution.
  assert.match(skill, /unsupported[- ]capability/i);
  assert.match(
    skill,
    /(never|not|no)[^.]*(reduce|reduced|silently)[^.]*fanout|(never|not|no)[^.]*(inline|reduced-fanout)/i,
    'insufficient fanout must fail loudly, never run inline or with reduced fanout',
  );
});

// --- Additional References + three-concept ceiling across all modes ---

test('SKILL.md gates additional References and keeps every mode within the three-concept ceiling', async () => {
  const skill = await readSkill();
  assert.match(
    skill,
    /additional[^.\n]*Reference[^.\n]*(independently reusable|reusable subject)|independently reusable[^.\n]*(additional )?Reference/i,
    'an additional Reference appears only for an independently reusable source subject',
  );
  assert.match(skill, /(at most|no more than)\s*(three|3)\s*concepts/i);
  // The ceiling holds across ALL modes, not just the default.
  assert.match(skill, /(all|every|each)[^.\n]*(three )?mode|three[- ]concept[^.\n]*(all|every|each|mode)/i);
});

// --- The extended execution-trace schema is documented and oracle-checkable ---

test('SKILL.md documents the extended execution-trace schema (mode, stop kind, round + fetch budgets)', async () => {
  const skill = await readSkill();
  assert.match(skill, /```execution-trace/);
  // Mode variants and the stop descriptor.
  assert.match(skill, /specification-resolution/);
  assert.match(skill, /reconnaissance/);
  assert.match(skill, /"?stop"?/);
  // The fetch block now carries the hard ceiling and the approval flag.
  assert.match(skill, /ceiling/i);
  assert.match(skill, /raisedByApproval|raised_by_approval|approval/i);
  // Rounds 2/3 carry an observable targeted-search limit.
  assert.match(skill, /targetedSearch|targeted[- ]search/i);
});

// --- RESEARCH-DEFAULTS.md documents the override-able fields (still no ceilings) ---

test('RESEARCH-DEFAULTS.md lists the fields a repository override may refine/lower, without leaking hard ceilings', async () => {
  const defaults = await readDefaults();
  // It points at the optional per-repo override file and the refine/lower verbs.
  assert.match(defaults, /docs\/conventions\/research\.md/);
  assert.match(defaults, /refine/i);
  assert.match(defaults, /lower/i);
  // The hard ceilings stay OUT of the tunable defaults (single-sourced in SKILL.md);
  // this preserves the #58 guard.
  assert.doesNotMatch(defaults, /\b45\b/, '45-attempt hard ceiling belongs in SKILL.md, not the tunable defaults');
  assert.doesNotMatch(defaults, /at most three concepts/i, 'three-concept ceiling belongs in SKILL.md, not the tunable defaults');
});

// --- The documented trace schema passes the oracle for every mode and stop kind ---

function traceOutput(trace) {
  return `Here is the run.\n\n\`\`\`execution-trace\n${JSON.stringify(trace, null, 2)}\n\`\`\`\n`;
}

const SPEC_TRACE = {
  mode: 'specification-resolution',
  topic: 'SemVer pre-release precedence',
  target: 'docs/specs/semver-precedence-policy.md',
  question: 'Does a pre-release rank lower than its normal version?',
  rounds: [
    {
      round: 1,
      kind: 'breadth',
      workers: [
        { assignmentId: 'r1-a1', workerId: 'w1', role: 'research', delegated: false, searchQuota: 3, searchCount: 2, fetchQuota: 4, fetchCount: 2, sourceOutcomes: { fetched: 2, rejected: 0, failed: 0 }, packetReceived: true },
        { assignmentId: 'r1-a2', workerId: 'w2', role: 'research', delegated: false, searchQuota: 3, searchCount: 3, fetchQuota: 4, fetchCount: 3, sourceOutcomes: { fetched: 3, rejected: 0, failed: 0 }, packetReceived: true },
        { assignmentId: 'r1-a3', workerId: 'w3', role: 'research', delegated: false, searchQuota: 2, searchCount: 2, fetchQuota: 4, fetchCount: 2, sourceOutcomes: { fetched: 2, rejected: 0, failed: 0 }, packetReceived: true },
      ],
    },
    { round: 2, kind: 'gaps', targetedSearchLimit: 5, workers: [{ assignmentId: 'r2-a1', workerId: 'w4', role: 'research', delegated: false, searchQuota: 5, searchCount: 4, fetchQuota: 5, fetchCount: 4, sourceOutcomes: { fetched: 3, rejected: 1, failed: 0 }, packetReceived: true }] },
  ],
  fetch: { cap: 20, ceiling: 45, raisedByApproval: false, attempts: 11, failures: 0, retries: 0 },
  coordinator: { soleWriter: true, writePhase: 'filed', conceptsMutated: 1 },
  stop: { kind: 'sufficient', detail: 'the question is resolved by the SemVer spec' },
};

const RECON_TRACE = {
  mode: 'reconnaissance',
  topic: 'SemVer precedence',
  rounds: [{ round: 1, kind: 'breadth', workers: [
    { assignmentId: 'r1-a1', workerId: 'w1', role: 'research', delegated: false, searchQuota: 3, searchCount: 2, fetchQuota: 4, fetchCount: 2, sourceOutcomes: { fetched: 2, rejected: 0, failed: 0 }, packetReceived: true },
    { assignmentId: 'r1-a2', workerId: 'w2', role: 'research', delegated: false, searchQuota: 3, searchCount: 2, fetchQuota: 4, fetchCount: 2, sourceOutcomes: { fetched: 2, rejected: 0, failed: 0 }, packetReceived: true },
    { assignmentId: 'r1-a3', workerId: 'w3', role: 'research', delegated: false, searchQuota: 2, searchCount: 2, fetchQuota: 4, fetchCount: 2, sourceOutcomes: { fetched: 2, rejected: 0, failed: 0 }, packetReceived: true },
  ] }],
  fetch: { cap: 20, ceiling: 45, raisedByApproval: false, attempts: 6, failures: 0, retries: 0 },
  coordinator: { soleWriter: true, writePhase: 'filed', conceptsMutated: 0 },
  stop: { kind: 'sufficient', detail: 'brief captured' },
};

// An APPROVED one-run cap raise: cap is 45 (== ceiling), flagged as approved, and
// attempts stay within it — trace-fetch-within-cap accepts it.
const APPROVED_CAP_TRACE = {
  mode: 'reference-enrichment',
  topic: 'deep topic',
  rounds: [{ round: 1, kind: 'breadth', workers: [
    { assignmentId: 'r1-a1', workerId: 'w1', role: 'research', delegated: false, searchQuota: 3, searchCount: 3, fetchQuota: 12, fetchCount: 12, sourceOutcomes: { fetched: 10, rejected: 1, failed: 1 }, packetReceived: true },
  ] }],
  fetch: { cap: 45, ceiling: 45, raisedByApproval: true, attempts: 44, failures: 3, retries: 2 },
  coordinator: { soleWriter: true, writePhase: 'filed', conceptsMutated: 3 },
  stop: { kind: 'cap-exhausted', detail: 'remaining gaps recorded in Open Questions' },
};

// Insufficient fanout: the runtime could not dispatch the required logical
// fanout, so the run stopped with an unsupported-capability failure — NO rounds
// executed inline, NO reduced worker count, NO write.
const UNSUPPORTED_FANOUT_TRACE = {
  mode: 'reference-enrichment',
  topic: 'anything',
  rounds: [],
  fetch: { cap: 20, ceiling: 45, raisedByApproval: false, attempts: 0, failures: 0, retries: 0 },
  coordinator: { soleWriter: true, writePhase: 'none', conceptsMutated: 0 },
  stop: { kind: 'unsupported-fanout', detail: 'the runtime cannot dispatch the required parallel research fanout' },
};

test('the documented Specification-resolution + reconnaissance traces pass the oracle', async () => {
  for (const [name, trace, expectedMode] of [
    ['spec', SPEC_TRACE, 'specification-resolution'],
    ['recon', RECON_TRACE, 'reconnaissance'],
  ]) {
    const output = traceOutput(trace);
    assert.equal(extractExecutionTrace(output).error, null, `${name} trace must parse`);
    const results = await evaluateAssertions(
      [
        { type: 'trace-field', path: 'mode', equals: expectedMode },
        { type: 'trace-every', path: 'rounds.0.workers', field: 'delegated', equals: false },
        { type: 'trace-field', path: 'coordinator.soleWriter', equals: true },
        // Rounds 2/3 within five targeted searches, and fetches within cap ≤ ceiling.
        { type: 'trace-round-search-cap', fromRound: 2, max: 5 },
        { type: 'trace-fetch-within-cap' },
      ],
      { output },
    );
    assert.ok(allPassed(results), `${name}: ${results.filter((r) => !r.pass).map((r) => r.detail).join('; ')}`);
  }
});

test('an approved one-run cap raise (45) is accepted; a run that overruns its cap is caught', async () => {
  const ok = await evaluateAssertions(
    [
      { type: 'trace-field', path: 'fetch.cap', equals: 45 },
      { type: 'trace-field', path: 'fetch.raisedByApproval', equals: true },
      { type: 'trace-fetch-within-cap' },
      { type: 'trace-field', path: 'coordinator.conceptsMutated', equals: 3 },
    ],
    { output: traceOutput(APPROVED_CAP_TRACE) },
  );
  assert.ok(allPassed(ok), ok.filter((r) => !r.pass).map((r) => r.detail).join('; '));
  // A cap raised past the 45 ceiling is rejected.
  const overCeiling = structuredClone(APPROVED_CAP_TRACE);
  overCeiling.fetch.cap = 60;
  const bad = await evaluateAssertions([{ type: 'trace-fetch-within-cap' }], { output: traceOutput(overCeiling) });
  assert.equal(allPassed(bad), false, 'a cap above the 45 hard ceiling must be caught');
  // A run that mutated four concepts breaks the three-concept ceiling assertion.
  const overCeilingConcepts = structuredClone(APPROVED_CAP_TRACE);
  overCeilingConcepts.coordinator.conceptsMutated = 4;
  const badConcepts = await evaluateAssertions(
    [{ type: 'trace-field', path: 'coordinator.conceptsMutated', equals: 3 }],
    { output: traceOutput(overCeilingConcepts) },
  );
  assert.equal(allPassed(badConcepts), false);
});

test('the unsupported-fanout stop is observable and never executed inline or with reduced fanout', async () => {
  const results = await evaluateAssertions(
    [
      { type: 'trace-field', path: 'stop.kind', equals: 'unsupported-fanout' },
      // No write happened.
      { type: 'trace-field', path: 'coordinator.writePhase', equals: 'none' },
      // NO rounds executed inline — the run refused to reduce fanout.
      { type: 'trace-field', path: 'rounds', equals: [] },
      { type: 'trace-field', path: 'fetch.attempts', equals: 0 },
    ],
    { output: traceOutput(UNSUPPORTED_FANOUT_TRACE) },
  );
  assert.ok(allPassed(results), results.filter((r) => !r.pass).map((r) => r.detail).join('; '));
});

// An UNSAFE-URL stop: a source failed the safety filter, was classified
// `rejected`, and — being the decisive/only viable lead — ended the run before
// any write. Proves AC12's URL-safety half is observable in the trace: the
// rejected source outcome is recorded and nothing was written.
const UNSAFE_URL_TRACE = {
  mode: 'reference-enrichment',
  topic: 'anything',
  rounds: [{ round: 1, kind: 'breadth', workers: [
    { assignmentId: 'r1-a1', workerId: 'w1', role: 'research', delegated: false, searchQuota: 3, searchCount: 2, fetchQuota: 4, fetchCount: 0, sourceOutcomes: { fetched: 0, rejected: 2, failed: 0 }, packetReceived: true },
  ] }],
  fetch: { cap: 20, ceiling: 45, raisedByApproval: false, attempts: 0, failures: 0, retries: 0 },
  coordinator: { soleWriter: true, writePhase: 'none', conceptsMutated: 0 },
  stop: { kind: 'unsafe-url', detail: 'the only lead was a credential-bearing URL; classified rejected and never fetched' },
};

test('the unsafe-url stop is observable: rejected source outcome, pre-fetch rejection, no write (AC12)', async () => {
  const results = await evaluateAssertions(
    [
      { type: 'trace-field', path: 'stop.kind', equals: 'unsafe-url' },
      // The unsafe source was classified `rejected`, not `fetched`.
      { type: 'trace-field', path: 'rounds.0.workers.0.sourceOutcomes.rejected', equals: 2 },
      { type: 'trace-field', path: 'rounds.0.workers.0.sourceOutcomes.fetched', equals: 0 },
      // A pre-fetch rejection is not a fetch attempt.
      { type: 'trace-field', path: 'fetch.attempts', equals: 0 },
      // Nothing written on this stop path.
      { type: 'trace-field', path: 'coordinator.writePhase', equals: 'none' },
      // The cap invariant still holds.
      { type: 'trace-fetch-within-cap' },
    ],
    { output: traceOutput(UNSAFE_URL_TRACE) },
  );
  assert.ok(allPassed(results), results.filter((r) => !r.pass).map((r) => r.detail).join('; '));
});

test('every distinct stop kind is oracle-checkable via the trace stop descriptor', async () => {
  const kinds = ['sufficient', 'collision', 'cap-exhausted', 'fetch-failed', 'unsafe-url', 'concept-ceiling', 'denied', 'mid-write-failure', 'unsupported-fanout'];
  for (const kind of kinds) {
    const trace = { mode: 'reference-enrichment', rounds: [], fetch: { cap: 20, ceiling: 45, attempts: 0 }, coordinator: { soleWriter: true, writePhase: 'none', conceptsMutated: 0 }, stop: { kind } };
    const r = await evaluateAssertions([{ type: 'trace-field', path: 'stop.kind', equals: kind }], { output: traceOutput(trace) });
    assert.ok(allPassed(r), `stop kind ${kind} must be observable`);
  }
});

// --- The four #59 live cases load with the right structure and project the closure ---

async function projectAndCheck(c, prefix) {
  const fixtureRoot = await mkdtemp(join(tmpdir(), prefix));
  try {
    const { closure } = await buildFixture({
      skillName: c.skill,
      skillsRoot,
      driver: { discoverySubdir: '.claude/skills' },
      fixtureRoot,
      inputs: c.inputs,
    });
    assert.deepEqual(closure, ['docs-add', 'docs-autoresearch', 'docs-validate']);
    const { errors } = await checkPortableContract(fixtureRoot, { skillsSubdir: '.claude/skills' });
    assert.deepEqual(errors, []);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

test('the Specification-resolution SUCCESS case edits the target in place after approval', async () => {
  const c = await loadCase('docs-autoresearch-spec', { casesRoot });
  assert.equal(c.skill, 'docs-autoresearch');
  // Gated behind ONE approval turn (turn 1 proposes and pauses).
  assert.equal(c.followUpPrompts.length, 1);
  const has = (pred) => c.assertions.some(pred);
  // The write path: a genuine edit that leaves Git otherwise untouched.
  assert.ok(has((a) => a.type === 'git-uncommitted'), 'must assert git-uncommitted');
  // The target Specification is edited in place (still exists, question resolved).
  assert.ok(has((a) => a.type === 'file-exists' && /specs\/.+\.md$/.test(a.path)), 'must keep the target Specification');
  assert.ok(
    has((a) => a.type === 'file-not-contains' && /specs\//.test(a.path) && /\(unresolved\)/.test(a.value)),
    'must prove the open question was resolved (the `(unresolved)` marker removed)',
  );
  // Reference-only-when-reusable: no curated Reference bullet was added.
  assert.ok(
    has((a) => a.type === 'file-not-contains' && a.path === 'docs/references/index.md'),
    'must prove no extra Reference was created (evidence not independently reusable)',
  );
  // ROBUST negative: the References index AND log are byte-preserved vs baseline,
  // so a stray Reference under ANY slug or a lifecycle entry under ANY verb is
  // caught — not just the single-slug substring proxy.
  assert.ok(
    has((a) => a.type === 'file-unchanged' && a.path === 'docs/references/index.md'),
    'must byte-preserve the References index (no Reference filed under any slug)',
  );
  assert.ok(
    has((a) => a.type === 'file-unchanged' && a.path === 'docs/references/log.md'),
    'must byte-preserve the References log (no lifecycle entry under any verb)',
  );
  // AC12 raw-body non-persistence: the in-place edit carries no raw fetched body.
  assert.ok(
    has((a) => a.type === 'file-not-contains' && /specs\//.test(a.path) && /<!DOCTYPE/.test(a.value)),
    'must prove no raw fetched HTML body was pasted into the target Specification',
  );
  // Observable mode.
  assert.ok(
    has((a) => a.type === 'trace-field' && a.path === 'mode' && a.equals === 'specification-resolution'),
    'must assert the run was in Specification-resolution mode',
  );
  assert.ok(has((a) => a.type === 'portable-contract'));
  await projectAndCheck(c, 'dar-spec-');
});

test('the Specification NO-CHANGE case leaves the target byte-preserved when evidence cannot resolve it', async () => {
  const c = await loadCase('docs-autoresearch-spec-unresolved', { casesRoot });
  assert.equal(c.skill, 'docs-autoresearch');
  // SINGLE-turn: the no-change decision is the skill's, not a scripted denial.
  assert.equal(c.followUpPrompts.length, 0, 'the no-change case must be a single read-only-outcome turn');
  const has = (pred) => c.assertions.some(pred);
  // Headline: nothing written.
  assert.ok(has((a) => a.type === 'git-unchanged'), 'must assert git-unchanged (target left unchanged)');
  // The still-open question is byte-preserved.
  assert.ok(
    has((a) => a.type === 'file-contains' && /specs\//.test(a.path) && /\(unresolved\)/.test(a.value)),
    'must prove the unresolved question survives (the target was not edited)',
  );
  assert.ok(
    has((a) => a.type === 'trace-field' && a.path === 'coordinator.writePhase' && a.equals === 'none'),
    'must assert the coordinator wrote nothing',
  );
  assert.ok(has((a) => a.type === 'portable-contract'));
  await projectAndCheck(c, 'dar-spec-nc-');
});

test('the reconnaissance case writes only the dated brief outside the bundle, with no OKF ceremony', async () => {
  const c = await loadCase('docs-autoresearch-recon', { casesRoot });
  assert.equal(c.skill, 'docs-autoresearch');
  assert.equal(c.followUpPrompts.length, 1);
  const has = (pred) => c.assertions.some(pred);
  // The one brief exists OUTSIDE docs/ (under research/).
  assert.ok(
    has((a) => a.type === 'file-exists' && a.path.startsWith('research/') && a.path.endsWith('.md')),
    'must assert the dated brief exists under research/ (outside the bundle)',
  );
  // ROBUST no-ceremony proof: the ONLY changed path vs baseline is the brief —
  // any stray write anywhere in docs/ (under any slug/verb) is caught, not just
  // the keyword substring proxies.
  assert.ok(
    has((a) => a.type === 'git-only-paths' && Array.isArray(a.paths) && a.paths.some((p) => p.startsWith('research/'))),
    'must prove the ONLY changed path is the dated brief (no ceremony anywhere)',
  );
  // NO OKF ceremony: no references index/log or root-log entry gained.
  assert.ok(
    has((a) => a.type === 'file-not-contains' && a.path === 'docs/references/log.md' && /Creation/.test(a.value)),
    'must prove reconnaissance performed no lifecycle ceremony',
  );
  // AC12 raw-body non-persistence: the brief carries no raw fetched body.
  assert.ok(
    has((a) => a.type === 'file-not-contains' && a.path.startsWith('research/') && /<!DOCTYPE/.test(a.value)),
    'must prove no raw fetched HTML body was pasted into the brief',
  );
  assert.ok(has((a) => a.type === 'git-uncommitted'), 'must assert git-uncommitted');
  assert.ok(
    has((a) => a.type === 'trace-field' && a.path === 'coordinator.conceptsMutated' && a.equals === 0),
    'reconnaissance must mutate no OKF concept',
  );
  assert.ok(has((a) => a.type === 'portable-contract'));
  await projectAndCheck(c, 'dar-recon-');
});

test('the collision case stops for confirmation and never overwrites the unrelated concept', async () => {
  const c = await loadCase('docs-autoresearch-collision', { casesRoot });
  assert.equal(c.skill, 'docs-autoresearch');
  // SINGLE-turn: with no confirmation given, a correct run writes nothing.
  assert.equal(c.followUpPrompts.length, 0, 'the collision case must be a single turn (no confirmation)');
  const has = (pred) => c.assertions.some(pred);
  // Headline: never overwrites — the tree stays at baseline.
  assert.ok(has((a) => a.type === 'git-unchanged'), 'must assert git-unchanged (never overwrites)');
  // The existing unrelated concept is byte-preserved.
  assert.ok(
    has((a) => a.type === 'file-contains' && a.path === 'docs/references/semver-precedence.md' && /SENTINEL unrelated-collision-body/.test(a.value)),
    'must prove the unrelated concept at the colliding slug is byte-preserved',
  );
  // The stop is surfaced (collision + confirmation).
  assert.ok(has((a) => a.type === 'output-contains' && /collision/i.test(a.value)));
  assert.ok(has((a) => a.type === 'output-contains' && /confirm/i.test(a.value)));
  assert.ok(has((a) => a.type === 'portable-contract'));
  await projectAndCheck(c, 'dar-collision-');
});
