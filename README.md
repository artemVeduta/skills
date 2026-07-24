# skills

Personal library of agent skills. Each skill is a self-contained directory under
`skills/<name>/` (one flat tree, no category buckets) whose root `SKILL.md` defines
the capability.

## Skills

- [`docs-add`](skills/docs-add/SKILL.md) — file one OKF concept (Decision,
  Specification, Convention, Glossary, Reference, or subsystem index) into a
  `docs/` bundle — frontmatter, body, parent `index.md` entry, and `log.md`
  lifecycle entry — under a single approval, then validate and read it back.
- [`docs-validate`](skills/docs-validate/SKILL.md) — run a repository's strict
  `docs:validate` script through its own package manager and interpret the
  result: clean/warnings-only, hard bundle errors, or validator malfunction.
- [`docs-sync`](skills/docs-sync/SKILL.md) — reconcile an OKF `docs/` bundle in
  one of two modes, chosen before any write: **branch sync** scopes from a target
  branch's merge-base through the whole working state and compacts branch-local
  drafting down to the accepted net state (one net lifecycle entry per concept,
  merged history preserved, a material reversal gated behind a linked
  supersession, unrelated target drift reported separately); **bundle-wide**
  audits the complete bundle and repairs every stale explanation, missing concept,
  omission, lifecycle drift, and shared-bookkeeping drift (no unrelated-drift
  category), preserving accepted history and blocking on any unknown acceptance
  boundary rather than guessing. A gated **migration** subflow (see
  `skills/docs-sync/references/migration.md`) converts durable documentation living
  outside the bundle into concepts through read-only classification and one approved
  proposal of exact concept destinations and source-path dispositions — an imported
  source keeps its pointer unless deletion is approved, and a split source stays as a
  concise overview or has its removal recorded. All three fan out to disjoint concept
  owners with one reconciler for indexes/logs/timestamps, verify with a fresh checker,
  and run the validator — all in the working tree, never touching Git state; declares
  `docs-validate` as a required skill.
- [`docs-setup`](skills/docs-setup/SKILL.md) — install, upgrade, reinstall, or
  repair the OKF v0.1 docs machinery in a repository (validator + tests, package
  scripts, seed policy/reference, marked `AGENTS.md` router, exact `CLAUDE.md`
  shim) — state recomputed from the repo every run, through read-only audits, one
  approved plan, and one deterministic writer; declares `docs-add` and
  `docs-validate` as required skills.
- [`docs-autoresearch`](skills/docs-autoresearch/SKILL.md) — run **explicit,
  bounded, safe** research and file the result as durable OKF knowledge. Given an
  explicit topic (or a user-selected frontier candidate — generic research never
  invokes it), it runs in one of **three explicit write modes**: **Reference
  enrichment** (default) files exactly one curated multi-source `Reference`;
  **Specification resolution** answers a target Specification's question in place
  (adding a Reference only when the evidence is independently reusable); and
  **pre-work reconnaissance** writes one dated brief under `research/` outside the
  bundle with no OKF ceremony. Read-only workers fan out behind a per-round
  barrier (3–5 in round 1, then gap/verification rounds capped at five targeted
  searches) and never delegate; a single coordinator is the only writer; fetches
  are metered against a cap that counts failures and retries (normal 20, one
  approved run up to a hard ceiling of 45, reset next run), only public HTTP(S)
  URLs are fetched, and raw bodies are never persisted. Shipped
  `RESEARCH-DEFAULTS.md` supplies the tunable defaults; an optional
  `docs/conventions/research.md` may refine fields and lower budgets but never
  override fixed mechanics, safety, or ceilings. Every durable write waits behind
  one filing plan; on approval concepts are filed through `docs-add` (at most
  three per run, all modes), validated through `docs-validate`, and read back.
  Collision, cap exhaustion, failed fetch, unsafe URL, concept ceiling, denied
  approval, mid-write failure, and insufficient fanout each follow a distinct
  stop contract. Declares `docs-add` and `docs-validate` as required skills.

## Install

The library ships through three channels — alternative package shapes, not harness
categories. Pick exactly one shape per harness profile; each managed channel below
carries an explicit warning against mixing shapes.

<!-- BEGIN dev-install (generated from registry) -->
### Development links

Clone the repository and run the interactive installer; it symlinks every
library skill from the working checkout into the harness profiles you select,
so edits and `git pull` reach every linked profile live:

```bash
git clone https://github.com/artemVeduta/skills.git
cd skills
./scripts/install.sh
```

Supported harnesses:

- **Claude Code** (`claude-code`)
- **Codex** (`codex`)
- **OpenCode** (`opencode`)

Update path: `git pull` (no reinstall).
<!-- END dev-install -->

<!-- BEGIN portable-install (generated from registry) -->
### Portable pure skills (managed whole-pack)

Managed, updatable skill copies without cloning the repository, via the upstream
`skills` CLI. Install the complete five-skill pack — the whole pack, never a
per-skill selection — into any supported harness (Claude Code, Codex, and OpenCode):

```bash
npx skills@latest add artemVeduta/skills --skill '*'
```

`--skill '*'` installs the whole pack, so every skill's `## Required skills`
dependency ships with it. There is no supported per-skill picker: a partial
selection could omit a required capability. The upstream CLI owns project vs.
global scope, its own storage, lock state, and updates (`skills update`).

Provenance: portable copies are installed from the `artemVeduta/skills` Git
repository, so their provenance is a Git commit/ref — the source ref the `skills`
CLI recorded — not a plugin version.

Updating the managed pack refreshes only these managed skill copies; it never mutates a repository
you previously configured with `docs-setup`. Upgrade a repository's docs tooling
by running `docs-setup` again, and reconcile its bundle with `docs-sync` — never
through a pack update.

> **Do not mix package shapes in one profile.** A harness profile that installs
> the pack through the portable channel must not also install it as a native plugin (or overlay checkout
> links) — the harness would then expose duplicate namespaced and unnamespaced
> capabilities. Pick exactly one package shape per profile.
<!-- END portable-install -->

<!-- BEGIN native-install (generated from registry) -->
### Native aggregate plugins (managed whole-pack)

Install the complete five-skill pack as one native plugin; the harness CLI owns
install, caching, namespacing, enablement, and updates, per configuration root
(`CLAUDE_CONFIG_DIR` / `CODEX_HOME`). Native plugins are available for Claude Code and Codex
only. There is no OpenCode native plugin; use the portable channel above for OpenCode.

**Claude Code:**

```bash
claude plugin marketplace add artemVeduta/skills
claude plugin install skills@artemveduta
```

Skills install namespaced (e.g. `/skills:docs-setup`). Update path:
`claude plugin marketplace update artemveduta`.

**Codex:**

```bash
codex plugin marketplace add artemVeduta/skills
codex plugin add skills@artemveduta
```

Update path: `codex plugin marketplace upgrade artemveduta`.

Provenance: native copies carry a plugin version/release — both plugin manifests
mirror the release tag — so a `<harness> plugin` listing answers "what version is
installed".

Updating the managed pack refreshes only the installed plugin; it never mutates a repository
you previously configured with `docs-setup`. Upgrade a repository's docs tooling
by running `docs-setup` again, and reconcile its bundle with `docs-sync` — never
through a pack update.

> **Do not mix package shapes in one profile.** A harness profile that installs
> the pack as a native plugin must not also install it through the portable channel (or overlay checkout
> links) — the harness would then expose duplicate namespaced and unnamespaced
> capabilities. Pick exactly one package shape per profile.
<!-- END native-install -->

## Notes

- **`~/.agents/skills` doubles as the portable CLI's own storage.** It is both a
  development symlink target and where `npx skills` keeps its managed copies; do
  not point both channels at the same directory.
