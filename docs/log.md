# Bundle change log

## 2026-07-25

- **Update** of [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md)
  — amended for the acceptance-matrix parity gate (#63): the committed acceptance
  matrix (`tools/acceptance/matrix.mjs`) mapping every (channel × harness) cell to
  deterministic packaging evidence plus a genuine live behavioral attestation
  (`tools/acceptance/live-attestations.json`), the CI-gated `advertised == proven`
  invariant test that keeps OpenCode-native present-and-unsupported and withholds any
  cell missing either evidence class, the new dependency-completeness check in the
  static portable contract, and the reconciled Claude model default. No decision was
  reversed; the deterministic-only oracle and provenance rules are unchanged.
- **Update** of [Benchmark metrics and comparison design](/decisions/benchmark-metrics-and-comparison-design.md)
  — appended a dated note (#63) superseding the 2026-07-17 amendment's live-file
  citation: the Claude driver default in `tools/test-runner/drivers.mjs` is now the
  canonical hyphenated `claude-opus-4-8`, so the historical parenthetical pointing at
  the dotted `claude-opus-4.8` in that live file no longer holds. The dated history is
  left intact; the note cross-references the reconciliation.
- **Creation** of [Skill-contract recognition tests](/conventions/skill-contract-tests.md)
  — the deterministic suites that keep a prose-defined skill contract present had no
  concept anywhere, while the bundle's acceptance prose ("observable outcomes, not
  prose") read as forbidding them; an engineer meeting an opaque failure at a prose
  assertion would read the bundle as licence to delete it and silently retire acceptance
  evidence. The Convention fixes what the tier may assert (a stated contract commitment,
  case-definition shape, the static portable contract), the prohibition that a
  recognition pass is never behavioral evidence for a distribution cell, and the
  obligation that contract prose and its assertion co-change.
- **Update** of [install.sh — development-links install wizard](/specs/install-sh.md) —
  now the contract of the shipped checkout installer rather than the rebuild it once
  proposed: the operator entry point is a launcher over a Node CLI and its single-purpose
  modules; the dependency graph is validated before any prompt or plan exists, not after
  confirmation; the interactive step selects harnesses only, with profiles, custom
  configuration roots, and scope reached by flag; the flag surface and the four nonzero
  exit classes are fixed rather than implementer-owned; and scope placement, checkout Git
  provenance, and rerun reconciliation (pruning only links this checkout owns, collapsing
  coincident placements) are specified for the first time. The pasted registry shape gave
  way to prose naming the registry's axes, plus why the registry — not the native
  channel — owns native adapter metadata and the shared-read list.
- **Update** of [Skills library & building platform — PRD](/specs/skills-platform.md) —
  distribution, automation, benchmark, and CI statements now match the delivered
  platform. The checkout channel is an advertised package shape across all three harness
  products rather than a development-only affordance; the portable channel is whole-pack
  only; the one-shape-per-profile rule is an enforced pre-mutation refusal instead of an
  unbacked prohibition; `scripts/` and `tools/` list what they actually hold; benchmark
  runs are single-arm with harness breadth distinguishing the presets, and the paired
  arm, with/without delta, regression flag, and baseline promotion are recorded as
  deferred rather than current; and CI is three static gates, the third carrying the
  acceptance matrix's `advertised == proven` invariant. Precedence now points at the v2
  skill-suite spec for the harness matrix and at the installer spec for the checkout
  contract.
- **Update** of [Native aggregate plugins & release script](/specs/native-plugins-and-release.md)
  — native packaging and the release ritual are recorded against their single sources.
  The manifests stay hand-authored, but their plugin/marketplace ids and the documented
  install and update operations have exactly one definition in the harness registry,
  which the generated README native block renders and the manifest tests verify against
  the committed manifests, so guidance, manifests, and tests cannot drift; native
  OpenCode packaging is asserted absent rather than merely unmentioned. The release
  script's staleness guard is existence-only over the committed summaries directory and
  warns and proceeds; the benchmark harness has since shipped into that same directory,
  and baseline promotion, full-preset selection, and recent-ancestor matching are
  deferred by the benchmark decision rather than awaiting a harness. The preflight's
  origin-remote requirement is now listed.
- **Update** of [Use three skill distribution channels](/decisions/skill-distribution-channels.md)
  — amended for the shipped channel shapes. Portable installation is advertised as the
  whole pack only: the selectivity earlier made contingent on upstream dependency support
  never arrived, so no supported journey offers a per-skill picker. The checkout channel
  is an advertised package shape across Claude Code, Codex, and OpenCode, with no native
  OpenCode plugin. The prohibition on mixing package shapes in one profile is enforced
  before any mutation by a managed-marker refusal naming the conflicting path and
  channel, and it also forbids overlaying checkout links onto a managed install — a case
  the original text did not address. Per-harness placements, plan deduplication,
  provenance, and stale-link ownership belong to the v2 spec and the installer spec, not
  to this decision. The Amendments heading was raised to level one.
- **Update** of [Snapshot releases with mirrored manifest versions](/decisions/versioning-and-release-policy.md)
  — amended to narrow decision 3 to where the version actually lives: only the two native
  plugin manifests carry the snapshot version, and the release script bumps both so they
  cannot diverge from the tag. The marketplace catalogs deliberately carry no version
  field, so the earlier wording about bumping marketplace manifests overstated the
  surface. One number still answers what version is installed across the native channel.
  The Amendments heading was raised to level one.
- **Update** of [OKF documentation skill-suite v2](/specs/okf-docs-skill-suite-v2.md) —
  turned from a target-state contract into the description of the shipped suite: the
  status section, the advertised-only-when-proven rule, and the now-closed
  implementation-delta record match the landed #47–#63 implementation; the single shipped
  Claude rule replaces the two planned pointers; the old-identity absolute is scoped to
  live surfaces, with the historical and explanatory places the retired name still occurs
  — prior Decisions, this log, dated `research/` briefs and handoffs, test comments — named
  rather than denied; the
  restated validator floor includes a non-scalar `type` and the documented YAML subset,
  with the validator Specification named as the oracle's authority; and the copied
  autoresearch budgets and Reference skeleton give way to citations of their single
  sources in the docs-autoresearch skill.
- **Update** of [Enforce minimal OKF errors through one strict validator contract](/decisions/okf-docs-strict-validation.md)
  — amended because the decision text promised husky v4 and v8/v9 pre-push recipes that
  were never written: `skills/docs-validate/SKILL.md` names only the `pre-push` hook and
  hands the wiring to docs-setup, and no skill carries a recipe. The settled position —
  the plain `docs:validate` script behind a documented `pre-push` name, no installed hook,
  no husky dependency, no `prepare` script, and the optional pull-request workflow — is
  untouched, so this is unwritten work rather than a reversal. It also brings the Decision
  back into agreement with the two Specifications corrected the same day. The Amendments
  heading was raised to level one so the validator's amendment region sees the dated entry.
- **Update** of [Install contract](/docs-setup/specs/install-contract.md) — pre-push
  enforcement is still never installed and setup still adds no husky dependency or
  `prepare` script, but the concept no longer claims plain-hook and husky recipes are
  documented in the docs-validate skill. The documented portable hook is `pre-push`
  running the package-manager-neutral `docs:validate` script; no concrete recipe ships in
  any skill.
- **Update** of [OKF validator behaviour and invocation](/docs-setup/specs/validator.md)
  — the enforcement-wiring section no longer locates plain-Git, husky v4, and husky
  v8/v9 pre-push recipes in the docs-validate skill, which ships none. It records the
  shipped position: a documented `pre-push` invocation of plain `npm run docs:validate`,
  with setup installing no hook, no husky dependency, and no package lifecycle script.
- **Update** of [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md)
  — a second dated amendment, distinct from the parity-gate entry above. It corrects
  decision 3's cardinality (a case directory is a case ID, decoupled from the projected
  skill by the case manifest, so one skill carries sibling case variants while cases stay
  central and never ship to an install) and records the harness capability classes the v2
  acceptance cases rest on: the write-path Git guarantee and why a clean tree cannot be
  required where an install legitimately writes, exact-change-set and baseline-content
  proofs as robust negatives, execution-trace budget invariants whose ceilings are
  checker-owned so a run cannot satisfy them by reporting its own bound, the fixture's
  deterministic baseline-branch pin and its uncommitted-input seam, and the bound on the
  parity gate — an attestation binds to its recorded commit, not to a content hash of the
  pack it exercised, so re-recording after a skill-content change is a manual obligation.
  Its `Amendments` heading was raised to level one so the dated entries fall inside the
  region the validator scans.
- **Update** of [Benchmark metrics and comparison design](/decisions/benchmark-metrics-and-comparison-design.md)
  — a second dated amendment, on retention rather than model ids. Decision 3's
  raw-artifact enumeration over-claimed: resulting fixture state is never retained and
  cannot be, because fixtures are ephemeral out-of-repo tmpdirs that both the benchmark
  flow and the runner CLI destroy. The retained local set has meanwhile grown numbered
  transcripts for later resumed turns and a run-level cross-harness comparison record
  beside per-assertion results and per-leg provenance. The commit-summaries /
  keep-raw-artifacts-local split itself is unchanged. Its `Amendments` heading was raised
  to level one so the dated entries fall inside the region the validator scans.
- **Update** of [Benchmark run artifacts](/references/benchmark-run-artifacts.md) —
  repointed at its live governing concepts, replacing a pointer to a design spec deleted
  from the bundle on 2026-07-17, and reframed the two artifact homes as the flow's write
  destinations — created on demand immediately before each write and tolerated absent by
  the release script's baseline-freshness check — rather than directories that already
  hold committed artifacts.
- **Update** of [Test-profile provisioning](/conventions/test-profile-provisioning.md) —
  scoped two over-general claims to what the script actually verifies: the
  real-config-unchanged confinement proof (a before/after recursive mtime snapshot that
  downgrades the leg to BLOCKED) exists for opencode only, and claude-code's verdict is
  the CLI's own `loggedIn` field rather than marker existence — marker existence being
  what the runner's preflight checks. Also corrected the codex `--skip-git-repo-check`
  rationale: every fixture has been a git repo with a pinned baseline since the opencode
  fixture-escape fix, so the flag is defensive rather than required by a non-git fixture,
  and out-of-repo is not the same as non-git.
- **Update** of [Benchmark and test run flow handoff](/superpowers/handoffs/2026-07-17-benchmark-run-flow-handoff.md)
  — bounded with a dated scope note, its body byte-preserved as accepted history: the
  case identity it exercises throughout was retired, its one-case-per-skill invariant is
  lifted, its cited run artifacts were removed, its harness file map and oracle
  description are now incomplete, its branch shipped, and its governing spec and plan
  paths were deleted from the bundle — with readers pointed at the skill-testing
  architecture amendments and the benchmark run artifacts concept for current truth.
- **Update** of [Documentation lifecycle policy](/conventions/documentation.md) — the
  repo-wide directory enumeration is open rather than closed (`decisions/` and `specs/`
  join `conventions/`, `glossary/`, `references/`), the illustrative frontmatter block
  records `resource` as the recommendation Reference concepts carry, and the update
  ceremony is stated as the author's obligation under this policy — the `docs-authoring`
  Claude rule described as the optional, path-scoped, deletion-safe adapter it actually
  is, with `docs:validate` as the backstop that does not depend on it. No ceremony
  obligation changed.
- **Update** of [Open Knowledge Format (OKF) v0.1](/references/okf.md) — the Tooling
  paragraph now says which part of §9 this repo's validator actually gates: parseable
  frontmatter and a non-empty `type` are hard errors, while reserved-file structure and
  everything beyond the floor are non-blocking warnings. The summary of the external spec
  is unchanged; readers no longer mis-read `index.md`/`log.md` defects as exit-1 errors.
- **Update** of [mattpocock/skills skill library](/references/mattpocock-skills.md) — the
  CLI-ownership citation points at the research notes that still exist and still carry
  the confirming command output, replacing a pointer to a research file deleted from the
  repo. The claim and the commit-pinned citations are unchanged.
- **Update** of [Harness](/glossary/harness.md) — the supported install targets are one
  declarative harness registry covering three harness products, each with a project and a
  global skill directory and Claude Code's global root selected by an environment
  variable, replacing a citation to a default-targets list that no longer exists and an
  enumeration of two Claude profiles plus a shared directory.
- **Update** of [Skill](/glossary/skill.md) — skill delivery is defined as the three
  mutually exclusive package shapes (checkout links, managed portable whole-pack copy,
  native aggregate plugin) instead of symlinking with one exception, and `docs-setup`'s
  asset copy is separated out as installing documentation machinery into a target
  repository rather than delivering a skill to a harness.
- **Update** of [Skill dependency](/glossary/skill-dependency.md) — dependency closure is
  present by construction because every supported channel delivers the complete pack; the
  term no longer describes per-skill selection expanding a closure. Installer rejection of
  a missing dependency or a cycle stays a requirement, and closure resolution is located
  where it is actually live — projecting a skill and its dependencies into a test fixture.
- **Update** of [CI and automation wiring](/decisions/ci-and-automation-wiring.md) —
  amended for CI's third gating step: the deterministic `npm test` suite (installer and
  plugin manifests, the managed-channel README generator, the acceptance-matrix parity
  invariant, test-runner and benchmark units) also turns the job red, so red means linter
  ERRORs, docs-validate hard errors, or a deterministic test failure. The inference-free,
  keyless, static-only rationale is untouched because the suite runs no model. The
  Amendments heading was raised to level one so the validator's amendment region — and
  therefore this decision's dated history — is visible to the staleness check.
- **Update** of [Declare skill dependencies in SKILL.md](/decisions/skill-dependencies.md)
  — amended for whole-pack distribution: with no per-skill picker in any supported
  channel, dependency closure holds by construction rather than by CLI resolution, which
  makes the selective-portable-installation target and its `--no-deps` bypass historical.
  The machine-readable contract (bare names in `## Required skills`, slash-only runtime
  invocation, missing-node and cycle rejection) is unaffected and enforced. A deleted
  research pointer is recorded as gone, with the surviving evidence named. The Amendments
  heading was raised to level one.
- **Update** of [Skill authoring conventions and quality bar](/decisions/skill-authoring-conventions.md)
  — amended for two shipped movements: `references/` is a fourth first-class support role
  and a second progressive-disclosure target beside a flat UPPERCASE sibling file, and the
  exemplar is `docs-setup` at 259 body lines with three of five shipped skills now in the
  soft-200 WARN band and none near the hard 500 — the bar itself unchanged. Decision 5's
  live example was corrected to the post-rename identity, and the Amendments heading was
  raised to level one.
- **Update** of [Keep a tool-neutral docs bundle with specs as the canonical section](/decisions/okf-docs-bundle-shape.md),
  [Reconcile OKF knowledge by accepted state, not editing residue](/decisions/okf-docs-knowledge-lifecycle.md),
  [Deliver one portable OKF skill pack through deletion-safe adapters](/decisions/okf-docs-portability-and-distribution.md),
  [Separate OKF documentation skills by lifecycle responsibility](/decisions/okf-docs-skill-boundaries.md), and
  [Organize the library around flat, skill-owned directories](/decisions/skill-library-structure.md)
  — completed the `Amendments` heading normalization across the remaining Decisions so
  every Decision in the bundle now opens its amendment region on the exact level-one
  heading the taxonomy in [the lifecycle policy](/conventions/documentation.md) specifies
  and `scripts/validate-docs.mjs` → `newestAmendmentDate()` scans for. Four carried empty
  placeholder regions, where the level was a latent trap: a dated entry appended under the
  level-two heading would never have reached the staleness comparison. The fifth had a
  dated 2026-07-10 entry that the scan could not see. No amendment text, rationale, or
  decision content changed.
- **Deprecation** of the versioned OKF documentation suite Specification — removed after a section-level coverage audit (#65). Its durable content had no home of its own: the five governing Decisions, the validator and install-contract Specifications, and the shipped `SKILL.md` files already owned it, and the rest was suite-generation branding, migration narrative, a closed implementation-delta record, and a wayfinder plan of record. Facts were moved first: the ordered discovery path, the delegated-worker reading scope, the one-repository-one-bundle rule, and the provenance-not-fragile-links rule into the lifecycle policy; the managed-channel warning-adjacency rationale into the checkout-installer Specification; the byte-current wildcard rule into the install contract; the autoresearch defaults / mechanics / safety-floor ownership into the skill-boundaries Decision; and the one-approval-per-filing-plan rule into the knowledge-lifecycle Decision. Two claims it carried were already false when it was removed: the promised husky pre-push recipes were never written, and the shipped project-memory router carries no `docs-sync` clause.
- **Deprecation** of the whole-platform PRD — removed after a section-level coverage audit (#65). Every normative statement it held was a consolidation of a governing Decision that remains the authority, and four of its summary claims had gone stale (CI red on linter ERRORs alone, dependency safety by per-install closure, paired benchmark trials, three role-named support subdirs) — each already corrected by a dated amendment on the owning Decision. Two facts were moved first: the unemitted release-tag half of the benchmark provenance identity set, into the benchmark-metrics Decision; and the repo-wide rule that a test attaches at a CLI seam and never at internals, with the skill linter's every-class coverage obligation, into the testing-architecture Decision.
- **Update** of [Documentation lifecycle policy](/conventions/documentation.md) — gained the ordered progressive-discovery path, the delegated-worker explicit-reading-scope obligation, the one-repository-one-bundle rule, and the link-stable/provenance-for-ephemeral rule; the retired `docs-authoring` Claude adapter was dropped from the update ceremony, which is now the author's obligation plus the strict validator with no harness-specific documentation rule shipping. The docs-setup seed asset was mirrored in the same change.
- **Update** of [Git workflow](/conventions/git.md) — the commit-subject convention became prospective imperative prose from 2026-07-25 onward, replacing a claim that `git log` refuted; existing pull-request commits, including prefixed feature landings, are explicitly not rewritten.
- **Update** of [install.sh — development-links install wizard](/specs/install-sh.md) — the misleading supersession status note became a precise authority boundary (this concept owns detailed checkout mechanics; the distribution Decisions own the surrounding choices), every reference to the removed umbrellas was repointed, and the Channel-mixing guard gained the rationale for a mandatory adjacent guidance warning instead of an unenforceable preinstall hook.
- **Update** of [Native aggregate plugins & release script](/specs/native-plugins-and-release.md) — attributions to the removed platform PRD replaced by the governing Decisions; content unchanged.
- **Update** of [Skill authoring conventions and quality bar](/decisions/skill-authoring-conventions.md) — amended twice: WARN-band membership is now stated without pinning body-line counts, with `npm run lint:skills` as the authority; and a user-invoked `description` may retain concrete user-said trigger phrases provided it never authorizes implicit selection.
- **Update** of [Declare skill dependencies in SKILL.md](/decisions/skill-dependencies.md) — amended to record that `## Integration` heading presence is machine-enforced while its label grammar is a deliberately unparsed authoring convention.
- **Update** of [Skill dependency](/glossary/skill-dependency.md) — the same enforcement split corrected in prose; the earlier wording overstated what the linter checks.
- **Update** of [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md) — amended twice: the retention rationale for keeping the concept whole (line count triggers a semantic keep-or-split review, never a split or deletion), and the repo-wide rule that a test attaches at a CLI seam and never at internals.
- **Update** of [Benchmark metrics and comparison design](/decisions/benchmark-metrics-and-comparison-design.md) — amended to record that decision 5's release-tag provenance field is not emitted, without withdrawing the requirement.
- **Update** of [Reconcile OKF knowledge by accepted state, not editing residue](/decisions/okf-docs-knowledge-lifecycle.md) — removed the mandatory finish-time `docs-sync` obligation (#65): `docs-sync` is now an optional, user-invoked-only reconciliation workflow with two modes, never implicitly selected and not tied to a lifecycle stage, and the Consequence claiming the project router requires it before source-changing work concludes is deleted — the shipped router asset never carried that clause. Amended rather than superseded: the selected alternative is unchanged and the write-time obligation stands alone. The dated amendment now quotes both removed sentences verbatim, so the pre-change wording stays recoverable from the Decision itself rather than only from Git history. Also recorded that a complete filing plan is gated exactly once across the suite.
- **Update** of [Enforce minimal OKF errors through one strict validator contract](/decisions/okf-docs-strict-validation.md) — amended for enforcement ownership (#65): docs-setup owns enforcement discovery, planning, installation, upgrade, and verification while docs-validate owns running and interpreting the strict command; the managed workflow triggers on push and pull_request; local enforcement is one marked managed block on an already-active, repository-owned Husky pre-push path validating the complete bundle on every push, so there is no hook recipe; and enforcement is installed even when the bundle fails, reported independently of content.
- **Update** of [Separate OKF documentation skills by lifecycle responsibility](/decisions/okf-docs-skill-boundaries.md) — amended for the revised suite contract (#65): docs-setup and docs-sync are user-invoked-only, docs-setup additionally owns enforcement and versionless retired-surface convergence, deletion-safe Claude rule pointers are no longer repository-carried machinery, and the two-stage upgrade order is explicit with setup never triggering sync. A second entry records where docs-autoresearch's tunable defaults, fixed mechanics, and safety floor live.
- **Update** of [Deliver one portable OKF skill pack through deletion-safe adapters](/decisions/okf-docs-portability-and-distribution.md) — amended to record that the suite ships no harness-specific documentation-policy adapter (#65): portable project memory plus the lifecycle Convention are the required policy surfaces on every supported harness, `.claude/rules/docs-*` is a retired-surface tombstone, and no duplicated Claude-only rule remains for adapter drift to diverge from.
- **Update** of [Keep a tool-neutral docs bundle with specs as the canonical section](/decisions/okf-docs-bundle-shape.md) — amended to state that line count alone never mandates a deletion either (#65), so the removal of two long redundant Specifications is not read as a length precedent.
- **Update** of [Install contract](/docs-setup/specs/install-contract.md) — reconciled with the rewritten setup contract (#65): validation enforcement added as a sixth managed surface (managed workflow on push and pull_request, plus one marked block on an already-active Husky pre-push path) with the docs-setup/docs-validate ownership split; the two-optional-adapters framing and the retired Claude rule removed; new sections for versionless retired-surface convergence and the separation from docs-sync; the three-state managed-surface audit and wildcard currency rule added to the substitutions; and the plan's skip class, blocking ambiguities, and done criteria brought current.
- **Update** of [OKF validator behaviour and invocation](/docs-setup/specs/validator.md) — corrected the code-stripping description and the enforcement wiring (#65): fenced blocks are stripped before link, index-coverage, and amendment scanning, while inline code spans are stripped only for link and index-coverage scanning so an amendment title containing inline code stays recognized; and the two managed enforcement surfaces replace the never-written hook recipe and the pull-request-only workflow claim.
- **Update** of [Byte-exact assets contract](/docs-setup/conventions/byte-exact-assets.md) — dropped the `assets/claude/` rule now that the tree is gone (#65) and restated the leading-dot install rename for its one surviving case, `assets/github/` → `.github/`.
- **Update** of [Skill-contract recognition tests](/conventions/skill-contract-tests.md) — repointed the cross-harness-equivalence citation from the deleted v2 Specification to [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md), and dropped the "v2 acceptance contract" suite-generation branding in the same sentence (#65). No claim changed.
- **Update** of [Use three skill distribution channels](/decisions/skill-distribution-channels.md) — the 2026-07-25 "shipped channel shapes" amendment's two citations of the deleted v2 Specification now point at [Deliver one portable OKF skill pack through deletion-safe adapters](/decisions/okf-docs-portability-and-distribution.md), which settles the same channel-shape facts; the second citation keeps its companion link to [/specs/install-sh.md](/specs/install-sh.md) (#65). No claim changed.
- **Update** of [Snapshot releases with mirrored manifest versions](/decisions/versioning-and-release-policy.md) — the release-script sentence's dangling reference to "this map's locked spec" (the removed platform PRD) was replaced with a plain reference to this Decision itself (#65). No claim changed.

## 2026-07-24

- **Update** of [install.sh — development-links install wizard](/specs/install-sh.md) —
  reconciled the PRD with shipped three-harness behaviour (#61): added a supersession
  note pointing to the [v2 skill-suite spec](/specs/okf-docs-skill-suite-v2.md), and
  corrected the Channel-mixing guard and implementer-owned-gaps sections so they no
  longer describe the removed blanket `~/.agents/skills` warning or `CODEX_HOME`-based
  Codex resolution. Channel mixing is now a precise managed-shape refusal; Codex global
  resolves to a fixed `~/.agents/skills`.
- **Update** — completed the `docs-setup` identity migration (#60): retired the obsolete
  `okf-docs-setup` skill identity and renamed the subsystem to
  [docs-setup](/docs-setup/index.md). The skill now lives only at `skills/docs-setup/`,
  the subsystem bundle moved to `/docs-setup/`, and the
  [Install contract](/docs-setup/specs/install-contract.md),
  [Byte-exact assets contract](/docs-setup/conventions/byte-exact-assets.md), and
  [OKF validator behaviour and invocation](/docs-setup/specs/validator.md) were
  reconciled to the canonical five-skill suite (`docs-setup`, `docs-add`,
  `docs-validate`, `docs-sync`, `docs-autoresearch`). The legacy skill tree, its central
  test fixture, project-local nested helper-skill copies, and stale benchmark artifacts
  were removed, and the tests, README inventory, and cross-references now use the
  canonical identities.
- **Update** of
  [OKF validator behaviour and invocation](/docs-setup/specs/validator.md) and
  [Documentation lifecycle policy](/conventions/documentation.md) —
  documented the frontmatter oracle's YAML 1.2 subset (multi-line plain-scalar
  folding accepted; anchors, aliases, tags, multi-line quoted scalars, and
  multi-line flow collections unparseable; `__proto__` an ordinary key) and
  extended code stripping to amendment scanning, per the #49 review pass.
- **Update** of
  [OKF validator behaviour and invocation](/docs-setup/specs/validator.md),
  [Install contract](/docs-setup/specs/install-contract.md),
  [Byte-exact assets contract](/docs-setup/conventions/byte-exact-assets.md),
  [Documentation lifecycle policy](/conventions/documentation.md), and
  [OKF v0.1 reference](/references/okf.md) — implemented the strict validator
  contract (#49): 0/1/2 exits, YAML 1.2 frontmatter oracle, exact-path index
  coverage, stale-amendment warning, uniform no-exclusion walk, raw-byte mirror
  test, gating CI step, documented pre-push recipes, and the optional PR
  workflow asset. Amended
  [CI and automation wiring](/decisions/ci-and-automation-wiring.md),
  [Skill authoring conventions](/decisions/skill-authoring-conventions.md), and
  [Skill testing architecture](/decisions/skill-testing-architecture.md) to
  retire their advisory-validator claims.
- **Creation** of [superpowers](/superpowers/index.md) subsystem index and
  [handoffs index](/superpowers/handoffs/index.md), and conversion of the
  [benchmark run flow handoff](/superpowers/handoffs/2026-07-17-benchmark-run-flow-handoff.md)
  into a conformant concept — the bundle is now validated uniformly with no
  exclusion grammar (#49).
- **Update** of
  [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md)
  — amended with the v2 acceptance-harness seam (#48): plan/approval turns,
  git-state and execution-trace oracles, cross-harness outcome comparison, and
  static portable-contract checks.
- **Creation** of [OKF documentation skill-suite v2](/specs/okf-docs-skill-suite-v2.md)
  — assembled the implementation-ready destination contract for setup, authoring,
  validation, synchronization, autoresearch, migration, distribution, and parity.
- **Creation** of
  [Separate OKF documentation skills by lifecycle responsibility](/decisions/okf-docs-skill-boundaries.md)
  — assigned the five portable skills distinct responsibilities and one canonical
  library home.
- **Creation** of
  [Deliver one portable OKF skill pack through deletion-safe adapters](/decisions/okf-docs-portability-and-distribution.md)
  — fixed the shared semantic core, adapter boundary, and supported distribution
  matrix across Claude Code, Codex, and OpenCode.
- **Creation** of
  [Reconcile OKF knowledge by accepted state, not editing residue](/decisions/okf-docs-knowledge-lifecycle.md)
  — made executable sources authoritative for current behavior and defined
  synchronization and accepted-state compaction.
- **Creation** of
  [Enforce minimal OKF errors through one strict validator contract](/decisions/okf-docs-strict-validation.md)
  — fixed strict process exits, the blocking error floor, warning boundaries, portable
  enforcement, and raw-byte mirror checks.
- **Creation** of
  [Keep a tool-neutral docs bundle with specs as the canonical section](/decisions/okf-docs-bundle-shape.md)
  — retained the established bundle and section names while removing tool-specific and
  configurable validation exclusions.

## 2026-07-17

- **Update** — amended [Benchmark metrics and comparison design](/decisions/benchmark-metrics-and-comparison-design.md):
  recorded the per-harness model knob — `tools/benchmarks/models.mjs` maps
  claude-code/codex/opencode to pinned model ids, threaded into `runCase` via
  `harnessSelections {id, model}`, overriding the plan's original `model: null`
  (which fell back to each driver's baked default, including claude-code's
  malformed dotted `claude-opus-4.8`) — and the claude-code test-profile auth
  check switching from a global macOS-Keychain existence check (false-positive)
  to the CLI's own `claude auth status --json` `loggedIn` verdict in
  `scripts/setup-test-profiles.sh` (#25).
- **Update** — amended [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md):
  recorded the opencode fixture-escape fix — `run` resolves its project by a
  `.git` walk-up plus a persistent per-profile known-projects registry
  (`opencode.db`), not process cwd, so a non-git tmpdir fixture fell back to a
  stale real-repo project (seeded by a repo-root `opencode auth login`) and wrote
  into the real repo trees, undetectable by the live-daemon preflight since it is
  stale state, not a live process. Fixed with `run --dir <fixtureRoot>`
  (`tools/test-runner/drivers.mjs`), `git init`+baseline-committed fixtures
  (`tools/test-runner/fixture.mjs`), a throwaway-cwd login, and a new
  `check_opencode_no_repo_project` stale-state guard in
  `scripts/setup-test-profiles.sh` (#24, fixed during #25).
- **Creation** of [Benchmark run artifacts](/references/benchmark-run-artifacts.md)
  — the OKF Reference pointing at the committed `tools/benchmarks/summaries/` and
  `tools/benchmarks/reports/` artifacts produced by `npm run bench` (#25).

## 2026-07-16

- **Update** — amended [Benchmark metrics and comparison design](/decisions/benchmark-metrics-and-comparison-design.md):
  recorded the #25 rescope to a single-arm run+report flow — with/without
  comparison arm, advisory regression flag, and baseline promotion deferred;
  `full` trial count 1 not 5; provenance identity set, commit-summary/local-raw
  retention split, and the deterministic no-cross-case-blend report principle
  carried over unchanged.
- **Update** — amended [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md):
  live-run isolation moved to persistent pre-authenticated test profiles under
  `~/.skills-test-profiles/`, resolved the codex HOME-derived skill-discovery
  leak (finding #4, Option A: relocate `HOME` into the profile), added the
  opencode daemon preflight and the four-rung actionable-skip ladder, and added
  per-run model/harness-version provenance (`run.json`, `--harness <id>[=<model>]`).
- **Update** — [Harness](/glossary/harness.md) gains the *test profile* usage of
  harness profile.
- **Update** — [Test-profile provisioning](/conventions/test-profile-provisioning.md):
  reframed the codex caveat now that `CODEX_HOME` + `HOME` together confine the
  HOME-derived `~/.agents/skills` leak (finding #4 resolved).

## 2026-07-15

- **Creation** of [Test-profile provisioning](/conventions/test-profile-provisioning.md)
  — provisioning the per-harness test profiles via `scripts/setup-test-profiles.sh` (fixed
  `~/.skills-test-profiles/<id>/` root, per-harness login/auth-marker, OAuth-pause flow,
  cross-machine setup), plus the codex `--skip-git-repo-check` and global `~/.agents/skills/`
  caveats.

## 2026-07-14

- **Update** — amended [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md):
  reconciled the #24 test-runner tracer bullet — advisory-signal recording
  (Decision 2) deferred, and the disposable fixture (Decision 1) built outside
  the repo under `os.tmpdir()` for discovery isolation with the immutability
  proof widened to `docs/`/`scripts/`/`.claude/`.

## 2026-07-11

- **Creation** of [Native aggregate plugins & release script](/specs/native-plugins-and-release.md)
  — implemented issue #21: Codex + Claude Code plugin/marketplace manifests, the
  `scripts/release.mjs` snapshot-release ritual, and the README native-channel
  instructions; resolves the platform PRD's release-script and `scripts/`↔`tools/`
  implementer-owned gaps.
- **Update** — rewrote [Skills library & building platform — PRD](/specs/skills-platform.md)

- **Update** — rewrote [Skills library & building platform — PRD](/specs/skills-platform.md)
  from the locked-spec format into the to-spec PRD template (problem/solution, user
  stories, per-area implementation decisions, testing seams, out-of-scope,
  implementer-owned notes); all normative Decision content preserved, no decisions
  reopened.
- **Update** — rewrote [install.sh — development-links install wizard](/specs/install-sh.md)
  from the current-script contract into the forward-looking PRD for the issue #16
  rebuild (registry-driven wizard, harness profiles, dependency-graph validation,
  whole-library symlinking), resolving the platform spec's precedence note.
- **Creation** of [Skills library & building platform — locked specification](/specs/skills-platform.md)
  — assembled the destination artifact of wayfinder map #1 from the eight governing
  Decisions: repository structure, three distribution channels, skill dependencies,
  authoring conventions, versioning/releases, testing/benchmark harness, and CI wiring,
  plus the implementer-owned gaps (wayfinder ticket #8; closes the map).
- **Creation** of [CI and automation wiring](/decisions/ci-and-automation-wiring.md)
  — decided static-only push/PR CI red on linter ERRORs, keeping all inference-bearing
  runs (skill cases, contract tests, benchmarks) local with no API keys or scheduled
  workflows, and an advisory staleness warning in the release script (wayfinder
  ticket #13).
- **Creation** of [Benchmark metrics and comparison design](/decisions/benchmark-metrics-and-comparison-design.md)
  — decided smoke/full trial presets, the advisory ≥2-of-5-trial regression flag,
  committed summary JSON with git-ignored raw artifacts, release-promoted baselines,
  the identity-set provenance schema, and per-case no-blend reporting (wayfinder
  ticket #12).
- **Creation** of [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md)
  — decided the trimmed repo-owned test harness in tools/ (fixture builder + headless
  harness CLIs, Promptfoo/Harbor deferred), deterministic-first grading with advisory
  LLM judge, central tools/tests/<skill>/ case directories, and paired-trial benchmarks
  across harnesses, snapshots, and models with provenance (wayfinder ticket #5).
- **Creation** of [Snapshot releases with mirrored manifest versions](/decisions/versioning-and-release-policy.md)
  — GitHub releases as semver-shaped snapshot tags with no compatibility contract,
  plugin manifest versions mirroring the tag, and a scripts/ release script owning the
  bump-commit-tag-release ritual; dev-symlink and npx channels keep tracking git.
- **Creation** of [Skill authoring conventions and quality bar](/decisions/skill-authoring-conventions.md)
  — layered trigger-only descriptions, a minimal section skeleton with canonical
  optional headings, the invocation-axis frontmatter allowlist, role-named support
  subdirs, soft-200/hard-500 disclosure, and an advisory two-tier linter on top of the
  portable Agent Skills floor.
- **Creation** of [obra/superpowers skill library](/references/obra-superpowers.md)
  — recorded the example-reference project and the authoring/portability ideas this
  library borrows from it (trigger-only descriptions, actions-not-tools, strength-marked
  cross-references, baseline-fail testing).
- **Creation** of [mattpocock/skills skill library](/references/mattpocock-skills.md)
  — recorded the inspiration-baseline project and the ideas borrowed from it (minimal
  frontmatter, invocation axis, sibling-file progressive disclosure, meta-skill quality
  bar) plus the conscious divergences.

## 2026-07-10

- **Creation** of [Agent skill testing and benchmarking landscape](/references/agent-skill-testing-landscape.md)
  — surveyed deterministic validation, headless OpenCode/Codex/Claude runs, Promptfoo,
  Harbor, Anthropic evaluation workflows, and skills.sh signals to inform the
  testing-architecture decision.
- **Creation** of [Organize the library around flat, skill-owned directories](/decisions/skill-library-structure.md)
  — recorded the flat skill tree, tooling boundaries, skill-owned assets, README
  synchronization rule, and amended home for skill-specific contracts.
- **Creation** of [Declare skill dependencies in SKILL.md](/decisions/skill-dependencies.md)
  — standardized cross-skill declarations, invocation, validation, and installation
  behavior.
- **Update** of [Skill dependency](/glossary/skill-dependency.md) — standardized separate
  machine-readable `## Required skills` and explanatory `## Integration` sections.
- **Update** of [Skill dependency](/glossary/skill-dependency.md) — separated plain
  canonical names in `## Required skills` from slash-prefixed runtime invocation syntax.
- **Update** of [Skill dependency](/glossary/skill-dependency.md) — replaced the proposed
  metadata declaration with a mandatory `## Required skills` section and canonical
  `/skill-name` entries.
- **Update** of [Use three skill distribution channels](/decisions/skill-distribution-channels.md)
  — amended development installation to link the whole library and recorded the portable
  dependency-resolution constraint.
- **Update** of [Skill dependency](/glossary/skill-dependency.md) — chose namespaced
  `SKILL.md` metadata, canonical-name runtime references, safe default closure, and an
  explicit bypass.
- **Update** of [Skill dependency](/glossary/skill-dependency.md) — made transitive
  dependency closure mandatory and missing dependencies or cycles installation errors.
- **Creation** of [Skill dependency](/glossary/skill-dependency.md) — defined required
  runtime relationships between skills.
- **Update** of [/glossary/harness.md](/glossary/harness.md) — distinguished a harness
  product from independently configured harness profiles and recorded the
  `CLAUDE_CONFIG_DIR` and `CODEX_HOME` isolation boundaries.
- **Creation** of [Use three skill distribution channels](/decisions/skill-distribution-channels.md)
  — separated development symlinks, portable pure-skill installation, and native
  aggregate plugins; defined profile exclusivity and the registry-driven flow for
  adding harnesses. Adds the reserved [/decisions/index.md](/decisions/index.md).
- **Creation** of [/glossary/harness.md](/glossary/harness.md) — the term "harness":
  the agent runtime a skill is installed into, with today's supported install
  targets.
- **Creation** of [/glossary/skill.md](/glossary/skill.md) — the term "skill": a
  directory-rooted capability bundle defined by a root `SKILL.md`, the unit this
  library stores and distributes.
- **Creation** of [/specs/install-sh.md](/specs/install-sh.md) — contract of
  `scripts/install.sh`: SKILL.md discovery (and the current `skills/<name>/` layout
  mismatch, pending issue #4), the default harness targets (`~/.agents/skills`,
  `~/.claude/skills`, `~/.claude-work/skills`), symlink-not-copy mechanics, re-run
  safety, and exit semantics. Adds the reserved `/specs/index.md`.
- **Creation** of [/docs-setup/specs/install-contract.md](/docs-setup/specs/install-contract.md)
  — the docs-setup install contract: what an install delivers (docs bundle, validator
  scripts, `.claude` rules and helper skills, package.json scripts), the per-install
  substitutions, the `claude/` → `.claude/` rename, the machinery-vs-content phase
  structure, and the zero-hard-errors done criteria.
- **Creation** Added the `docs-setup` subsystem index node (`/docs-setup/index.md`)
  covering the skill that bootstraps OKF v0.1 docs bundles in target repos.
- **Creation** of [/docs-setup/conventions/byte-exact-assets.md](/docs-setup/conventions/byte-exact-assets.md)
  — byte-exact assets contract, intentional placeholders, the `pnpm docs:validate`
  substitution target, and the `claude/` → `.claude/` install rename, converted from `AGENTS.md`.
- **Creation** of [/docs-setup/specs/validator.md](/docs-setup/specs/validator.md)
  — validator behaviour (advisory exit 0, hard errors vs soft warnings, `excludedTopLevelDirs`,
  the one benign policy-link warning) and repo invocation via `npm run docs:validate`,
  converted from `AGENTS.md`.
- **Creation** of [/conventions/git.md](/conventions/git.md) — repo-wide git convention
  (branch `main`, descriptive prose commit subjects), converted from `AGENTS.md`.
- **Initialization**: Established the OKF v0.1 bundle skeleton (root, conventions,
  glossary, references) and installed the validator, the `docs-authoring` rule, and the
  `docs-add` / `docs-validate` skills.
- **Creation**: Authored the governance concept
  [Documentation lifecycle policy](/conventions/documentation.md) and the
  [OKF reference](/references/okf.md).
