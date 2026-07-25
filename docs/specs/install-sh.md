---
type: Specification
title: install.sh — development-links install wizard
description: Contract for the shipped checkout installer — the registry-driven wizard that validates the skill dependency graph and symlinks the whole library into selected harness profiles.
timestamp: 2026-07-25
---

# install.sh — development-links install wizard

This is the contract for the shipped checkout installer, specified as the rebuild of
`scripts/install.sh` under
[issue #16](https://github.com/artemVeduta/skills/issues/16) and delivered by the
three-harness checkout installer (issue #61). It is governed by
[Use three skill distribution channels](/decisions/skill-distribution-channels.md)
(as amended 2026-07-10: whole-library development installs) and
[Declare skill dependencies in SKILL.md](/decisions/skill-dependencies.md), and
implements the "Distribution and installation" section of the
[locked platform specification](/specs/skills-platform.md). Vocabulary:
[skill](/glossary/skill.md), [harness](/glossary/harness.md) (including *harness
profile*), [skill dependency](/glossary/skill-dependency.md).

> **Status note (2026-07-24).** This PRD predates the
> [OKF docs skill-suite v2 spec](/specs/okf-docs-skill-suite-v2.md), the governing
> authority for the three-harness (Claude Code, Codex, OpenCode) checkout installer
> (issue #61). Where this document leaves a choice implementer-owned or describes older
> intent — notably the blanket `~/.agents/skills` channel-mixing warning and
> `CODEX_HOME`-based Codex resolution — the v2 spec supersedes it: channel mixing is a
> precise managed-shape **refusal** (not a warning), and Codex resolves to a fixed
> `~/.agents/skills` (its `configRoot.env` is `null`, so no `CODEX_HOME` lookup).

## Problem Statement

A library developer authors [skills](/glossary/skill.md) in a local checkout and wants
every edit — and every `git pull` — to reach all the [harnesses](/glossary/harness.md)
they use, immediately and without reinstalling. The installer this one replaced got in
the way:

- It forces **per-skill selection**, so a partial install can silently omit a
  [skill dependency](/glossary/skill-dependency.md) and break a dependent skill at
  runtime; it performs **no dependency-graph validation** at all.
- Its target menu is a **hard-coded list of three directories** that predates the
  harness-profile model — a developer with a work Claude Code profile, an isolated
  `CODEX_HOME`, or any harness outside the list must type raw paths with no validation.
- Supporting a **new harness means editing wizard code**, and the hand-written README
  install section drifts from whatever the script actually does.
- It changes the filesystem **without a plan preview or confirmation**, including
  silently deleting non-symlink entries that collide with a skill name.
- Its skill discovery is a depth-limited filesystem scan that predates the flat
  `skills/<name>/` layout locked by the platform spec.

## Solution

`scripts/install.sh` is the **interactive wizard** of the checkout channel. The developer
runs it from the checkout and it proceeds in a fixed order: discover the library's
skills, report the checkout's Git provenance, **validate the skill dependency graph** — a
missing canonical dependency or a cycle rejects the whole run before any prompt or plan
exists — select harnesses (and, by flag, profiles and scope), reduce the selection to
distinct write placements, refuse a self-referential or managed-shape target, render an
explicit installation preview, confirm, and only then **symlink every library skill**
into each selected profile's skill directory. There is no per-skill selection: because
the whole canonical tree is linked, every dependency is present by construction and no
closure computation is needed.

All harness knowledge lives in a **declarative harness registry** — the single source
of truth shared by the wizard and the README install guidance. Adding an ordinary
pure-skill harness is a registry-entry-plus-contract-tests change, never a new wizard
branch. Update semantics stay trivial: edits to the working copy reach every linked
profile live, and `git pull` is the only update command.

## User Stories

1. As a library developer, I want to run one installer command from my checkout, so
   that the whole skill library becomes available in my harnesses without copying
   anything.
2. As a library developer, I want the installer to link **every** library skill rather
   than a hand-picked subset, so that every declared skill dependency is guaranteed
   present when a dependent skill runs.
3. As a library developer, I want the dependency graph validated before any filesystem
   change, so that a missing dependency or a cycle rejects the install instead of
   producing a broken profile.
4. As a library developer, I want a rejection message that names the offending skill
   and the missing node or cycle, so that I can fix the `## Required skills`
   declaration immediately.
5. As a library developer, I want to choose harness types in a step-by-step flow, so
   that I only answer questions relevant to the harnesses I actually use.
6. As a library developer, I want to select multiple profiles of the same harness in
   one run — personal `~/.claude` and work `~/.claude-work` — so that all my
   independently configured instances stay in sync from one command.
7. As a library developer with an isolated `CODEX_HOME`, I want profile paths resolved
   through the harness's configuration-root environment variable or discovery rules, so
   that the links land where that profile actually looks.
8. As a library developer using a harness the registry does not know, I want a custom
   configuration-directory option with validation, so that unknown profiles remain
   reachable without waiting for a registry entry.
9. As a library developer, I want an explicit installation preview — which profiles,
   which skill directories, and what will be created or replaced — so that I can catch
   a wrong plan before it executes.
10. As a library developer, I want confirmation required before any change to my
    profiles, so that nothing destructive ever happens by surprise.
11. As a library developer, I want the preview to disclose when a real (non-symlink)
    file or directory at a skill's link location would be replaced, so that I never
    lose data I did not knowingly agree to lose.
12. As a library developer, I want an edit in my working copy to reach every linked
    profile instantly, so that I can iterate on a skill and test it live in the
    harness.
13. As a library developer, I want `git pull` to update every linked profile with no
    separate reinstall step, so that development-channel updates are just repository
    pulls.
14. As a library developer, I want re-running the wizard with the same selections to be
    idempotent, so that repeated runs converge on the same link state with no errors.
15. As a library developer who just added a new skill to the library, I want a re-run
    to pick it up and link it into every selected profile, so that profiles never
    lag the checkout's skill set.
16. As a library developer, I want the installer to refuse a target directory that is
    itself a symlink resolving into the repository, so that per-skill links are never
    written back into my working copy.
17. As a library developer, I want the installer to call out (or refuse) linking into
    `~/.agents/skills`, which is also the portable CLI's own storage, so that I never
    mix the development and portable channels in one directory.
18. As a library developer, I want to be steered away from installing development links
    into a profile that already consumes the library through another channel, so that a
    harness never exposes the same capability twice.
19. As a library developer, I want a scriptable non-interactive invocation of the
    installer, so that automation and tests can drive it without a TTY.
20. As a library developer, I want an inspection mode that shows the discovered skills
    and known harness registry entries without installing, so that I can audit what a
    run would offer.
21. As a library developer, I want distinct nonzero exit statuses for usage errors,
    nothing-to-do outcomes, and dependency-graph rejection, so that scripts wrapping
    the installer can react appropriately.
22. As a contributor adding support for a new pure-skill harness, I want to add a
    single registry entry plus contract tests — with no wizard code change — so that
    harness support scales as data, not control flow.
23. As a contributor, I want each registry entry covered by contract tests over its
    paths and selection behavior, so that a wrong skill-directory template or discovery
    rule fails tests instead of misplacing links on a user's machine.
24. As a contributor, I want behavioral harness adapters permitted only where native
    plugin operations need more than path metadata, so that the wizard core stays a
    pure function of the registry.
25. As a README reader, I want the install guidance derived from the same registry the
    wizard uses, so that documentation and installer behavior cannot drift apart.
26. As a skill author, I want any skill I invoke by canonical `/skill-name` guaranteed
    resolvable in every linked profile, so that I never need (and am never tempted to
    use) cross-skill filesystem paths.
27. As a skill author, I want skill discovery defined as exactly the flat
    `skills/<name>/` directories with a root `SKILL.md`, so that where I put a skill is
    never ambiguous and nested `SKILL.md` files inside a skill are never installed
    standalone.
28. As a maintainer, I want the terminal presentation replaceable without touching
    selection or path-resolution logic, so that improving the UI never risks the
    install contract.
29. As a maintainer, I want the installer to remain a repository-operator entry point
    under `scripts/`, so that the `scripts/` vs `tools/` boundary from the platform
    spec stays intact.

## Implementation Decisions

- **Module.** The operator entry point stays `./scripts/install.sh` — a launcher that
  locates and hands off to the implementation, which is Node: `scripts/install.mjs` →
  `main()` orchestrating single-purpose modules under `scripts/install/`
  (`discovery.mjs`, `graph.mjs`, `profiles.mjs`, `planner.mjs`, `preview.mjs`,
  `linker.mjs`, `provenance.mjs`, `readme.mjs`, `registry.mjs`). It remains a
  repository-operator entry point in `scripts/` per the
  [library-structure Decision](/decisions/skill-library-structure.md). It *installs*
  only the checkout channel, but the same CLI is also the generator and validator of the
  README install guidance for all three channels (`--check-readme` / `--write-readme`,
  wired as the `readme:check` package script) — which is why the registry carries
  managed-channel metadata alongside checkout paths.
- **Skill discovery.** A skill is exactly a directory `skills/<name>/` with a root
  `SKILL.md`, per the flat-layout rule of the
  [platform spec](/specs/skills-platform.md), implemented in
  `scripts/install/discovery.mjs` → `discoverSkills()`. This replaced the pre-rebuild
  depth-limited filesystem scan. Nested `SKILL.md` files are children of their parent
  skill and are never installed standalone. Discovering zero skills is a hard failure.
- **Declarative harness registry.** One registry is the single source of truth for the
  wizard and the README install guidance; its definition is `scripts/install/registry.mjs`
  → `REGISTRY`. Each entry owns installation metadata only, along these axes: a stable
  harness id and a display name; the skill directories the harness supports per scope; a
  configuration root (an optional environment variable plus the named default profiles);
  the supported scopes and channels; the validation rule for a user-supplied profile
  directory; an optional native adapter; and an optional shared-read list. The wizard must
  not accumulate per-harness branches for anything expressible in the registry.

  Native adapter metadata lives in the registry — not in the native channel's own
  material — because the README native guidance and the manifest tests must read one
  definition: `registry.mjs` → `nativeCommands()` derives each harness's exact
  marketplace/install/update operations, `install/readme.mjs` → `renderNativeSection()`
  renders them, and `scripts/manifests.test.mjs` verifies them against the real committed
  manifests. This installer performs no native operation, but it owns the registry that
  defines them. The shared-read list is what lets an OpenCode selection contribute no
  placement a selected Claude or Codex target already exposes
  (`install/profiles.mjs` → `resolveReadDirs()` / `reduceSelections()`).

  The registry is also the *advertised* surface that CI gates as advertised == proven —
  every (channel × harness) cell it offers must carry recorded evidence; see the
  [testing-architecture Decision](/decisions/skill-testing-architecture.md) and
  `tools/acceptance/matrix.test.mjs`.
- **Wizard flow (interaction contract).** The shipped order is: discover skills → report
  checkout provenance → validate the dependency graph (a defect rejects the run *before*
  any prompt or plan) → select harnesses, and by flag also profiles and scope → reduce the
  selections to distinct placements → refuse on a self-symlink or managed-shape conflict →
  render the preview → confirm → link and prune. The interactive step selects **harnesses
  only** (`promptSelections()`: comma-separated ids, blank meaning all); profiles come from
  the entry's named defaults (`resolveSelections()`), and a custom configuration root is
  reachable only through `--profile <id>:<path>` (`install/profiles.mjs` →
  `resolveProfile()`). Multiple profiles, named profiles, custom roots, and scope are
  therefore flag-driven — user stories 6–8 are satisfied non-interactively today.
  Presentation is replaceable; selection and path resolution are independent of the
  terminal UI and depend only on the registry.
- **Dependency-graph validation.** Before any filesystem change, the wizard validates
  the library's dependency graph by reusing the shared graph module (issue #15): parse
  each skill's `## Required skills` section (the only machine input), enforce canonical
  names, and detect missing nodes and cycles. Any defect rejects the entire install
  with a message naming the defect. Because the whole library is linked, no per-skill
  closure expansion is needed — validation is of the graph itself.
- **Linking mechanics (carried forward from the pre-rebuild script).** Each skill is
  installed as one symlink `<profile skill dir>/<name>` → `<checkout>/skills/<name>`
  with `ln -sfn` semantics (force, no-dereference), implemented in
  `scripts/install/linker.mjs` → `linkSkill()`; target directories are created if
  missing; re-runs are idempotent because an existing link is replaced in place. A
  non-symlink entry colliding with a skill
  name is replaced — but only after the preview disclosed it and the user confirmed.
  The **self-symlink guard** is kept: a target directory that is itself a symlink
  resolving into this repository is refused with remediation guidance.
- **Channel-mixing guard.** A single harness profile must not consume the library
  through more than one channel (per the distribution-channels Decision). The
  [v2 skill-suite spec](/specs/okf-docs-skill-suite-v2.md) settled the previously
  implementer-owned warn-vs-refuse choice: before any mutation the installer detects an
  already-present **managed** portable or native shape — an `.okf-managed.json` marker at
  the skill directory (portable) or at its parent config root (native plugin) — and
  refuses the checkout overlay with the exact conflicting path and channel. A plain
  `~/.agents/skills` directory with no managed marker is Codex/OpenCode's own canonical
  location and is linked normally; the older blanket `~/.agents/skills` warning is gone.
- **Non-interactive surface.** A flag-driven, TTY-free invocation drives automation and
  tests; the flag surface and the exit-code split are now fixed in `scripts/install.mjs`
  (`usage()`, `EXIT`). Four distinct nonzero classes are contract: a usage error, a hard
  refusal (a guard tripped, or nothing discovered), a nothing-to-do outcome, and a
  dependency-graph rejection — the class boundaries are the contract, the numeric values
  are read from `EXIT`.
- **Scope.** `--scope global|project` selects the placement: global resolves the harness's
  global skill directory under the profile's configuration root, project resolves it
  relative to the working directory (`install/profiles.mjs` → `resolveSkillDir()`). The
  per-harness paths are fixed by the placement table of the
  [v2 skill-suite spec](/specs/okf-docs-skill-suite-v2.md), which this installer resolves
  rather than restates.
- **Checkout provenance.** Both `--inspect` and the plan preview print the checkout's
  commit, symbolic ref, and dirty flag, so a preview is attributable to a working-copy
  state (`scripts/install/provenance.mjs` → `checkoutProvenance()` / `formatProvenance()`).
  Provenance is best-effort: a non-Git checkout is reported as such and still installs.
- **Reconciliation on rerun.** A rerun creates missing links, and removes a stale link
  only when its literal target proves this checkout owns it — links belonging to another
  checkout and real (non-symlink) entries are never removed
  (`install/planner.mjs` → `planPrunes()` / `ownedByCheckout()`). Prunes are disclosed in
  the preview and gated by the same confirmation as links. Selections that resolve to the
  same directory collapse to one placement (`install/profiles.mjs` → `reduceSelections()`),
  so a profile never receives the same link twice in one run.
- **Update semantics.** None beyond git: edits and `git pull` reach every linked
  profile live. The installer has no update, sync, or uninstall subcommand mandate;
  a rerun is what reconciles pack membership, per the reconciliation bullet above.
- **README install guidance** is derived from the same registry (regenerated or
  validated against it), replacing the hand-written section; the generation mechanism
  is implementer-owned.

## Testing Decisions

- **Exactly one seam: the CLI invocation surface.** Tests execute the installer script
  as a subprocess — with flags or simulated interactive input — inside a disposable
  fixture (temporary HOME / configuration roots / target directories). Internal shell
  functions are never unit-tested.
- **Assert external behavior only:** exit codes, the stdout plan preview, and the
  resulting symlink state on disk (which links exist, what they resolve to, and that a
  re-run converges on the same state). This follows the deterministic-oracle principle
  of the [skill-testing-architecture Decision](/decisions/skill-testing-architecture.md):
  pass/fail derives from deterministic state assertions, no inference involved.
- **What a good test covers** (mirroring the acceptance criteria of issue #16): the
  preview appears and no filesystem change happens before confirmation; a confirmed run
  links every library skill into each selected profile; a second run is idempotent; an
  injected cycle or missing canonical dependency rejects the install with a clear
  message and leaves the profile untouched; the self-symlink guard refuses a target
  linking into the repo; a plain `~/.agents/skills` (no managed marker) links normally
  while a portable managed marker at the skill directory and a native marker at its
  parent configuration root each refuse before any mutation, naming the exact path and
  channel; stale-link pruning is disclosed in the preview and gated by confirmation; a
  non-symlink collision is disclosed and only replaced after confirmation. The seams are
  `scripts/install.test.mjs` (installer behaviour) and `scripts/managed-channels.test.mjs`
  (the generated guidance side).
- **Registry contract tests:** each registry entry's path resolution and selection
  behavior is exercised through the same CLI seam against fixture configuration roots;
  adding a toy harness entry must pass its contract tests with zero wizard code
  changes.
- **Prior art:** `scripts/validate-docs.test.mjs` — `node --test`-based testing of a
  `scripts/` entry point in this repo — establishes the test-runner convention; the
  installer's tests differ from it in staying strictly at the subprocess/CLI boundary
  rather than importing internals.

## Out of Scope

- **Portable pure-skill installs** (`npx skills add …`) — owned by the upstream CLI;
  contract in the [platform spec](/specs/skills-platform.md) and the
  [skill-dependencies Decision](/decisions/skill-dependencies.md).
- **Native aggregate plugins** (Codex / Claude Code manifests, marketplaces, adapters'
  plugin operations) — platform-spec territory.
- **Per-skill selective installation** — removed from the development channel by the
  2026-07-10 amendment to the
  [distribution-channels Decision](/decisions/skill-distribution-channels.md);
  selective installs live in the portable channel.
- **The dependency-graph module's internals** — built and specified under issue #15;
  this installer is a consumer.
- **Per-skill closure expansion** — unnecessary here (whole-library linking) and a
  portable-channel concern elsewhere.
- **The skill linter, test/benchmark harness, release script, and CI wiring** — own
  sections of the platform spec.
- **The README install-guidance generator's mechanics** — only the registry contract it
  consumes is specified here.

## Further Notes

- **Prior art / baseline.** The pre-rebuild `scripts/install.sh` and this concept's
  previous revision (in git history) document the pre-rebuild contract: `find`-based
  discovery, per-skill and per-target menus over a hard-coded `DEFAULT_TARGETS` list,
  `--list` / `--all` / `--target` flags, `ln -sfn` linking, unconditional replacement
  of non-symlink collisions, the self-symlink guard, and the exit-code split (2 usage,
  1 nothing-to-do). The rebuild carries forward the linking mechanics, idempotence, and
  self-symlink guard; it replaces per-skill selection, the hard-coded target list, and
  undisclosed destructive replacement.
- **Precedence.** The platform spec's precedence note said the old revision of this
  concept described the *current* script and would be revised when the new installer
  lands; this revision is that rewrite, done ahead of implementation as the PRD issue
  #16 builds against. The rebuild has since shipped (issue #61), so the pre-rebuild
  `find`/`DEFAULT_TARGETS`/`--list`/`--all`/`--target` contract in the "Prior art /
  baseline" bullet is retained as history only.
- **Gaps left implementer-owned, and how they were settled** (none reopened a Decision):
  the registry's file format and location, the exact flag names and exit-code
  assignments, and the README guidance generation mechanism were all fixed by the
  shipped installer, cited in the Implementation Decisions above. The
  warn-vs-refuse choice for a colliding managed shape and stale-link pruning on re-run
  were later settled by the [v2 skill-suite spec](/specs/okf-docs-skill-suite-v2.md): a
  precise managed-shape refusal, and pruning of a stale link only when ownership proves
  it points into the same checkout.
- **Related but different:** the
  [docs-setup install contract](/docs-setup/specs/install-contract.md)
  describes what that *skill* installs into target repositories when it runs — not how
  this library's skills reach harnesses.
