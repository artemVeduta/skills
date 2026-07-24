# Existing-source migration — the gated subflow

This reference is the full contract for the docs-sync **existing-source migration
subflow**. `SKILL.md` summarizes the gate and points here; read this before
proposing or writing any migration.

Migration converts **durable documentation that lives outside the `docs/` bundle**
— ad-hoc notes, a `README`, design docs, a wiki page — into conformant OKF
concepts. It runs when the user explicitly asks to migrate/convert existing
documentation, or when a bundle-wide audit finds durable knowledge outside the
bundle. It is the **only** extra approval inside sync, because it authorizes
**destructive source-path changes** (moving or removing an imported file) rather
than the ordinary non-destructive reconciliation the two sync modes perform.

The rest of the skill's contract is **reused unchanged**: dynamic fanout, disjoint
ownership with a single reconciler for indexes/logs/timestamps, the 300-line
keep-or-split review, contradiction blocking, the fresh verifier, the strict
`docs:validate` gate, and Git-state preservation. Migration adds only the
read-only classification, the completed proposal, and the source-path dispositions
described below.

## 1. Read-only classification — write nothing

Dispatch **read-only** workers to survey the candidate sources. Each worker
**classifies every candidate without writing** — no concept is written, no source
is moved, and nothing is deleted during classification. Every candidate gets
exactly one label:

- **`keep`** — durable and already conformant enough to leave where it is; no
  bundle concept is needed (or it already exists). No source change.
- **`normalize`** — durable knowledge whose content belongs in the bundle but needs
  reshaping into a conformant concept (frontmatter, canonical body, citations).
- **`split`** — one source covering multiple independent subjects with independent
  lifecycles; it becomes several concepts.
- **`move`** — durable single-subject content that belongs in the bundle largely
  as-is, relocated into a concept.
- **`remove`** — operational output, run exhaust, or a stale duplicate that is not
  durable knowledge and should not enter the bundle.
- **`ambiguous`** — the worker cannot decide whether the source is durable
  knowledge, which subjects it splits into, or where it belongs. It is **not**
  guessed: it is surfaced for the user to resolve.

A worker returns its proposed classification and the material for the proposal
below; it never writes.

## 2. The complete proposal

The coordinator consolidates the workers' output into **one complete proposal**
covering **every** candidate. For each candidate the proposal states, exactly:

- the **concept destination(s)** — the exact bundle-relative path(s) a concept
  would be written to;
- the **type** of each concept (`Decision`, `Specification`, `Convention`,
  `Glossary`, `Reference`, or an open-taxonomy type);
- the **outline** of each concept (its frontmatter and section headings), with
  current truth **cited** by symbol/file, never pasted verbatim;
- the **local-index entry** each new concept adds to its parent `index.md`;
- the **lifecycle entry** each concept adds to the nearest `log.md`; and
- the **source-path disposition** — what happens to the original file (kept in
  place, kept as a slimmed overview, or removed), stated per source.

The proposal is presented conversationally and the run **pauses**. No file is
written yet.

## 3. The approval gate

**Nothing is written, moved, or deleted until the complete proposal is approved and
every ambiguity is resolved.**

- The user must approve the **complete** proposal, not one candidate at a time — a
  partial go-ahead does not authorize any write.
- **Every `ambiguous` candidate must be resolved first.** If any candidate is still
  ambiguous, the run does not begin writing; it asks the user to resolve the
  ambiguity (durable or not, which subjects, where it belongs) and only then
  proceeds. Ambiguity is never resolved by guessing.
- **Denied approval** leaves **all** source and bundle files **unchanged** — see
  the closing section.

## 4. Approved writers own non-overlapping concepts; one reconciler owns bookkeeping

Once the complete proposal is approved, execution reuses the skill's shared fanout
rules:

- **Approved writers own non-overlapping concepts.** Each writer owns a disjoint set
  of concept files; no two writers touch the same concept. Partition the approved
  concepts before dispatch.
- **Only the reconciler changes shared state.** A single reconciler is the sole
  writer of the shared `index.md` files, the `log.md` files, and concept
  `timestamp` frontmatter — so no two writers race a shared file, and one net
  lifecycle entry is written per concept (a migrated concept is a `Creation`). No
  operational `docs-sync ran` / `**Noted**` entry is ever written.

## 5. Source-path dispositions

The approved source-path disposition governs what happens to each original file.

- **An imported source keeps its existing pointer unless its deletion was
  explicitly approved.** After a `move` or `normalize` import, the original file
  stays exactly where it is — other files and links may still point at it, so it
  remains a valid pointer target — **unless** the user explicitly approved deleting
  it. Silence is not approval to delete: the default for an imported source is to
  keep it.
- **A split source is kept as an overview only when approved as a stable entry
  point.** After a `split`, the original path either:
  - **remains as a concise, conformant overview** — a short entry point that links
    into the bundle at the new concepts — but **only when the user approved keeping
    it** as a still-useful stable entry point; or
  - **is removed**, and its **approved removal is recorded** as part of the
    migration (the run reports the removed source disposition; it is never a silent
    delete), when the original is not a useful standalone entry point.
- A `remove` candidate is not filed as a concept; its approved removal is likewise
  recorded.

## 6. Verification

After the reconciler has written, dispatch a **fresh verifier** (not an author of
the edits) that checks, in addition to the shared verification list:

- **every approved source disposition** — a kept source is still present and
  unmodified where the proposal said keep; a slimmed overview exists at its path and
  points into the bundle; an approved removal is gone; nothing else was moved or
  deleted;
- **the resulting concepts** — each written concept matches the approved proposal
  (path, type, outline), cites current truth by symbol/file, and copies no
  executable truth verbatim; and
- **validation** — run `docs:validate` and classify the strict exit (`0`
  clean/warnings-only = success; `1` hard errors or `2` malfunction = not
  successful).

Author→verifier correction repeats until the verifier is clean or the run is
genuinely blocked.

## 7. Denied approval, partial failure, and Git

- **Denied approval leaves everything unchanged.** If the user denies (or does not
  approve) the proposal, **no** source or bundle file is written, moved, or deleted;
  the repository is left byte-for-byte as it was found.
- **A partial write failure reports the exact resulting state — no destructive
  rollback.** If a write fails partway through an approved migration, stop and
  report the **exact** state: which concepts were written, which sources were moved
  or removed, and what remains. Do **not** attempt a destructive rollback that could
  lose work or leave the tree in a worse state than the precise partial one.
- **Never touch Git.** The migration workflow edits and verifies working-tree files
  only; it never stages, commits, pushes, opens a pull request, or adds/changes a
  remote. Leave staging, commits, remotes, and pull-request state exactly as found.
