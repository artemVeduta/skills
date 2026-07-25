Install the OKF (Open Knowledge Format) documentation validation enforcement in THIS repository using the docs-setup skill.

This repository was configured by an EARLIER docs-setup run and its documentation machinery is already current: the canonical `scripts/validate-docs.mjs` and its test, both `docs:validate` package scripts, a complete `docs/` bundle, the marked Documentation router in `AGENTS.md`, and the `CLAUDE.md` shim are all in place. What it does NOT have is validation enforcement.

Do NOT ask any questions; all inputs are below:

- Target repo root: the current working directory
- Project name: FixtureProj
- Package manager: npm

Run the mandatory read-only audits and recompute the actual state from the repository itself — do NOT read or write any suite-version or state file. Audit the enforcement surfaces specifically: report what GitHub evidence you found, whether any existing workflow already invokes this repository's strict documentation validation, and whether an active, repository-owned hook manager configuration exists and which pre-push path it would actually run.

Then present your COMPLETE plan in one message — the classification and every action by class (create / replace / no-op / preserve / skip / delete), plus every ambiguity — and STOP. Write nothing yet. Do NOT stage, commit, push, or open a pull request.
