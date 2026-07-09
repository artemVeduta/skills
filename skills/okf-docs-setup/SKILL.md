---
name: okf-docs-setup
description: Use when setting up, bootstrapping, porting, or standardizing a repository's documentation into the OKF (Open Knowledge Format) v0.1 bundle — the same docs/ setup as liveteach (validator, docs-add/docs-validate skills, .claude rules, frontmatter taxonomy) — in a new or existing project, including converting existing ad-hoc docs (READMEs, ADRs, wikis) into OKF concepts.
---

# okf-docs-setup

## Overview

Stands up a complete OKF v0.1 documentation bundle in a target repository, identical in
structure and tooling to the liveteach `docs/` setup. The canonical machinery (validator,
helper skills, rules, policy, OKF spec) is **bundled inside this skill's `assets/`
directory** — you copy it verbatim, you never regenerate it from memory.

**Core principle:** _Copy the contract, generate only the content._ The validator, the
policy, the OKF reference, the helper skills and their templates are fixed artifacts —
copy them byte-for-byte. Only the project-specific content (subsystem index nodes,
converted concepts) is authored, and only that authoring is fanned out to parallel agents.

**REQUIRED SUB-SKILL:** Use superpowers:dispatching-parallel-agents for the fan-out in
Phase 2.

## When to use

- "Set up OKF docs in this project", "bootstrap the docs bundle", "port the liveteach
  docs setup here", "standardize our docs into OKF format".
- Migrating scattered READMEs / ADRs / wiki pages into a single validated knowledge bundle.
- NOT for adding one concept to an existing bundle — that is the `docs-add` skill this
  installs.

## What this installs (the complete manifest — install ALL of it)

Source is this skill's `assets/` dir. Destinations are relative to the target repo root.
Mind the **`assets/claude/` → target `.claude/`** rename (leading dot) on the bottom rows.

| From `assets/`                                    | To (target repo)                        | How                  |
| ------------------------------------------------- | --------------------------------------- | -------------------- |
| `scripts/validate-docs.mjs`                       | `scripts/validate-docs.mjs`             | verbatim             |
| `scripts/validate-docs.test.mjs`                  | `scripts/validate-docs.test.mjs`        | verbatim             |
| `docs/references/okf.md`                          | `docs/references/okf.md`                | verbatim + date + pm |
| `docs/conventions/documentation.md`               | `docs/conventions/documentation.md`     | verbatim + date + pm |
| `docs/index.md`                                   | `docs/index.md`                         | fill `<PROJECT>`     |
| `docs/log.md`                                     | `docs/log.md`                           | fill date            |
| `docs/{conventions,glossary,references}/index.md` | same paths                              | verbatim             |
| `claude/rules/docs-authoring.md`                  | `.claude/rules/docs-authoring.md`       | verbatim             |
| `claude/rules/docs-maintenance.md`                | `.claude/rules/docs-maintenance.md`     | verbatim + set paths |
| `claude/skills/docs-add/**`                       | `.claude/skills/docs-add/**`            | verbatim + pm        |
| `claude/skills/docs-validate/SKILL.md`            | `.claude/skills/docs-validate/SKILL.md` | verbatim + pm        |

**How legend** — _verbatim_: copy bytes unchanged; _date_: replace `<YYYY-MM-DD>` with
today's date; _pm_: rewrite the literal `pnpm docs:validate` to the target's invocation
(Phase 1); _set paths_: replace the `<source-edit-path-glob>` placeholder in the frontmatter `paths:`
with explicit source-edit path glob(s) gathered for the target repo. There is no default
path because each project has different source roots. The two `scripts/` files are pure
verbatim — never summarize, paraphrase, or route them through a subagent; that is where
drift enters.

Plus: add `"docs:validate": "node scripts/validate-docs.mjs"` and
`"docs:validate:test": "node --test scripts/*.test.mjs"` to the target's `package.json`.

## Procedure

### Phase 0 — Gather inputs (ASK the user, then STOP for approval)

Ask in one message and wait for answers:

1. **Target repo root** (where `docs/` and `scripts/` should live).
2. **Project name** (fills `<PROJECT>` in the root `index.md` title).
3. **Package manager** — pnpm / npm / yarn — so the human-facing `pnpm docs:validate`
   invocation in the copied files is rewritten to match (`npm run docs:validate`, etc.).
4. **Source edit paths** — the path glob(s) for `.claude/rules/docs-maintenance.md`
   frontmatter, e.g. `scripts/**/*.{py,md}` or `{packages/app,packages/lib}/src/**/*.{ts,tsx}`.
   These are required; there is no default path.
5. **Subsystems** — the top-level code areas to seed as subsystem index nodes (name +
   one-line description each), or "none yet".
6. **Where existing docs live** — point me at any current docs to convert (folders, ADR
   dirs, README files, wiki exports), or "none". _(This drives Phase 2 conversion.)_

Then present the plan — the manifest, the source edit paths, the subsystem list, the
conversion sources — and ask **"Ready to apply this? (yes / no)"**. Wait for an explicit yes.

### Phase 1 — Install the machinery (orchestrator, via the shell — NOT agents, NOT the Edit tool)

Copy with the shell and substitute in place with `sed`/a script. Copying a file and then
`Edit`-ing it trips the harness read-gate (the copy was never Read at its new path); `cp`

- `sed` sidesteps that and keeps verbatim files byte-exact. Run from the target repo root:

1. **Copy** the whole manifest into place (`cp -R` the `scripts/`, `docs/`, and
   `assets/claude/` trees — write `claude/` to `.claude/`).
2. **Date** — replace `<YYYY-MM-DD>` with today's date (from the session environment) in
   exactly `docs/conventions/documentation.md`, `docs/references/okf.md`, and `docs/log.md`.
   Leave `<YYYY-MM-DD>` in the `docs-add` templates alone — those are filled per-concept.
3. **Project** — replace `<PROJECT>` in `docs/index.md`.
4. **docs-maintenance paths** — in `.claude/rules/docs-maintenance.md`, replace the
   `<source-edit-path-glob>` placeholder in the frontmatter `paths:` with the required source-edit path
   glob(s) gathered in Phase 0. Always install this rule. Do not invent a default path;
   if source edit paths are missing, stop and ask for them before applying the setup.
5. **Package manager** — replace the **literal** string `pnpm docs:validate` with the
   target's invocation (`npm run docs:validate`, `yarn docs:validate`, or no-op for pnpm).
   It occurs in `documentation.md`, `okf.md`, `.claude/skills/docs-add/SKILL.md`, and
   `.claude/skills/docs-validate/SKILL.md`. Match the full literal `pnpm docs:validate` —
   **never** the bare `docs:validate`: the package.json line
   `"docs:validate": "node scripts/validate-docs.mjs"` (and the identical line quoted in the
   docs-validate skill) is a pm-agnostic script _definition_ and must stay unchanged.
6. **package.json** — add the two scripts from the manifest.

### Phase 2 — Fan out parallel agents (the ONLY work that is parallelized)

Dispatch independent subagents — each writes into its **own** files only, so there are no
write conflicts. Run both workstreams concurrently. Every agent reads
`docs/conventions/documentation.md` first (it is the contract).

- **One agent per subsystem** → creates `docs/<subsystem>/index.md` from the
  `subsystem-index` template. Returns the root-`index.md` bullet and a `log.md` line — it
  does **not** edit the root files.
- **One agent per existing-doc source** → reads the source, classifies each piece into the
  OKF taxonomy (Decision / Specification / Convention / Glossary / Reference), and writes
  the converted concept(s) into a **distinct** assigned bundle path with conformant
  frontmatter. Subsystem-scoped knowledge nests under the subsystem; repo-wide knowledge
  goes top-level (`conventions/`, `glossary/`, `references/` — or `docs/decisions/`: the
  bundle is positional, so a top-level `decisions/` dir is valid for a genuinely
  cross-cutting Decision). Returns the index bullet(s) + log line(s), and leaves each
  original in place with a one-line pointer
  (e.g. `> Moved to [/path.md](/path.md) — see the OKF docs bundle.`) unless the user said
  to delete it.

**Every directory that gains a concept also needs a reserved `index.md`** — the validator
warns on a populated dir without one. An agent that writes
`docs/<subsystem>/decisions/foo.md` also writes `docs/<subsystem>/decisions/index.md`. This
is a required step, not optional polish.

### Phase 3 — Reconcile (single writer) and validate

1. The orchestrator — and only the orchestrator — merges every returned bullet into the
   right `index.md` (root + subsystem) and every returned line into `log.md`. This
   single-writer step is why Phase 2 agents never touch shared files.
2. Run `<pm> docs:validate`. Triage to **zero hard ERRORS**. A clean install always emits
   **one** soft warning — the policy file's own illustrative `/absolute/path.md` example
   link, which ships in the verbatim policy and is benign; do not edit the policy to chase
   it. Fix other cheap warnings (a populated dir missing its `index.md`, a missing
   recommended field); leave broken links to not-yet-written concepts alone.

### Phase 4 — Wire it into project memory

Add this Documentation section to the target's `CLAUDE.md`/`AGENTS.md` (create the file if absent),
swapping `<pm>` for the chosen package-manager command:

```md
## Documentation

- Repo knowledge lives in an OKF v0.1 bundle at `docs/`. Single source of truth for the
  lifecycle: `docs/conventions/documentation.md`.
- For any non-trivial design, review, feature work, bugfix, or refactor, consult the
  relevant OKF docs in addition to the code: applicable `decisions/` (ADRs),
  `specifications/`, the touched subsystem's `index.md`, `glossary/`, and `references/`.
  Code is the source of truth for current behavior. Docs are an additional source for
  intent, terminology, constraints, and prior decisions; do not duplicate implementation
  details from code into docs. If docs and code disagree, verify against the code, call out
  the mismatch, and update docs only when explicitly doing documentation work. Any sub-agent
  dispatched for non-trivial work MUST be given the relevant `docs/` concept files in its
  reading scope.
- Scaffold a concept with the `docs-add` skill; check conformance with `docs-validate`
  (`<pm> docs:validate` — advisory, never blocks).
```

## Who does what (the line you must not cross)

| Work                                                  | Done by                            |
| ----------------------------------------------------- | ---------------------------------- |
| Copying the validator / policy / skills / rules       | Orchestrator                       |
| Token + package-manager substitution, package.json    | Orchestrator                       |
| Merging bullets into `index.md` / lines into `log.md` | Orchestrator (single writer)       |
| Authoring subsystem index nodes                       | Parallel agent (one per subsystem) |
| Converting existing docs into concepts                | Parallel agent (one per source)    |

## Common mistakes

- **Regenerating the validator/policy from memory** instead of copying `assets/`. This is
  the #1 source of drift — the whole point of the bundled assets is byte-for-byte fidelity.
- **Routing a verbatim file through a subagent** to "do the copy". Subagents summarize;
  bytes drift. The orchestrator copies machinery itself, with the shell.
- **Global-replacing `docs:validate`** when rewriting the package manager. Substitute only
  the full literal `pnpm docs:validate`; the bare `docs:validate` is also a package.json
  script _definition_ that must not change.
- **Partial install** — stopping after `docs/index.md` + a couple of concepts. Install the
  whole manifest (test file, both rules, both skills, package.json scripts) or it is not the
  liveteach setup.
- **Parallel agents editing `index.md` / `log.md`** — concurrent writes race and clobber.
  Agents return lines; the orchestrator merges them once.
- **A populated dir with no `index.md`** — the validator warns; create the reserved index
  alongside every concept.
- **Treating validator warnings as failures** — only the ERRORS section is the bar.
- **Forgetting to ask where existing docs live** — conversion is part of this flow, not an
  afterthought; gather the sources in Phase 0.

## Verification

- `<pm> docs:validate` shows **zero hard ERRORS** (one benign warning from the policy's own
  example link is expected — see Phase 3).
- `<pm> docs:validate:test` (the bundled Node test suite) passes.
- The copied `scripts/validate-docs.mjs` is byte-identical to this skill's
  `assets/scripts/validate-docs.mjs` (`diff` is empty).
