# AGENTS.md

Personal library of Claude Code skills (`skills/<name>/`) with shared shell utilities
in `scripts/`.

## Documentation

- Repo knowledge lives in an OKF v0.1 bundle at `docs/`. Single source of truth for the
  lifecycle: `docs/conventions/documentation.md`.
- For any non-trivial design, review, feature work, bugfix, or refactor, consult the
  relevant OKF docs in addition to the code: applicable `decisions/` (ADRs),
  `specs/`, the touched subsystem's `index.md`, `glossary/`, and `references/`.
  Code is the source of truth for current behavior. Docs are an additional source for
  intent, terminology, constraints, and prior decisions; do not duplicate implementation
  details from code into docs. If docs and code disagree, verify against the code, call out
  the mismatch, and update docs only when explicitly doing documentation work. Any sub-agent
  dispatched for non-trivial work MUST be given the relevant `docs/` concept files in its
  reading scope.
- Scaffold a concept with the `docs-add` skill; check conformance with `docs-validate`
  (`npm run docs:validate` — advisory, never blocks; validator tests:
  `npm run docs:validate:test`).
