---
paths:
  - "<src-root>/**/*.{ts,tsx}"
---

# Keep docs in sync with source

- You are editing source. Check whether the mirrored `docs/…` concept needs
  updating — a `Specification` if behaviour/mechanics changed, a `Decision`
  amendment if an architectural choice changed.
- The docs bundle is the source of truth; see `docs/conventions/documentation.md`.
- This is advisory, never blocking. Not every file has docs yet — if no matching
  concept exists, there's nothing to update.

<!--
Drop-in rule — the body is feature-agnostic and never needs per-subsystem edits.
Set `paths:` once to your repo's source root(s); a single brace-glob can cover
several packages, e.g. '{pkg-a,pkg-b}/src/**/*.{ts,tsx}'. The always-on
`docs-authoring.md` rule doesn't depend on this one — delete this file if you
don't want source-edit nudges.
-->
