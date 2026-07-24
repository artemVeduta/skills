// Central test case for docs-autoresearch (issue #58, spec §docs-autoresearch,
// DEFAULT Reference-enrichment mode). The scenario is the filing-plan GATE, only
// observable on a NO-WRITE path: on any path that files, the end state cannot
// distinguish "waited for approval" from "wrote eagerly", so a turn that DENIES
// the plan is the only way to prove "before any durable write, present one filing
// plan ... only explicit approval authorizes writes" (AC8) and "a denied filing
// plan leaves the bundle unchanged" (AC11). Turn 1 (prompt.md) researches an
// explicit topic and presents the complete filing plan and pauses; the follow-up
// (deny.md) refuses it. The deterministic oracle then proves the bundle and Git
// state sit exactly at the fixture baseline (git-unchanged), and the proposed
// Reference was never created.
//
// The byte-identical bundle scaffold this case shares with the approve sibling
// lives in ../_docs-autoresearch-assets.mjs (Fowler: Duplicated Code); only the
// follow-up and the assertions are here.
import { scaffold, REF_PATH } from '../_docs-autoresearch-assets.mjs';

export default {
  skill: 'docs-autoresearch',
  followUps: ['deny.md'],
  inputs: [...scaffold],
  assertions: [
    // Headline (AC11 + never-touch-Git): with the plan denied, the fixture stays
    // EXACTLY at its baseline commit — nothing written, staged, committed,
    // pushed, or PR'd.
    { type: 'git-unchanged' },
    // The proposed curated Reference was never created without approval (AC8).
    { type: 'file-absent', path: REF_PATH },
    // Neither the references index nor its log gained a filing entry.
    { type: 'file-not-contains', path: 'docs/references/index.md', value: 'semver-precedence' },
    { type: 'file-not-contains', path: 'docs/references/log.md', value: 'semver' },
    // Live AC8 evidence: turn 1 presented a filing PLAN (not a written file). The
    // prompt asks for a plan with a path, an outline, and a lifecycle entry, so
    // these come from the skill applying its gate, not from a dictated write.
    { type: 'output-contains', value: 'plan' },
    { type: 'output-contains', value: 'Reference' },
    // Static shared-reader contract over the projected pack (AC1).
    { type: 'portable-contract' },
  ],
};
