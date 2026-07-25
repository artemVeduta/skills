# Enforcement mechanics and the retired-surface tombstones

The two heaviest parts of the setup contract, pulled out of `SKILL.md`: how repository
validation enforcement is discovered, judged conformant, installed, and verified; and the
durable tombstone list that versionless convergence plans removals from. `SKILL.md` states
every rule and every never-rule; this file carries the mechanics. **Read it before
planning enforcement or proposing a retired-surface removal.**

Nothing here changes the workflow: enforcement actions and tombstone removals are ordinary
plan rows — audited read-only, classified, presented in the one plan, and applied by the
single writer after the one explicit approval.

## 1. GitHub workflow enforcement

### Detection — repository evidence or an explicit request, never a guess

GitHub is detected from any one of:

- **a GitHub remote** — a configured remote URL whose host is a GitHub host (read
  `git remote -v` read-only; never add, change, or fetch a remote);
- **existing GitHub workflow structure** — a `.github/workflows/` directory, whatever it
  contains;
- **an explicit user request** — the user asked for the docs CI check by name.

When none of the three is present, the enforcement row is a **reported skip**: say plainly
that no GitHub evidence was found and that no workflow was installed. Do **not** prompt for
a platform, do **not** infer one from a hosting-agnostic remote, and never add workflow
files to an unrelated repository.

### Conformance — an equivalent invocation is a no-op

Read every file under `.github/workflows/` read-only. A workflow is **conformant** when it
already invokes the repository's strict documentation validation over the complete bundle.
Recognize all of these as equivalent:

- the package-manager forms of the canonical script — `npm run docs:validate`,
  `pnpm docs:validate`, `yarn docs:validate`, `bun run docs:validate`;
- the direct node form — `node scripts/validate-docs.mjs`;
- a **repository-specific script name** whose `package.json` definition runs the validator
  (`docs:check`, `validate:docs`, a `docs` target that shells into it);
- a **wrapper** — a repository script, Makefile target, or composite action step whose body
  reaches the same command. Follow one indirection into the file the step names; if the
  indirection cannot be resolved read-only, treat the workflow as **ambiguous** (below).

A conformant workflow is a **no-op**. Enforcement is **not duplicated** — the managed
workflow is not installed, and the existing job is left byte-preserved. Report that
existing enforcement was recognized and where.

A workflow that runs validation over only part of the bundle (a diff-scoped or
path-filtered invocation) is **not** conformant: the guard's contract is the complete
bundle. Install the managed workflow alongside it.

**Ambiguous enforcement** — a job that might or might not reach the validator, or a wrapper
whose body is unreadable — is presented as an ambiguity in the plan and resolved by the
user before writing, exactly like ambiguous project-memory prose. Never guess.

### The managed workflow

When no equivalent exists, install this skill's **own dedicated** workflow:
`assets/github/workflows/docs-validate.yml` → `.github/workflows/docs-validate.yml`,
verbatim. It runs on **both `push` and `pull_request`**, and exit `1` or `2` fails the job.
An existing file at that destination is an ordinary managed row: created if missing,
customized-until-reviewed if differing, a no-op if byte-current.

**Never modify arbitrary CI logic.** Another workflow's jobs, triggers, and steps are the
repository's, not setup's — the dedicated file is the whole of setup's CI surface.

### Always out of scope

No GitHub API call, no GitHub CLI invocation, no branch-protection, ruleset, or
required-check configuration, and nothing that makes the check remotely mandatory. Remote
repository governance belongs to a repository administrator; a local setup run only writes
repository files. Say so in the report when the user expects a required check.

## 2. Husky pre-push enforcement

### Detection — an initialized hook manager, not a dependency line

Local push enforcement is supported **only** through an active, recognizable Husky
configuration the repository **already owns**. Evidence is an initialized hook manager:

- a repository-owned Husky hooks directory that actually carries the manager's runtime and
  hooks (a `.husky/` tree with hook files and its internal helper directory, or the
  directory the repository has already configured as its hooks path pointing there).

A `dependencies`/`devDependencies` entry, a lockfile line, or a `prepare` script alone is
**not** evidence — a dependency without active configuration is insufficient. When there is
no active configuration, **skip** local-hook installation and report the skip: name what
was looked for and state that no hook was installed.

**Never** install, initialize, or upgrade Husky (no package add, no `husky install` /
`husky init`, no `prepare` script), never write or edit native `.git/hooks/*`, and never
change the configured hooks path. Detection is read-only.

### The effective pre-push path

Resolve the hook file the repository's active configuration would actually run for
`pre-push` — the pre-push file inside the repository's own Husky hooks directory. Exactly
that one file receives the managed block. When Husky is active but has no pre-push file
yet, create it with the managed block as its only content.

### One identifiable managed block

The block is delimited by **stable markers**, the same discipline as the `AGENTS.md`
router:

```sh
# BEGIN OKF docs validation (managed by docs-setup)
<pm> docs:validate
# END OKF docs validation (managed by docs-setup)
```

`<pm>` is the detected invocation prefix, exactly as in the router substitution.

- **Existing hook commands are byte-preserved.** Adding docs validation must not break
  unrelated tests, linting, or deploy checks: no existing line is edited, removed, or
  reordered. The block is appended at the end of the hook.
- **Idempotent.** A recognized managed block is replaced **in place**; repeated runs
  neither duplicate the block nor reorder existing hook behavior. A second run over an
  installed hook is a no-op.
- **An equivalent existing invocation is a no-op** — the same equivalence set as the
  workflow above (any package-manager form, the direct node form, a repository-specific
  script name, or a repository **wrapper script** the hook calls). No block is added, and
  the hook is left byte-preserved.
- A **customized** managed block (marker-delimited but edited) is
  customized-until-reviewed like any managed file: review, approval, then reinstall.

### What the guard validates

The **complete bundle, on every push** — the plain `docs:validate` script with no
arguments and no scoping. Never restrict the guard to changed files, a diff, or a
subdirectory: merges, validator changes, and errors inherited from another branch must not
bypass enforcement.

## 3. Enforcement is installed even when the bundle currently fails

A bundle that fails validation is precisely the case enforcement exists for, so a
pre-existing content error never postpones installing it. Install the planned enforcement,
then state plainly in the report that **pushes remain blocked until the bundle is
repaired**, and that repairing content is a separate explicitly invoked docs-sync run.

Keep the two reported results independent (`SKILL.md` → step 7): a pre-existing content
error is a **bundle** result and must never classify the freshly installed machinery or
enforcement as uninstalled.

## 4. Retired managed surfaces — the durable tombstones

Convergence is versionless: there is no installed version marker and no version-branched
migration engine. The plan is derived from the current managed surfaces, this durable
tombstone list, **historical fingerprints or managed markers**, and actual repository
state.

A **historical fingerprint** is byte-identity with a copy this suite shipped for that path.
A **managed marker** is an in-file marker naming this suite as the owner (the router's
`BEGIN/END OKF docs router (managed by docs-setup)` pair, the pre-push block's markers, or
an equivalent owner header a retired surface carried). Either one proves suite ownership.

| Retired surface | What it was | Proof of suite ownership |
| --- | --- | --- |
| `.claude/rules/docs-authoring.md` | The Claude-only docs-authoring adapter, retired by this contract: portable project memory plus the lifecycle Convention are the required policy surfaces. | Fingerprint of a shipped pointer-only rule, or a managed owner marker. |
| `.claude/rules/docs-maintenance.md` | An earlier retired Claude-only maintenance adapter. | Same. |
| `.claude/skills/docs-*` | Project-local copies of the canonical helper skills (`docs-add`, `docs-validate`, and any earlier-named sibling). Helpers are depended on by discovery, never copied. | Fingerprint of a shipped helper tree; removal also requires confirmed canonical discovery. |
| Legacy or superseded managed router sections in project memory | Earlier marked Documentation blocks in `AGENTS.md` (or a pre-router block in `CLAUDE.md`) under a superseded marker name, left beside the current router. | The superseded marker pair itself. |
| A retired managed tooling, wiring, or workflow surface | A prior revision's managed helper copy under `scripts/`, its package-script wiring, or its managed workflow file — anything this contract's manifest no longer lists. | Fingerprint or managed marker; the manifest in `SKILL.md` is the current surface list. |

Coverage therefore spans **tooling, wiring, adapters, workflows, managed router sections,
and legacy helper copies**.

### Classification — three outcomes, never a guess

- **Proven obsolete** — byte-identical to a historical fingerprint, or carrying a managed
  marker that proves suite ownership → planned as a **removal in the normal plan**, listed
  with every other action so cleanup is **visible and approved**. It is applied by the one
  writer after the one approval, never silently.
- **Customized or uncertain** — the file differs from every known fingerprint and carries
  no owner marker, or its provenance cannot be established → a **conflict** requiring an
  explicit **keep or remove** decision from the user. Setup never guesses that user content
  is disposable, and a conflict left unresolved blocks completion.
- **Missing** — the retired path is not present → a silent **no-op**, not reported as work.

### Never removed

Evolving OKF knowledge is never a tombstone target: no concept, no `index.md`, no `log.md`,
no `specifications/` tree, no subsystem content, and nothing else the project accumulated.
**Every OKF knowledge file is byte-preserved by setup**, and the verifier proves it. A
retired-surface removal that would touch bundle content is a bug in the plan, not an
approval question.
