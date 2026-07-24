<!-- BEGIN OKF docs router (managed by docs-setup) -->
## Documentation

- Repo knowledge lives in an OKF v0.1 bundle at `docs/`. Lifecycle authority:
  `docs/conventions/documentation.md`. Discover from `docs/index.md` → the affected
  subsystem's `index.md` → applicable Decisions, Specifications, Glossary terms, and
  References → targeted repository search.
- For any non-trivial design, review, feature, bugfix, or refactor, consult the relevant
  concepts alongside the code. Code is the source of truth for current behavior; the
  bundle is the source of truth for intent, terminology, constraints, and prior
  decisions. Do not duplicate implementation detail from code into docs. If docs and code
  disagree, the code wins for current behavior — call out the mismatch.
- When your change alters behavior, an interface, or an architectural choice a concept
  describes, update the affected concept in the same change; do not defer it.
- Any sub-agent dispatched for non-trivial work MUST receive the exact relevant `docs/`
  concept paths in its reading scope.
- Scaffold a concept with the `docs-add` skill; check conformance with `docs-validate`
  (`<pm> docs:validate` — strict: exit `0` clean/warnings-only, `1` hard errors, `2`
  malfunction; warnings never block).
<!-- END OKF docs router (managed by docs-setup) -->
