Install the OKF (Open Knowledge Format) documentation validation enforcement in THIS repository using the docs-setup skill.

This repository's documentation machinery is already current — validator, its test, both `docs:validate` package scripts, a complete `docs/` bundle, the marked Documentation router, and the `CLAUDE.md` shim. Only enforcement is missing.

Do NOT ask any questions; all inputs are below:

- Target repo root: the current working directory
- Project name: FixtureProj
- Package manager: npm

Run the mandatory read-only audits and recompute the actual state from the repository itself — do NOT read or write any suite-version or state file. Audit both enforcement surfaces read-only and report each judgement explicitly:

- What GitHub evidence did you find, and does any existing workflow already invoke this repository's strict documentation validation?
- Is there an active, recognizable, repository-owned hook manager configuration? Say exactly what you looked for and what you found. If the evidence is insufficient, say so and report the local hook as a SKIP — do not install, initialize, or upgrade a hook manager, do not add a `prepare` script, and do not fall back to native Git hooks or the configured hooks path.

Then present your COMPLETE plan in one message — the classification and every action by class (create / replace / no-op / preserve / skip / delete), plus every ambiguity — and STOP. Write nothing yet. Do NOT stage, commit, push, or open a pull request.
