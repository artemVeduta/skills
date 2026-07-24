// Specification-resolution NO-CHANGE case for docs-autoresearch (issue #59, spec
// §docs-autoresearch mode 2; acceptance contract "Specification mode leaves the
// target unchanged without resolving evidence"). Sibling of docs-autoresearch-
// spec: this directory is docs-autoresearch-spec-unresolved but the manifest
// projects the real docs-autoresearch skill.
//
// The target's open question is SPECULATIVE — it asks what a hypothetical,
// unpublished SemVer 3.0 will decide — so no authoritative source can resolve or
// materially narrow it. Specification-resolution mode therefore changes the
// target ONLY when evidence resolves it; with none, a correct run leaves the
// Specification byte-preserved and reports the remaining gap. This case is
// SINGLE-turn (no approval follow-up): with nothing to file, a correct run
// researches, concludes it cannot resolve the question, and writes nothing — so
// git-unchanged is the headline. The prompt describes the mode's own rule but
// never says "write nothing"/"leave unchanged" as a command tied to a specific
// file, so the no-change outcome is the skill applying its own contract.
import { specBundle, SPEC_PATH, UNRESOLVABLE_SPEC } from '../_docs-autoresearch-modes-assets.mjs';

export default {
  skill: 'docs-autoresearch',
  // Single read-only-outcome turn: the no-change decision is the skill's, not a
  // scripted denial.
  inputs: specBundle(UNRESOLVABLE_SPEC),
  assertions: [
    // Headline: the evidence cannot resolve the question, so the run writes
    // NOTHING — the tree sits exactly at the baseline commit.
    { type: 'git-unchanged' },
    // The target Specification is byte-preserved, INCLUDING the still-open
    // question (a run that edited it — the wrong outcome here — would drop the
    // `(unresolved)` marker or the sentinel).
    { type: 'file-contains', path: SPEC_PATH, value: '(unresolved)' },
    { type: 'file-contains', path: SPEC_PATH, value: 'SENTINEL spec-open-question' },
    // No curated Reference was created either — nothing durable to file.
    { type: 'file-not-contains', path: 'docs/references/index.md', value: 'semver' },
    // Live evidence: the run reported the target is unchanged / the question
    // remains open, rather than silently editing.
    { type: 'output-contains', value: 'unchanged' },
    // Observable: the run was in Specification-resolution mode and wrote nothing.
    { type: 'trace-field', path: 'mode', equals: 'specification-resolution' },
    { type: 'trace-field', path: 'coordinator.writePhase', equals: 'none' },
    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
