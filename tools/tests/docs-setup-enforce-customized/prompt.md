Install the OKF (Open Knowledge Format) documentation validation enforcement in THIS repository using the docs-setup skill.

This repository's documentation machinery is already current — validator, its test, both `docs:validate` package scripts, a complete `docs/` bundle, the marked Documentation router, and the `CLAUDE.md` shim. It also already has an ACTIVE, repository-owned Husky configuration whose `pre-push` file runs its own commands and already carries a block between the `# BEGIN OKF docs validation (managed by docs-setup)` and `# END OKF docs validation (managed by docs-setup)` markers — but someone has hand-edited the command inside that block.

Do NOT ask any questions; all inputs are below:

- Target repo root: the current working directory
- Project name: FixtureProj
- Package manager: npm

Run the mandatory read-only audits and recompute the actual state from the repository itself — do NOT read or write any suite-version or state file. Read the effective pre-push path and compare its managed block, byte-for-byte, against the canonical block this skill would install. The stable markers alone are not proof the block is current: if the content between them differs from canonical, treat it exactly like any other managed file that differs — customized until reviewed, never blindly overwritten.

Then present your COMPLETE plan in one message — the classification and every action by class (create / replace / no-op / preserve / skip / delete), plus every ambiguity — and STOP. Write nothing yet. Do NOT stage, commit, push, or open a pull request.
