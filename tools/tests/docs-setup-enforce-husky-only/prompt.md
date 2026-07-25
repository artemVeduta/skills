Install the OKF (Open Knowledge Format) documentation validation enforcement in THIS repository using the docs-setup skill.

This repository's documentation machinery is already current — validator, its test, both `docs:validate` package scripts, a complete `docs/` bundle, the marked Documentation router, and the `CLAUDE.md` shim. Only enforcement is missing.

Do NOT ask any questions; all inputs are below:

- Target repo root: the current working directory
- Project name: FixtureProj
- Package manager: npm

Run the mandatory read-only audits and recompute the actual state from the repository itself — do NOT read or write any suite-version or state file. Audit both enforcement surfaces read-only and report each judgement explicitly:

- Is there an active, recognizable, repository-owned hook manager configuration? Which pre-push path would it actually run?
- What GitHub evidence did you find? Say exactly what you looked for. If there is no evidence, say so plainly and report the workflow as a SKIP — do not prompt me for a platform, do not infer one, and do not add workflow files to a repository with no GitHub evidence.

Then present your COMPLETE plan in one message — the classification and every action by class (create / replace / no-op / preserve / skip / delete), plus every ambiguity — and STOP. Write nothing yet. Do NOT stage, commit, push, or open a pull request.
