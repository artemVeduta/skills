---
type: Convention
title: Documentation lifecycle policy
description: How knowledge concepts are created, updated, and superseded in this repository's OKF docs bundle.
timestamp: 2026-07-25
---

# Documentation lifecycle policy

This bundle conforms to the Open Knowledge Format (OKF) v0.1 — see
[/references/okf.md](/references/okf.md). This concept is the single source of truth for
the docs flow; project memory links here rather than restating it.

## The bundle

- One bundle rooted at `docs/`. Every retained `.md` file under it is validated
  uniformly — there is no exclusion or suppression grammar; non-Markdown sidecars are
  ignored by the validator.
- Repo-wide knowledge lives in top-level directories — `conventions/`, `glossary/`,
  `references/`, plus `decisions/` and `specs/` as they appear; subsystem knowledge nests
  under the subsystem (`<subsystem>/<area>/...`).
- **One repository, one bundle.** A repository has exactly one bundle root. A monorepo
  does not get one bundle per workspace: each workspace is a top-level subsystem node
  inside the single bundle, nesting its knowledge as `<workspace>/<area>/...` like any
  other subsystem.
- A concept = one markdown file = YAML frontmatter + markdown body. Concept ID = the
  file path within the bundle minus `.md` (identity is positional, not a field).
- **Discovery is progressive and ordered.** A reader — human or agent — enters at
  `docs/index.md`, descends to the affected subsystem's `index.md`, reads the applicable
  `Decision`s, `Specification`s, `Glossary` terms, and `Reference`s, and only then
  searches the repository. Consulting the relevant concepts alongside the code is required
  before any non-trivial design, review, feature, bugfix, or refactor.
- **A delegated worker receives its reading scope explicitly.** Any sub-agent dispatched
  for non-trivial work is handed the exact bundle-relative concept paths it must read;
  discovery is never left to it. Root `AGENTS.md` states both obligations at the entry
  point and points here for the policy itself.

## Frontmatter standard

Every concept (everything except `index.md` / `log.md`) opens with:

```yaml
---
type: <one of the taxonomy values> # REQUIRED — non-empty
title: <human-readable name> # recommended
description: <one-sentence summary> # recommended
resource: <canonical URI> # recommended for a Reference concept
timestamp: <ISO 8601> # recommended — last meaningful change
tags: [<tag>, ...] # optional
# extension keys allowed, e.g. for retiring a concept:
status: superseded
superseded_by: /path/to/replacement.md
---
```

- Frontmatter must be a parseable YAML mapping between standalone `---` delimiters
  (opening delimiter on the first line); duplicate keys, invalid YAML, missing or
  unterminated delimiters, and non-mapping documents are hard errors, as is a missing,
  empty, or non-scalar `type` (OKF §9). The validator's dependency-free oracle accepts
  a documented YAML subset: anchors, aliases, tags, multi-line quoted scalars, and
  multi-line flow collections are rejected as unparseable; a plain scalar may wrap onto
  more-deeply-indented continuation lines. `title`, `description`, `timestamp` are
  recommended — `npm run docs:validate` warns (never blocks) when they are missing.
- `status` / `superseded_by` are our extension keys for the deprecation flow; OKF
  requires consumers to tolerate unknown keys, so they are spec-safe.

## The taxonomy (open — five concept types + the Subsystem role)

| `type`          | Purpose                                                              | Conventional body                                                         |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `Decision`      | A durable architectural decision: choice, alternatives, consequences | Context · Decision · Alternatives · Consequences · `# Amendments` (dated) |
| `Specification` | How something works: mechanics, algorithms, API shapes, formulas     | structural markdown; cite the governing `Decision`                        |
| `Convention`    | Prescriptive coding/design rules                                     | rule statements + rationale                                               |
| `Glossary`      | One defined term per file                                            | definition + links to where it is used                                    |
| `Reference`     | External material mirrored as a first-class concept                  | summary + `# Citations`                                                   |

The taxonomy is **open** — add a type later by just using it (e.g. `Guide`, `Runbook`).
Consumers must tolerate unknown types.

**Subsystem orientation** is provided by a directory's reserved `index.md` (no
frontmatter), not by a `type`. There is no `type: Subsystem` frontmatter value.

## Reserved files

- **`index.md`** (any directory): no frontmatter, except the bundle-root `docs/index.md`
  which carries only `okf_version: "0.1"`. Body = `#` section headings, each a bullet
  list of `[Title](/absolute/path.md) - description`. Used for progressive disclosure.
- **`log.md`** (any level): `## YYYY-MM-DD` headings, newest first; bulleted prose
  entries with a conventional leading bold verb (`**Creation**`, `**Update**`,
  `**Deprecation**`).

## Linking

- Cross-references are plain markdown links, bundle-relative absolute
  (`/<subsystem>/<area>/specs/<concept>.md`).
- Relationship meaning lives in prose, not in metadata (OKF has no typed relations).
- Broken links are tolerated (they may be not-yet-written knowledge); the validator
  reports them as warnings, never errors.
- **Link stable resources; give unstable ones a concept.** A stable repository resource
  may be linked directly. An external or generated collection that needs durable
  explanation gets a `Reference` concept describing it instead. Ephemeral output is
  represented by durable provenance — what produced it, when, and where it lands — never
  by a link into a directory a later run destroys or a cleanup removes.

## Code in concepts — separate truth by type

Two kinds of truth live in this repo, and each has exactly one home:

- **Executable truth** — code, tests, schemas, workflow YAML, generated API reference.
  It is verified by running it; its single source is the file that runs. This is
  everything in the repo **outside `docs/`**.
- **Explanatory truth** — ADRs/`Decision`s, glossary, business rules, runbooks,
  architecture context, ownership, cross-system knowledge. It is verified by review and
  shared understanding; its single source is the `docs/` bundle.

The bundle holds explanatory truth and **points at** executable truth — it never copies
it. So:

- **Do not paste executable truth verbatim.** Reference it — name the file and symbol, or
  link it (`see \`src/foo/Bar.ts\` → \`baz()\``). Copied code, schemas, or YAML drift the
  moment the source changes and the validator cannot catch the divergence.
- **Illustrative code is fine when it is not a copy:** short pseudo-code, a formula, an
  API/type _shape_, or a minimal example written for the doc. Keep it to the smallest
  fragment that makes the point, and prefer prose + a citation over a fragment when either
  works.
- A `Specification` describes behaviour and contracts; if you find yourself reproducing an
  implementation, link to it and describe what it guarantees instead.

This is the docs-bundle expression of DRY — explanatory truth here in `docs/`, executable
truth everywhere outside it.

## Create / Update / Supersede

- **Create** a concept when: a new subsystem appears (a subsystem `index.md` + initial
  concepts); an architecturally significant choice is made (`Decision`); a non-obvious
  behaviour/algorithm/API ships (`Specification`); a repo-wide rule is adopted
  (`Convention`); a new domain term enters use (`Glossary`); external material needs to
  be first-class (`Reference`). Use the **`docs-add`** skill.
- **Update** a concept when: source behaviour changes → revise the matching
  `Specification` and bump `timestamp`; a decision is revised or reversed → **amend** the
  `Decision` (append a dated entry under `# Amendments`, do **not** rewrite history) and
  add a `log.md` line.
- **Supersede** when knowledge stops being true: set `status: superseded` +
  `superseded_by:` linking the replacement; add a `log.md` `**Deprecation**` entry.
  Never silently delete.

## The update ceremony

The mechanical bookkeeping of any `docs/**` edit — bump `timestamp`, append a `log.md`
entry, amend-don't-rewrite `Decision`s, set supersede keys — is the author's obligation
under this policy, and it holds wherever the edit is made. No harness-specific
documentation rule ships; the obligation is portable and identical everywhere.
`npm run docs:validate` is the strict backstop: exit `0` for a clean or warnings-only
bundle, `1` for hard errors, `2` for validator malfunction. Warnings never block (a stale `timestamp` older
than the newest dated `# Amendments` entry is one of them), and there is no suppression
grammar.
