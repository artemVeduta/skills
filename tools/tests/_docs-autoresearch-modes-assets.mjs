// Pure, stateless fixture scaffolds shared by the #59 docs-autoresearch MODE
// cases (Specification-resolution, reconnaissance, and a representative
// collision failure). Mirrors _docs-autoresearch-assets.mjs (the #58 default
// Reference-enrichment scaffold): this module carries NO assertions and NO
// case-specific follow-ups — only the byte-identical OKF-bundle scaffolds each
// case seeds verbatim. Extracting the shared copy-paste (Fowler: Duplicated
// Code) keeps a change to the shared bundle shape a single-site edit and stops
// the mode fixtures from drifting apart. The lifecycle policy and validator are
// re-used from the #58 module so every fixture reads THIS repo's canonical
// bytes.
import { policy, validator } from './_docs-autoresearch-assets.mjs';

// --- shared machinery (project-memory shim, routing AGENTS.md, runnable
// validator) so an approved write can run docs:validate ---

const CLAUDE_MD = { path: 'CLAUDE.md', content: '@AGENTS.md\n' };
const AGENTS_MD = {
  path: 'AGENTS.md',
  content:
    'Workspace with an OKF v0.1 docs/ bundle. Lifecycle policy: docs/conventions/documentation.md. Use docs-autoresearch for explicit bounded research: the default files one curated Reference; Specification-resolution answers a Specification question in place; pre-work reconnaissance writes one dated brief under research/.\n',
};
const PACKAGE_JSON = {
  path: 'package.json',
  content: `${JSON.stringify(
    { name: 'fixtureproj', private: true, scripts: { 'docs:validate': 'node scripts/validate-docs.mjs' } },
    null,
    2,
  )}\n`,
};
const PACKAGE_LOCK = { path: 'package-lock.json', content: '{\n  "lockfileVersion": 3\n}\n' };
const VALIDATOR = { path: 'scripts/validate-docs.mjs', content: validator };

const CONVENTIONS_INDEX = {
  path: 'docs/conventions/index.md',
  content: '# Conventions\n\n- [Documentation lifecycle policy](/conventions/documentation.md) - the docs flow\n',
};
const CONVENTIONS_POLICY = { path: 'docs/conventions/documentation.md', content: policy };

// Baseline log entry (both logs). Uses a NON-`Creation` verb so a case can prove
// a run added a NEW Creation entry rather than vacuously matching the baseline.
const LOG = '## 2026-07-20\n\n- **Update** — bundle baseline note.\n';
const REFERENCES_INDEX = {
  path: 'docs/references/index.md',
  content: '# References\n\nExternal material mirrored as first-class concepts.\n',
};
const REFERENCES_LOG = { path: 'docs/references/log.md', content: LOG };

const MACHINERY = [CLAUDE_MD, AGENTS_MD, PACKAGE_JSON, PACKAGE_LOCK, VALIDATOR, CONVENTIONS_INDEX, CONVENTIONS_POLICY];

// =====================================================================
// Specification-resolution bundle: a target Specification carrying one
// `## Open Questions` item the run either resolves in place (resolvable case)
// or leaves byte-preserved when the evidence cannot answer it (unresolved case).
// =====================================================================

export const SPEC_PATH = 'docs/specs/semver-precedence-policy.md';

const ROOT_INDEX_WITH_SPECS = {
  path: 'docs/index.md',
  content:
    '---\nokf_version: "0.1"\n---\n\n# Fixture bundle\n\n## Repo-wide\n\n- [Conventions](/conventions/index.md) - repo-wide rules\n- [Specifications](/specs/index.md) - versioned contracts\n- [References](/references/index.md) - external material mirrored as concepts\n',
};
const ROOT_LOG = { path: 'docs/log.md', content: LOG };
const SPECS_INDEX = {
  path: 'docs/specs/index.md',
  content:
    '# Specifications\n\nVersioned contracts.\n\n- [Version-precedence policy](/specs/semver-precedence-policy.md) - how the tool orders versions\n',
};

// A conformant Specification whose Open Question HAS an authoritative answer in
// the SemVer 2.0.0 spec (pre-release versions have lower precedence than the
// associated normal version) — so a correct Specification-resolution run narrows
// or removes the `(unresolved)` marker.
export const RESOLVABLE_SPEC =
  '---\n' +
  'type: Specification\n' +
  'title: Version-precedence policy\n' +
  'description: How the tool orders release versions when resolving dependencies.\n' +
  'timestamp: 2026-07-20\n' +
  '---\n\n' +
  '# Version-precedence policy\n\n' +
  '## Overview\n\n' +
  'The resolver orders candidate versions to pick the highest acceptable release. (SENTINEL spec-overview)\n\n' +
  '## Behaviour\n\n' +
  'Numeric release fields are compared left to right.\n\n' +
  '## Open Questions\n\n' +
  '- Does a pre-release version (e.g. `1.0.0-rc.1`) rank lower than its associated normal version `1.0.0`? (unresolved) (SENTINEL spec-open-question)\n';

// A conformant Specification whose Open Question is genuinely SPECULATIVE — no
// authoritative source can answer what a hypothetical future major version will
// decide — so a correct run leaves the target byte-preserved and reports the gap.
export const UNRESOLVABLE_SPEC =
  '---\n' +
  'type: Specification\n' +
  'title: Version-precedence policy\n' +
  'description: How the tool orders release versions when resolving dependencies.\n' +
  'timestamp: 2026-07-20\n' +
  '---\n\n' +
  '# Version-precedence policy\n\n' +
  '## Overview\n\n' +
  'The resolver orders candidate versions to pick the highest acceptable release. (SENTINEL spec-overview)\n\n' +
  '## Behaviour\n\n' +
  'Numeric release fields are compared left to right.\n\n' +
  '## Open Questions\n\n' +
  '- Which precedence rule will a hypothetical, unpublished SemVer 3.0 adopt for build metadata? (unresolved) (SENTINEL spec-open-question)\n';

export function specBundle(specContent) {
  return [
    ...MACHINERY,
    ROOT_INDEX_WITH_SPECS,
    ROOT_LOG,
    SPECS_INDEX,
    { path: SPEC_PATH, content: specContent },
    REFERENCES_INDEX,
    REFERENCES_LOG,
  ];
}

// =====================================================================
// References-only bundle (reconnaissance + collision cases).
// =====================================================================

const ROOT_INDEX_REFS = {
  path: 'docs/index.md',
  content:
    '---\nokf_version: "0.1"\n---\n\n# Fixture bundle\n\n## Repo-wide\n\n- [Conventions](/conventions/index.md) - repo-wide rules\n- [References](/references/index.md) - external material mirrored as concepts\n',
};

const REFS_BASE = [...MACHINERY, ROOT_INDEX_REFS, ROOT_LOG, REFERENCES_INDEX, REFERENCES_LOG];

// Reconnaissance: an empty References area — a correct recon run writes ONLY the
// dated brief OUTSIDE the bundle and performs no index/log ceremony, so the
// bundle stays byte-preserved.
export const reconBundle = [...REFS_BASE];
// The prompt dictates this exact path so the brief is deterministically
// assertable; the contract point (write OUTSIDE the bundle, no OKF ceremony) is
// the skill's, not the path.
export const RECON_BRIEF_PATH = 'research/2026-07-24-semver-precedence-recon.md';

// Collision: the slug the topic "Semantic Versioning precedence" produces is
// ALREADY occupied by an UNRELATED concept. A correct run must stop for
// confirmation and never overwrite it.
export const COLLISION_REF_PATH = 'docs/references/semver-precedence.md';
const EXISTING_UNRELATED_REF =
  '---\n' +
  'type: Reference\n' +
  'title: Database index precedence in query planning\n' +
  'description: How a SQL planner chooses among candidate indexes — unrelated to release versioning.\n' +
  'timestamp: 2026-07-18\n' +
  '---\n\n' +
  '# Database index precedence in query planning\n\n' +
  '## Overview\n\n' +
  'The planner ranks candidate indexes by selectivity and cost. (SENTINEL unrelated-collision-body)\n\n' +
  '# Citations\n\n' +
  '- Existing curated note, do not overwrite.\n';
const REFERENCES_INDEX_WITH_COLLISION = {
  path: 'docs/references/index.md',
  content:
    '# References\n\nExternal material mirrored as first-class concepts.\n\n- [Database index precedence](/references/semver-precedence.md) - query-planner index choice\n',
};

export const collisionBundle = [
  ...MACHINERY,
  ROOT_INDEX_REFS,
  ROOT_LOG,
  REFERENCES_INDEX_WITH_COLLISION,
  REFERENCES_LOG,
  { path: COLLISION_REF_PATH, content: EXISTING_UNRELATED_REF },
];
