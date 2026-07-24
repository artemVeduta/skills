// Pre-work reconnaissance case for docs-autoresearch (issue #59, spec
// §docs-autoresearch mode 3). This directory is docs-autoresearch-recon but the
// manifest projects the real docs-autoresearch skill.
//
// Reconnaissance mode writes ONLY one dated brief `research/YYYY-MM-DD-<slug>.md`
// OUTSIDE the OKF bundle and performs NO index/log/lifecycle ceremony inside
// docs/. The prompt dictates the exact brief path (so the write is
// deterministically assertable) but not the no-ceremony rule — that is the
// skill's own contract, proven by the bundle staying byte-preserved. Turn 1
// presents the plan and pauses; the follow-up approves.
import { reconBundle, RECON_BRIEF_PATH } from '../_docs-autoresearch-modes-assets.mjs';

export default {
  skill: 'docs-autoresearch',
  followUps: ['approve.md'],
  inputs: reconBundle,
  assertions: [
    // The one dated brief was written OUTSIDE the bundle.
    { type: 'file-exists', path: RECON_BRIEF_PATH },
    // ROBUST no-ceremony proof: relative to the baseline commit, the ONLY changed
    // path is the dated brief. A stray write ANYWHERE — a lifecycle entry under
    // any verb, a new concept under any slug, an index touch — is caught, unlike
    // the keyword/verb substring proxies below (which stay as readable statements
    // of the specific concern).
    { type: 'git-only-paths', paths: [RECON_BRIEF_PATH] },
    // A genuine write that leaves Git otherwise untouched.
    { type: 'git-uncommitted' },
    // Raw bodies do not persist (AC12): the brief carries summaries and citations,
    // never a pasted raw fetched HTML body (`<!DOCTYPE` only appears if one was).
    { type: 'file-not-contains', path: RECON_BRIEF_PATH, value: '<!DOCTYPE' },
    // NO OKF ceremony: the references index/log and the root log gained nothing.
    // (The baseline logs seed an `Update`, never a `Creation`, so a fresh
    // Creation would betray ceremony the recon mode must not perform.)
    { type: 'file-not-contains', path: 'docs/references/index.md', value: 'semver' },
    { type: 'file-not-contains', path: 'docs/references/log.md', value: 'Creation' },
    { type: 'file-not-contains', path: 'docs/log.md', value: 'semver' },
    // The bundle root index is byte-preserved (no new area/link).
    { type: 'file-not-contains', path: 'docs/index.md', value: 'semver' },
    // Live evidence the run engaged reconnaissance and wrote under research/.
    { type: 'output-contains', value: 'reconnaissance' },
    { type: 'output-contains', value: 'research/' },
    // Observable: reconnaissance mode mutates NO OKF concept.
    { type: 'trace-field', path: 'mode', equals: 'reconnaissance' },
    { type: 'trace-field', path: 'coordinator.conceptsMutated', equals: 0 },
    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
