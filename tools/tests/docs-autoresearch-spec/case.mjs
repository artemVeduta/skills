// Specification-resolution SUCCESS case for docs-autoresearch (issue #59, spec
// §docs-autoresearch "Topic and mode" mode 2). This directory is
// `docs-autoresearch-spec` but the manifest projects the real docs-autoresearch
// skill, so one skill carries the #58 default cases and these #59 mode cases.
//
// Specification-resolution mode requires a target Specification AND a question,
// and changes the target ONLY when the evidence resolves or materially narrows
// it. Here the open question (does a pre-release rank lower than its normal
// version?) has an authoritative answer in the SemVer 2.0.0 spec, so a correct
// run edits the target IN PLACE to resolve it. The evidence is NOT an
// independently reusable subject, so NO extra Reference is created — proving
// "create a Reference only when the evidence is independently reusable". Turn 1
// (prompt.md) presents the plan and pauses; the follow-up (approve.md) approves,
// so the edit only happens after approval.
import { specBundle, SPEC_PATH, RESOLVABLE_SPEC } from '../_docs-autoresearch-modes-assets.mjs';

export default {
  skill: 'docs-autoresearch',
  followUps: ['approve.md'],
  inputs: specBundle(RESOLVABLE_SPEC),
  assertions: [
    // The target Specification still exists (edited in place, not replaced).
    { type: 'file-exists', path: SPEC_PATH },
    // The open question was RESOLVED or materially narrowed: the `(unresolved)`
    // marker on that question is gone. A run that left the target unchanged (the
    // wrong outcome for a resolvable question) would still carry it.
    { type: 'file-not-contains', path: SPEC_PATH, value: '(unresolved)' },
    // The Overview sentinel survives — the run edited the question, it did not
    // rewrite the whole concept.
    { type: 'file-contains', path: SPEC_PATH, value: 'SENTINEL spec-overview' },
    // Reference-only-when-reusable: the evidence (the SemVer spec answering one
    // in-place question) is not an independently reusable NEW subject here, so no
    // curated Reference was spun up and the references index gained no bullet.
    { type: 'file-not-contains', path: 'docs/references/index.md', value: 'semver-precedence-policy' },
    // A genuine write that leaves Git otherwise untouched (AC: never touches Git).
    { type: 'git-uncommitted' },
    // Observable mode + fanout contract (checked live by the oracle; not in CI):
    // the run entered Specification-resolution mode, workers are read-only, the
    // coordinator is the sole writer, and the fetch cap invariant holds.
    { type: 'trace-field', path: 'mode', equals: 'specification-resolution' },
    { type: 'trace-field', path: 'coordinator.soleWriter', equals: true },
    { type: 'trace-every', path: 'rounds.0.workers', field: 'delegated', equals: false },
    { type: 'trace-fetch-within-cap' },
    // Live evidence the run engaged Specification-resolution (not the default).
    { type: 'output-contains', value: 'Specification' },
    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
