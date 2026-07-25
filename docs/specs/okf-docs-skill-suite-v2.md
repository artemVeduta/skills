---
type: Specification
title: OKF documentation skill-suite v2
description: Implementation-ready contract for a portable five-skill OKF documentation suite, its repository machinery, lifecycle, research flow, validation, distribution, migration, and cross-harness acceptance tests.
timestamp: 2026-07-25
---

# OKF documentation skill-suite v2

This is the destination artifact of
[Wayfinder map: OKF docs skill-suite v2](https://github.com/artemVeduta/skills/issues/28).
It consolidates the map's resolved decisions without reopening them and is the handoff
to implementation planning and sub-agent-driven development.

The suite is version 2; the bundle format remains upstream OKF v0.1 and root
`docs/index.md` continues to declare `okf_version: "0.1"`.

## Status and precedence

The suite shipped through the #47–#63 implementation slices, so this Specification now
describes the shipped suite rather than a target state. Code remains authoritative for
current shipped behavior; the linked Decisions below remain the rationale of record.
Where a current-behavior concept and the code conflict, the code wins and the concept is
reconciled in the same slice that changes it.

Rationale and alternatives live in:

- [Separate OKF documentation skills by lifecycle responsibility](/decisions/okf-docs-skill-boundaries.md)
- [Deliver one portable OKF skill pack through deletion-safe adapters](/decisions/okf-docs-portability-and-distribution.md)
- [Keep a tool-neutral docs bundle with specs as the canonical section](/decisions/okf-docs-bundle-shape.md)
- [Reconcile OKF knowledge by accepted state, not editing residue](/decisions/okf-docs-knowledge-lifecycle.md)
- [Enforce minimal OKF errors through one strict validator contract](/decisions/okf-docs-strict-validation.md)

## Destination

Deliver one whole-pack documentation suite that produces the same semantic result in
Claude Code, Codex, and OpenCode:

- conservative setup and upgrades;
- direct concept creation;
- deterministic validation;
- branch-scoped or bundle-wide semantic reconciliation;
- bounded, safe, curated autoresearch;
- strict producer-side enforcement with only OKF-conformance errors blocking;
- portable installation, native plugins where supported, and checkout links;
- no harness-specific workflow fork or third-party workflow dependency.

A channel/harness cell or skill contract is advertised as supported only once it has both
deterministic and live behavioral evidence; the gate that withholds unproven cells is
`tools/acceptance/matrix.mjs` → `CELLS` / `provenHarnessesByChannel()`.

## Domain language

| Term | Meaning |
| --- | --- |
| **Suite** | The complete top-level pack: `docs-setup`, `docs-add`, `docs-validate`, `docs-sync`, and `docs-autoresearch`. |
| **Repository machinery** | Validator and tests, package scripts, seed policy/reference files, marked project-memory wiring, the Claude shim, optional rule pointers, and optional enforcement assets. |
| **Current truth** | Code, tests, and configuration that execute or verify current behavior and values. |
| **Explanatory truth** | Intent, terminology, constraints, rationale, and accepted decision history retained in the bundle. |
| **Durable knowledge** | Content intentionally retrieved later independently of the run that produced it. |
| **Operational output** | Run exhaust, traces, raw captures, temporary research, and machine sidecars that do not stand alone as project knowledge. |
| **Semantic parity** | Equivalent required process, permissions, failure behavior, dependencies, and validated repository outcome across supported harnesses. |
| **Deletion-safe adapter** | Harness-specific convenience whose removal does not change required suite behavior. |
| **Branch sync** | Reconciliation from a user-selected target branch's common ancestor through the complete current working state. |
| **Bundle-wide reconciliation** | Audit and repair of the entire current repository/bundle without an unrelated-drift category. |
| **Accepted-state boundary** | Previously merged semantic history, preserved across ordinary sync; a material reversal crosses it and requires supersession. |

## Product and repository structure

### Canonical skills

All five skills live directly under `skills/` and follow the repository's existing
skill authoring and dependency conventions except where portability below narrows them.

| Skill | Responsibility | Required skills |
| --- | --- | --- |
| `docs-setup` | Fresh repository setup, tooling upgrade/reinstall, partial repair | `docs-add`, `docs-validate` |
| `docs-add` | One approved concept plus local index and lifecycle entry | none |
| `docs-validate` | Run and interpret the repository validator | none |
| `docs-sync` | Semantic reconciliation, creation, bookkeeping, compaction, verification | `docs-validate` |
| `docs-autoresearch` | Explicit bounded research and approved filing | `docs-add`, `docs-validate` |

`okf-docs-setup` is renamed completely to `docs-setup`. No live surface — skill directory,
skill name, dependency declaration, test-case directory, fixture, manifest, README
inventory entry, installed link, or invocation — uses the old identity. The name still
occurs as a historical or explanatory reference: in prior Decisions and the bundle log
that record the rename, in dated `research/` briefs and handoffs, and in test comments
naming what was retired. None of those are rewritten.

`docs-add` owns its templates beneath its own directory and references them
self-relatively. `docs-validate` contains no validator implementation and names the
package-manager-neutral `docs:validate` script. Setup contains no copied helper skills.

Every addition or removal updates the root README inventory in the same change.

### Bundle naming and membership

- Bundle root: `docs/`.
- Canonical Specification directory name: `specs/`.
- Reserved filenames and frontmatter continue to follow OKF v0.1.
- The suite knows no third-party tool or tool-specific docs path.
- Every retained non-reserved Markdown file under `docs/` is a concept and validates
  uniformly, including open-taxonomy types.
- There is no `.okfignore`, ignored subtree, universal artifact/archive directory, or
  validator configuration.
- One repository has one bundle. Monorepo workspaces are top-level subsystem nodes.

Durable generated or imported content is normalized as knowledge. Operational output
stays outside the bundle under project-owned conventions. A stable repository resource
may be linked directly; an external or generated collection that needs durable
explanation receives a `Reference`. Ephemeral outputs are represented by durable
provenance, not fragile links.

## Portable semantic contract

### Shared surfaces

The required behavior lives only in:

1. one concise marked Documentation block in root `AGENTS.md`;
2. byte-identical canonical skill trees and support files;
3. the `docs/` bundle; and
4. repository-owned shell commands.

Every `SKILL.md` satisfies the strictest shared-reader contract:

- `name` is 1–64 characters, matches
  `^[a-z0-9]+(-[a-z0-9]+)*$`, and equals the directory name;
- `description` is 1–1,024 characters and trigger-front-loaded; and
- the body is plain Markdown using relative-path progressive disclosure for support
  files.

The complete root-to-working-directory `AGENTS.md` instruction chain remains within
Codex's default 32 KiB budget.

The `AGENTS.md` block:

- points to the lifecycle authority and progressive discovery path;
- requires relevant concepts before non-trivial work;
- states current/explanatory truth ownership;
- requires affected concept content to change with source;
- requires `docs-sync` before source-changing work concludes;
- requires delegated workers to receive exact relevant concept paths; and
- routes direct creation and validation to `docs-add` and `docs-validate`.

It is delimited by stable markers, replaceable idempotently, and preserves all unrelated
project guidance.

### Discovery and adapters

Documentation discovery proceeds:

`docs/index.md` → affected subsystem `index.md` → applicable Decisions,
Specifications, Glossary concepts, and References → targeted repository search.

Root `CLAUDE.md` is exactly `@AGENTS.md`. Setup writes that shim only after classifying
all existing content: portable guidance moves to `AGENTS.md`, genuine Claude-only
convenience may move to an optional deletion-safe adapter, and ambiguity blocks.

One pointer-only, path-scoped Claude rule ships, at
`skills/docs-setup/assets/claude/rules/docs-authoring.md`. It carries no unique policy or
procedure. The former `docs-maintenance` rule was removed because it made docs
authoritative for current behavior. Codex receives no required `.codex` project
configuration. OpenCode receives no required configuration, plugin, command, agent
definition, or imported Claude rule.

Skills are placed or linked at the canonical paths each harness discovers. No
harness-specific `SKILL.md` overlay exists. Metadata may affect display and discovery
only. Workflow bodies use canonical capability names rather than slash commands or
plugin namespaces; channel/harness guidance owns invocation translation.

Checkout placements are:

| Harness | Project | Global |
| --- | --- | --- |
| Claude Code | `.claude/skills/` | `<CLAUDE_CONFIG_DIR>/skills/` (default `~/.claude/skills/`) |
| Codex | `.agents/skills/` | `~/.agents/skills/` |
| OpenCode | `.agents/skills/` | `~/.agents/skills/` |

OpenCode also reads Claude's locations. Selecting OpenCode adds no placement when a
selected Claude or Codex placement already exposes the pack. When Claude and Codex
require both project directories, OpenCode must still expose each canonical identity
once; duplicate discovery fails the conformance cell.

Required fanout uses native sub-agents or dynamic workflows in all three harnesses. The
portable pack contains no custom agent definitions, enablement instructions, capability
preflight, remediation flow, or inline fallback.

There is no `hot.md` cache and no seed/developing/mature/evergreen lifecycle.
`status: superseded` plus `superseded_by` remains the retirement mechanism.

## Distribution and update contract

The supported matrix is:

| Channel | Claude Code | Codex | OpenCode | Update owner |
| --- | ---: | ---: | ---: | --- |
| Portable whole-pack, global or project | yes | yes | yes | upstream `skills` updater |
| Native aggregate plugin | yes | yes | no | harness marketplace/plugin updater |
| Checkout links, global or project | yes | yes | yes | `git pull`; rerun installer for membership |

Portable installation uses the complete-pack shape
`npx skills@latest add artemVeduta/skills --skill '*'`. Checkout installation uses
`scripts/install.sh`. There is no supported skill picker.

A profile uses exactly one package shape. Portable and native forms never mix in one
profile; checkout links never overlay either managed form.

Before mutation, the checkout installer detects an already-present portable or native
shape and refuses the overlay with an exact path/channel explanation; the filesystem
remains unchanged. Portable and native lifecycle commands are owned by external
package managers, so their adjacent suite guidance carries a mandatory explicit
incompatibility warning rather than claiming an unenforceable preinstall hook.

The checkout registry models harness products and their supported global/project paths.
Selections that resolve to one directory produce one deduplicated plan. After pack
membership changes, rerunning the installer creates missing links and removes a stale
link only when it is owned by and points into that checkout. It never removes unrelated
entries or installs Git hooks.

Install, inspect, and update output identify provenance: Git commit/ref for portable
and checkout forms, plugin version/release for native forms. Independently updated
profiles may have different versions; parity is behavioral, not a synchronization
promise.

Native delivery uses the existing repository-root aggregate contract:

- Claude Code: `.claude-plugin/plugin.json` and
  `.claude-plugin/marketplace.json`; install with
  `claude plugin marketplace add artemVeduta/skills` then
  `claude plugin install skills@artemveduta`; update with
  `claude plugin marketplace update artemveduta`.
- Codex: `.codex-plugin/plugin.json` and
  `.agents/plugins/marketplace.json`; install with
  `codex plugin marketplace add artemVeduta/skills` then
  `codex plugin add skills@artemveduta`; update with
  `codex plugin marketplace upgrade artemveduta`.

Both manifests expose the complete `skills/` tree and mirror snapshot release versions
under the existing native-plugin release contract.

Updating a pack never mutates repositories previously configured by `docs-setup`.
Repository tooling upgrades require a later explicit setup run; semantic reconciliation
requires a separate `docs-sync`.

## Skill contracts

### `docs-setup`

`docs-setup` owns fresh install, tooling upgrade/reinstall, and partial repair. Every
run follows one conservative state-derived workflow:

1. Dispatch mandatory parallel read-only audits of managed machinery, package
   integration, project-memory wiring, Claude adapters, canonical-skill discovery, and
   stale project-local skill copies.
2. Recompute actual state; do not read or write a suite-version/state file.
3. Consolidate one dry-run plan and classify it as fresh, upgrade, or partial repair.
4. Show dirty-worktree state; upgrade is clean-worktree by default and requires
   explicit approval when dirty.
5. Present every create, replace, preserve, and delete action plus every ambiguity.
6. Wait for one explicit approval of the complete plan.
7. Apply the plan through one deterministic coordinator; there are no parallel writers.
8. Dispatch a fresh verifier for preservation, tests, validation, and idempotency.

Managed surfaces are:

- validator and validator tests;
- `docs:validate` and `docs:validate:test` package scripts;
- optional GitHub Actions validation asset and documented pre-push recipes;
- deletion-safe pointer-only Claude rules;
- seed lifecycle-policy and OKF-reference files;
- one marked `AGENTS.md` block;
- root `CLAUDE.md` as the exact shim; and
- discovery of canonical `docs-add` and `docs-validate`.

Fresh setup may create the reserved bundle skeleton. Once created, evolving project
indexes, logs, and concepts are not upgrade-managed.

Exact current-v2 managed files are no-ops. Missing files may be created after approval.
Every differing managed file is potentially customized and receives an explicit review
proposal; nothing is blindly overwritten. Recognized legacy wiring receives a proposed
replacement. Ambiguous lookalike prose is preserved and blocks completion.

Canonical helper skills must be discoverable before obsolete project-local v1 copies
are removed. A differing copy remains until the user resolves it. Setup does not rename
an existing `specifications/` tree; that migration is optional and belongs to
`docs-sync`.

Setup never stages, commits, pushes, opens a pull request, discards files, edits semantic
project concepts, compacts amendments, normalizes names, classifies artifacts, or invokes
`docs-sync`.

Completion reports two independent results:

- **tooling installed successfully**: managed conflicts are resolved, machinery tests
  pass, and setup introduced no validation error;
- **bundle validates cleanly**: current content has no validation error.

A fresh install requires validation exit `0`. Upgrade/repair requires validator tests
to pass and validation not to exit `2`; pre-existing content errors are reported for a
separate sync and do not misclassify tooling installation.

### `docs-add`

Direct invocation:

1. reads the target bundle's lifecycle policy;
2. accepts a type, destination, and either a prepared complete concept or content to
   scaffold from its self-relative template;
3. performs a 300-physical-line semantic review when the proposed concept reaches that
   size, recording keep/split reasoning in the approval plan rather than the bundle;
4. presents one complete plan: frontmatter, body, path, local-index entry, and nearest
   lifecycle entry;
5. writes only after explicit approval;
6. validates and reads back the result.

The 300-line threshold is not a size limit. Independently useful concepts split; an
atomic bounded report remains whole when separating evidence, assumptions, reasoning,
and conclusions would destroy context.

When a parent workflow has already presented and received approval for an equivalent
complete filing plan, that approval satisfies `docs-add`; the same plan is not gated
twice.

### `docs-validate`

The skill locates the repository's package manager, runs its no-flags `docs:validate`
script, distinguishes exits `0`, `1`, and `2`, explains errors before warnings, and
never edits concepts without separate authorization.

### `docs-sync`

`docs-sync` begins by asking for mode before writing.

#### Branch sync

- Ask for a target branch every run; assume no branch name.
- Compare the current branch from the target's common ancestor.
- Include committed, staged, unstaged, and relevant untracked state. Relevant untracked
  state is unignored content inside an affected source/docs area or explicitly linked
  by branch work; ignored material and user-designated temporary drafts are excluded.
- Inspect both source and docs changes; docs-only branches are valid.
- Reconcile all branch-affected concepts to current repository state.
- Report unrelated drift already present on the target separately and leave it
  unchanged.
- Recompute from the same boundary on every run so repeated syncs add no residue.

#### Bundle-wide reconciliation

- Audit the complete bundle against current code, tests, configuration, and still-valid
  explanatory truth.
- Repair stale explanations, missing concepts, omissions, and bookkeeping throughout.
- Use no unrelated-drift category.
- Preserve existing accepted history unless branch-local provenance is established;
  compaction never guesses across an unknown acceptance boundary.

#### Shared execution contract

- Dynamic fanout creates one domain worker per independent area.
- Domain workers own disjoint concept files.
- One reconciler is the sole writer of indexes, logs, and timestamps.
- A concept reaching 300 physical lines receives a semantic keep-or-split review in the
  conversational report; the threshold is not a validator rule or automatic split.
- A fresh verifier checks code, complete scope, ownership, lifecycle, and validation.
- Author/verifier correction repeats until clean or genuinely blocked.
- Contradictory executable sources are not guessed through; independent work finishes,
  then the exact conflict goes to the user.
- Invoking sync authorizes in-scope concept creation and non-destructive reconciliation;
  direct `docs-add` approval is not added. Moving or deleting imported source material
  follows the migration gate below.
- The command edits and verifies working-tree files only; it never stages, commits,
  pushes, or opens a pull request.
- Warnings are reported; hard errors and tool malfunction prevent success.

Content affected by source changes is updated in the same working step. Sync owns
timestamps, exact local-index registration, lifecycle entries, cross-area
reconciliation, and fold-back of durable outside-bundle knowledge produced by the work.
Temporary drafts remain user-owned and must be removed before invocation. Ambiguous
outside-bundle Markdown blocks automatic filing rather than being deleted.

#### Existing-source migration

When the user asks to convert existing ad-hoc documentation or a bundle-wide audit
finds durable outside-bundle candidates, sync adds a gated migration subflow:

1. Read-only workers classify each source as keep, normalize, split, move, remove, or
   ambiguous and return exact proposed concept paths, types, outlines, index entries,
   lifecycle entries, and source-path disposition.
2. The coordinator presents one complete proposal. No writer, move, or deletion starts
   before explicit approval; every ambiguous source is resolved first.
3. Approved writers own non-overlapping concepts. The reconciler alone updates shared
   indexes, logs, and timestamps.
4. A source outside the bundle keeps its existing pointer unless deletion was explicitly
   approved. After a split, the original path remains as a concise conformant overview
   only when it is still a stable useful entry point; otherwise its approved removal is
   recorded as part of the migration.
5. Verification checks the approved source dispositions as well as the resulting
   concepts.

This migration subflow belongs to `docs-sync`, not `docs-setup`. It is the only extra
approval inside sync because it authorizes destructive source-path changes rather than
ordinary semantic reconciliation.

Only drafting after the selected merge base is eligible for compaction. Target-side
dated amendments, historical rationale/value facts, and lifecycle entries are protected
history and remain intact, while canonical live sections may change for an ordinary
refinement.

Branch-local Decision/Convention drafting folds into one current canonical body and
intermediate branch-local amendment headings disappear. A dated branch-local value
change that is part of the accepted net decision survives as a dated historical fact in
the canonical Context or Consequences prose, without retaining its drafting heading.
Branch-local lifecycle entries for one concept collapse to one concise net semantic
entry:

- a created concept remains `Creation` after later branch edits;
- an existing changed concept becomes one `Update`;
- a retired concept becomes one `Deprecation`.

No `docs-sync ran` or `**Noted**` entry is written. Previously merged lifecycle history
is not rewritten. A change to a Decision's selected alternative, ownership boundary,
hard constraint, or material consequences is a reversal; if unclear, ask. A reversal
creates a replacement Decision and supersedes the old one. Ordinary refinements update
the accepted record in place.

### `docs-autoresearch`

`docs-autoresearch` is explicit-only. Generic research requests do not trigger it. Its
package is `SKILL.md` plus flat `RESEARCH-DEFAULTS.md`; it ships no scripts, commands,
hooks, templates, or agent definitions. `RESEARCH-DEFAULTS.md` is the single source of
shipped default values and default research policy; `SKILL.md` owns fixed mechanics,
orchestration, safety, failure behavior, and filing.

#### Topic and mode

Topic selection is one of:

- use an explicit topic verbatim;
- scan References' `## Open Questions` and unresolved questions/TODOs in
  Specifications, offer at most five deduplicated candidates with owners, then require
  selection; or
- ask the user.

The skill never chooses or improvises a topic.

The user selects one write contract:

1. **Reference enrichment** (default): create or update one curated multi-source
   `Reference`.
2. **Specification resolution** (explicit): require a target Specification and
   question; edit only when evidence resolves or materially narrows it. Create a
   Reference only when the evidence is independently reusable.
3. **Pre-work reconnaissance** (explicit): write only
   `research/YYYY-MM-DD-<topic-slug>.md`, with no OKF index/log ceremony. Later
   promotion requires explicit curation and evidence re-verification.

An existing concept with the same durable subject is enriched. A distinct subject
receives a distinct concept. An ambiguous or unrelated slug collision stops for
confirmation and never overwrites.

#### Fanout and budgets

The coordinator is the sole writer. Research agents are read-only and cannot delegate.
Each round is a barrier: allocate angles and quotas, dispatch the whole logical fanout,
wait for all evidence packets, deduplicate and synthesize, then decide whether to
continue.

- Round 1, breadth: 3–5 independent angles, one worker per angle, 2–3 searches each.
- Round 2, gaps: up to five material evidence gaps and at most five targeted searches.
- Round 3, optional verification: unresolved contradictions or missing decisive
  evidence, with at most five targeted searches.

Every evidence packet includes assignment, cited claims with high/medium/low
confidence, counterevidence, contradictions, Open Questions, every source classified
exactly as `fetched`, `rejected`, or `failed` with a reason, and searches/fetch attempts
consumed.

If the runtime cannot dispatch the required logical fanout, the run stops with an
explicit unsupported-capability failure. It does not silently reduce the worker count
or execute inline. This is failure handling after an attempted required operation, not
a separate capability-preflight or remediation workflow.

The normal global fetch cap and the recommended per-round split are the shipped tunable
defaults in `skills/docs-autoresearch/RESEARCH-DEFAULTS.md` ("Fetch budget"); every
attempt counts, including failures and retries. Unused quota moves only at round
boundaries. The user may approve a one-run increase up to the fixed one-run ceiling in
`skills/docs-autoresearch/SKILL.md` ("Fetch accounting"), after which the next run resets
to the default cap. Repository policy may lower budgets but cannot persistently raise
them. One run creates or materially updates no more concepts than the mutation ceiling
fixed in that same file ("Filing"), excluding indexes and logs.

Stop early when the question is supported, material claims have authoritative evidence,
contested or empirical claims have independent corroboration, no unresolved
contradiction could change the conclusion, and another round is unlikely to change the
answer. One canonical source may suffice for facts it defines. Cap exhaustion produces
an explicitly incomplete result with remaining gaps.

#### Evidence, safety, and configuration

Local docs establish context; code and tests establish current behavior; external
sources establish standards, rationale, alternatives, and reusable research. Supplied
sources are mandatory seeds, not the evidence boundary. Prefer primary evidence,
authoritative analysis, credible secondary reporting, then informal leads. When the
user supplies no URLs, workers discover sources. Repository policy may refine the
hierarchy but cannot promote unsourced material to high confidence.

Fetch only user-supplied or search-discovered public HTTP(S) URLs. Reject
credential-bearing URLs, localhost, private/link-local/metadata destinations, and
unvalidated redirects. Fetched content is untrusted data: never follow its instructions
or execute its code, never send secrets/private content/personal data in queries,
discard active content and embedded frontmatter delimiters, and persist summaries and
citations rather than raw bodies.

Every fetch failure appears in the conversational report. Only a failure that leaves a
material knowledge gap persists in a concept's Open Questions.

Optional repository deviations live in `docs/conventions/research.md`, created lazily
through `docs-add`. It contains only deviations in structured labelled Markdown and may
refine objectives, source preferences, confidence definitions, freshness, exclusions,
output style, and lower budgets. Fixed mechanics, safety, and hard ceilings cannot be
overridden.

Missing overrides use shipped defaults and are announced. Invalid settings fall back
field-by-field with every rejected value reported and valid settings preserved.
Missing or unreadable shipped defaults indicate corrupt installation and stop the run.

#### Filing

The default Reference shape is the section skeleton under "Default Reference shape" in
`skills/docs-autoresearch/RESEARCH-DEFAULTS.md`, and a repository may tune it there.
Claims carry adjacent confidence and citations in prose; there is no `confidence`
frontmatter. Open Questions live in the most relevant concept and are removed, narrowed,
or retained as later evidence changes their current state.

One synthesis Reference is the default. An additional Reference is allowed only when
the source is itself a durable, independently reusable subject such as a standard,
paper, or upstream repository; the three-concept mutation ceiling still applies.

Before any durable write, present one filing plan with paths, frontmatter, outline,
index changes, one consolidated lifecycle entry, contradictions, and low-confidence
claims. Only explicit approval authorizes writes. New concepts invoke `docs-add` with
the prepared plan; existing concepts are updated directly.

Write primary concepts, affected indexes, one consolidated lifecycle entry, then
validate and read back. Repair run-caused hard errors, triage warnings, and report
unrelated findings without expanding scope. A later write failure stops with an exact
partial-state report and no destructive rollback.

The conversational report includes mode/question, rounds, agents, searches/fetches,
source outcomes, files, validation, Open Questions, and partial failures. Durable modes
persist curated knowledge and concise bookkeeping only; reconnaissance persists only
its explicitly requested brief.

For behavioral testing, the report contains a machine-readable fenced `execution-trace`
block with round number, assignment id, worker id, assigned search/fetch quota, observed
search and fetch counts, source outcome totals, packet receipt, and coordinator write
phase. Harness adapters capture native dispatch/result events when available; the trace
is the cross-harness observable contract and is never filed into the bundle.

## Validator contract

`npm run docs:validate` is strict everywhere and has no flags or alternate strict
entrypoint:

- exit `0`: clean or warnings only;
- exit `1`: one or more hard bundle errors;
- exit `2`: validator malfunction.

Hard errors are exactly unparseable frontmatter and a missing, empty, or non-scalar
`type`. The frontmatter oracle is a YAML 1.2 mapping delimited by standalone `---` lines,
with the opening delimiter on the first line. Duplicate top-level keys, invalid YAML,
missing delimiters, a non-mapping document, or an unterminated block are unparseable. The
oracle is dependency-free and accepts only a documented YAML subset, so forms outside that
subset — anchors, aliases, tags, multi-line quoted scalars, multi-line flow collections —
are unparseable too; `type` itself must be a non-empty scalar string.
[/docs-setup/specs/validator.md](/docs-setup/specs/validator.md) is the authority for the
exact accepted subset. Reserved `index.md` and `log.md` files follow their separate soft
checks.

Warnings are:

- missing recommended `title`, `description`, or `timestamp`;
- malformed timestamp;
- `status: superseded` without `superseded_by`;
- broken internal links;
- a non-root `index.md` with frontmatter, a root index whose present frontmatter does
  not declare string `okf_version: "0.1"`, or a `log.md` level-two heading that is not
  exact `## YYYY-MM-DD`;
- missing local `index.md`;
- non-reserved concepts absent by exact bundle-relative path from the same directory's
  index, aggregated once per directory with the total count and first three omitted
  paths in lexicographic order; and
- a valid frontmatter timestamp older than the newest exact dated heading under
  `# Amendments`.

For the last warning, the amendments region begins at an exact level-one
`# Amendments` and ends at the next level-one heading or EOF. Recognized entries are
exact `## YYYY-MM-DD` or `## YYYY-MM-DD — <non-empty title>` headings. Compare the
timestamp's leading calendar date with the newest recognized amendment date; the same
date is not stale.

Warnings never block. There is no warning or suppression grammar for duplicate
basenames, blurb equality, missing logs, debt markers, amendment size, current config
values, generated duplicates, retention, or non-Markdown sidecars.

The documented portable hook is `pre-push` running plain `npm run docs:validate`, with
husky v4 and v8/v9 recipes. Setup never installs husky or adds its dependencies/scripts.
An optional minimal GitHub Actions asset runs the same command on pull requests.

A repository-only Node test reached by `npm test` compares these pairs as raw buffers:

- `skills/docs-setup/assets/scripts/validate-docs.mjs` ↔
  `scripts/validate-docs.mjs`;
- `skills/docs-setup/assets/scripts/validate-docs.test.mjs` ↔
  `scripts/validate-docs.test.mjs`.

It fails on missing files and any byte difference, identifies the authoritative asset,
and never repairs. The fresh-install behavior test asserts every post-split machinery
destination, raw equality for verbatim outputs, and substitution-aware expected
content for every transformed output; it never recursively compares living project
concepts with seed assets.

## Acceptance contract

### Structure and migration

- All five canonical suite skills are discoverable as top-level library skills.
- No live surface — skill directories, skill names, dependency declarations, test-case
  directories, fixtures, manifests, README inventory, installed links, invocations — uses
  the old setup identity; historical and explanatory references to it (prior Decisions,
  the bundle log, dated `research/` briefs and handoffs, test comments) remain.
- `docs-setup` declares its two dependencies and installs no helper-skill copies.
- Fresh setup uses `docs/` and `specs/`, creates no universal artifact zone, and
  contains no tool-named exclusion.
- A current-v2 rerun produces a no-change plan.
- Fresh, upgrade, and partial-repair states are proposed before mutation.
- Differing managed files and ambiguous memory content block until approved.
- Exact marked wiring replaces in place while unrelated guidance remains unchanged.
- Dirty upgrades require explicit approval.
- Existing `specifications/` content remains untouched for later optional sync.
- Setup changes no Git index, commit, remote, or pull-request state.

### Parity and distribution

- Static fixtures reject skill names outside the 1–64-character pattern, directory/name
  mismatches, missing or over-1,024-character descriptions, absolute cross-skill support
  paths, and an `AGENTS.md` instruction chain over 32 KiB.
- Project/global checkout planning resolves the exact placement table above. OpenCode
  adds no redundant placement and discovers each identity once when Claude and Codex
  placements coexist.
- The same scenario on Claude Code, Codex, and OpenCode yields equivalent files,
  structure, lifecycle entries, preserved unrelated content, validation state, and
  refusal/failure behavior.
- Tests compare observable repository outcomes, not prose.
- Removing optional Claude rules changes no required result.
- Codex succeeds without project `.codex` configuration.
- OpenCode succeeds without Claude compatibility settings or plugins.
- Every supported distribution cell verifies complete canonical packaging, dependency
  availability, exactly-once discovery, correct paths, provenance, idempotence,
  deduplication, and safe reconciliation.
- Portable+checkout and native+checkout pre-existing fixtures cause refusal before
  mutation and identify the conflicting path/channel. Static guidance tests require the
  portable/native incompatibility warning beside both managed install paths.
- Native fixtures assert the four exact manifest/catalog paths and the documented
  Claude/Codex install and update operations.
- OpenCode native plugin installation is neither advertised nor accepted.
- A failing cell is not advertised until both deterministic and live tests pass.

### `docs-sync`

- No write occurs before mode selection; branch mode asks for a target every run.
- Branch fixtures include committed, staged, unstaged, and relevant untracked state.
- Docs-only branches reconcile successfully.
- Branch-unrelated drift is reported and byte-preserved; bundle-wide mode repairs it.
- Two identical syncs produce identical docs after the first.
- Only domain owners write concepts; only the reconciler writes shared files.
- Contradictory authoritative sources create a precise blocker, not a guessed claim.
- Warning-only validation permits success; exit `1` or `2` prevents success.
- Creation plus branch-local updates produces one final `Creation` entry.
- No operational sync/debt entry appears.
- Target-side dated amendments, rationale/value facts, and lifecycle entries remain
  unchanged; ordinary refinement may update canonical live sections; material reversal
  creates linked supersession.
- A branch-local dated value-change fixture loses its intermediate amendment heading
  while retaining the date and old/new value fact in canonical Context or Consequences.
- Existing-source migration performs no writes during classification, blocks before
  approval, and matches every approved keep/normalize/split/move/remove disposition.
- An imported source retains its pointer unless deletion is approved. A split source
  remains as an overview only when approved as a stable entry point; approved removal
  records the migration.
- Sync leaves staging, commits, remotes, and pull-request state unchanged.

### Knowledge boundary

- A multi-topic document with independent lifecycles is proposed for splitting; an
  atomic bounded report stays whole.
- A 300-line candidate triggers a recorded review in the direct-creation approval plan
  or sync report, and no validator warning.
- Malformed Markdown under any `docs/` subtree is validated uniformly.
- Non-Markdown sidecars are ignored by the Markdown validator.
- Live copied current values are replaced by symbol-name citations; dated accepted
  historical values remain.
- No constant checker or tool-specific exclusion is introduced.

### Validator and enforcement

- Clean and warnings-only fixtures exit `0`.
- Missing/empty/non-scalar `type`, missing/unterminated delimiters, invalid YAML,
  duplicate keys, and non-mapping frontmatter fixtures exit `1`.
- Missing/unreadable docs roots exit `2` without an uncaught rejection.
- Mixed errors and warnings exit `1`.
- Cross-directory same-basename links do not satisfy local-index coverage.
- Directory omissions produce one warning with the total and first three
  lexicographically sorted exact paths.
- Timestamp/amendment warnings use the exact region/heading grammar above, compare
  calendar dates, and ignore lookalike headings outside the region.
- Negative fixtures cover every explicitly rejected warning class.
- Raw-byte mirror tests fail on missing files and newline-only differences.
- Fresh-install tests assert every machinery destination, raw equality for verbatim
  outputs, and substitution-aware equality for transformed outputs.
- The optional workflow runs on pull requests and exit `1` fails the job.
- Setup adds no husky dependency or `prepare` script and documents both recipe families.

### `docs-autoresearch`

- Generic research does not invoke or write; explicit invocation does.
- Frontier discovery offers at most five owned candidates and writes nothing before
  selection and filing approval.
- Default mode produces one conformant curated Reference with no raw-source files.
- Specification mode leaves the target unchanged without resolving evidence.
- Recon mode touches only the dated research brief.
- Evidence shows read-only workers, coordinator-only writes, round barriers, and no
  nested delegation through the required `execution-trace` fields.
- Round 2 and Round 3 fixtures reject more than five targeted searches; every source
  outcome is `fetched`, `rejected`, or `failed` with a reason.
- Fetch accounting includes failures/retries, stops at 20 by default, accepts only one
  run up to 45, and resets next run.
- One run mutates no more than three concepts.
- Missing override, partially invalid override, and corrupt defaults exercise distinct
  announce/fallback/stop paths.
- Unsafe URLs and fetched instructions are rejected or treated as data; sensitive
  material and raw bodies do not persist.
- No-seed runs discover sources; repository overrides cannot assign high confidence to
  unsourced claims; every failed fetch is conversationally reported and only material
  remaining gaps persist.
- Additional References appear only for independently reusable source subjects.
- Collision, denied approval, cap exhaustion, fetch failure, and mid-write failure each
  follow the specified stop/report contract.
- Insufficient fanout capacity produces the explicit unsupported-capability failure
  without inline or reduced-fanout execution.

## Implementation sequence

The SDD plan should preserve these seams. All seven landed through the #47–#63 slices;
the list stands as the plan of record.

1. Add target contract tests and v2 fixtures without weakening current v1 coverage.
2. Extract `docs-add` and `docs-validate`, add `docs-sync` and `docs-autoresearch`, then
   perform the complete `docs-setup` identity migration.
3. Implement strict validator exits, exact local-index coverage, amendment timestamp
   warning, and raw-byte mirror enforcement in both copies together.
4. Rebuild setup around read-only audit, one approved deterministic writer, and fresh
   verification; add router/shim migration.
5. Implement sync and autoresearch at their explicit authorization/fanout seams.
6. Reconcile distribution registry, checkout ownership, plugin catalogs, provenance,
   documentation, and the full channel/harness matrix.
7. Update current-behavior Decisions, conventions, subsystem paths, lifecycle docs,
   README, tests, reports, and optional CI assets in the same slices that make them true.

No implementation slice may claim support for a matrix cell or workflow until its
acceptance evidence passes.

## Implementation deltas (closed)

These were the v1→v2 gaps this specification was written to close. Every one was closed by
the #47–#63 slices and none of them describes current behavior; the list is retained as
the historical gap record:

- current setup name, subsystem paths, README entries, tests, and plugin invocation use
  the old identity;
- helper skills are nested and setup still performs semantic conversion;
- setup and policy prose name Superpowers and exclude `docs/superpowers/**`;
- current wiring contains the `specifications/` drift;
- current project guidance defers docs changes unless explicitly requested;
- current docs-maintenance prose incorrectly makes docs authoritative for current
  behavior;
- current distribution prose says contributor-only development links and the registry
  lacks first-class OpenCode, correct Codex project discovery, plan deduplication,
  provenance, and stale-link ownership;
- the Codex marketplace catalog and full native update guidance are incomplete;
- current invocation/dependency prose treats slash syntax as portable semantics;
- validator copies always exit `0`, do not classify malfunction, use basename index
  coverage, and lack the new timestamp warning;
- advisory-validator claims exist across policy, skill, CI, and subsystem docs;
- no focused raw-byte mirror test is reached by `npm test`;
- `docs-add` lacks the prepared-concept interface and semantic size review;
- `docs-sync` and `docs-autoresearch` do not exist.

## Out of scope

- Harnesses beyond Claude Code, Codex, and OpenCode.
- Obsidian compatibility.
- A docs visualizer or human-facing reading interface.
- Tool-specific SDD integration.
- Automatic husky installation or Bitbucket administration.
- A universal operational-artifact storage convention.
- Implementing v2 inside this Wayfinder session.

## Governing resolutions

- [Standalone skills: split docs-add/docs-validate out of okf-docs-setup](https://github.com/artemVeduta/skills/issues/29)
- [Bundle naming: docs/ vs wiki/, specs/ vs specifications/](https://github.com/artemVeduta/skills/issues/30)
- [Docs-maintenance flow: keeping the bundle current in SDD and quick-fix flows](https://github.com/artemVeduta/skills/issues/31)
- [Config-value authority: code as source of truth, drift control](https://github.com/artemVeduta/skills/issues/32)
- [PR-time validation: portable enforcement on GitHub and Atlassian+husky](https://github.com/artemVeduta/skills/issues/33)
- [Harness parity research: verified portability contract](https://github.com/artemVeduta/skills/issues/34)
- [Autoresearch pattern research: extract claude-obsidian's design](https://github.com/artemVeduta/skills/issues/35)
- [Generated-artifacts zone: what belongs in the bundle](https://github.com/artemVeduta/skills/issues/36)
- [Decision and log compaction: one record at PR time](https://github.com/artemVeduta/skills/issues/37)
- [Harness parity architecture: one pack, same behavior everywhere](https://github.com/artemVeduta/skills/issues/38)
- [Autoresearch skill design for OKF bundles](https://github.com/artemVeduta/skills/issues/39)
- [Migration path for existing v1 bundles](https://github.com/artemVeduta/skills/issues/40)
- [Install and distribution: any user, any harness, same result](https://github.com/artemVeduta/skills/issues/41)
- [Byte-exact enforcement: mechanize the validator dual-copy check](https://github.com/artemVeduta/skills/issues/43)
- [Empirical harness checks: symlinked skill dirs and unknown frontmatter tolerance](https://github.com/artemVeduta/skills/issues/44)
- [Validator v2 warnings: choose the advisory checks](https://github.com/artemVeduta/skills/issues/45)

[Docs-view visualizer: include or defer from v2](https://github.com/artemVeduta/skills/issues/46)
records the visualizer as out of scope rather than as a governing implementation
decision.
