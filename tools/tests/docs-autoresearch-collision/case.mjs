// Slug-collision STOP case for docs-autoresearch (issue #59, spec
// §docs-autoresearch "Topic and mode": "An ambiguous or unrelated slug collision
// stops for confirmation and never overwrites"). This directory is
// docs-autoresearch-collision but the manifest projects the real docs-autoresearch
// skill. This is the representative FAILURE live case among #59's distinct
// stop/report contracts (denied approval is already covered by the #58 deny
// case).
//
// The slug the topic "Semantic Versioning precedence" produces —
// `semver-precedence` — is ALREADY occupied by an UNRELATED concept (a note about
// database index precedence in query planning). A correct run recognises the
// collision, STOPS for confirmation, and never overwrites the existing file. The
// prompt states the standing "never overwrite unrelated content" rule and points
// at the skill's own filing rules, but never says "stop" or "collision" — so the
// stop is the skill's own recognition. This case is SINGLE-turn: with no
// confirmation given, a correct run writes nothing.
import { collisionBundle, COLLISION_REF_PATH } from '../_docs-autoresearch-modes-assets.mjs';

export default {
  skill: 'docs-autoresearch',
  inputs: collisionBundle,
  assertions: [
    // Headline: an unrelated slug collision never overwrites — the tree sits
    // exactly at the baseline commit (nothing written, staged, or committed).
    { type: 'git-unchanged' },
    // The existing UNRELATED concept is byte-preserved (not overwritten with the
    // SemVer research). Its sentinel and its own subject survive.
    { type: 'file-contains', path: COLLISION_REF_PATH, value: 'SENTINEL unrelated-collision-body' },
    { type: 'file-contains', path: COLLISION_REF_PATH, value: 'Database index precedence' },
    // Live evidence: the run surfaced the collision and asked for confirmation
    // rather than guessing. 'collision' is the skill's own term for this stop.
    { type: 'output-contains', value: 'collision' },
    { type: 'output-contains', value: 'confirm' },
    // Observable: nothing was written on this stop path.
    { type: 'trace-field', path: 'coordinator.writePhase', equals: 'none' },
    // Static shared-reader contract over the projected pack.
    { type: 'portable-contract' },
  ],
};
