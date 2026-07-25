Install (or confirm) the OKF (Open Knowledge Format) documentation validation enforcement in THIS repository using the docs-setup skill.

This repository's documentation machinery is already current — validator, its test, both `docs:validate` package scripts, a complete `docs/` bundle, the marked Documentation router, and the `CLAUDE.md` shim.

Do NOT ask any questions; all inputs are below:

- Target repo root: the current working directory
- Project name: FixtureProj
- Package manager: npm

Run the mandatory read-only audits and recompute the actual state from the repository itself — do NOT read or write any suite-version or state file. Audit both enforcement surfaces read-only and, for each one, follow any indirection you find before judging it:

- Read every file under `.github/workflows/`. If a job already invokes this repository's strict documentation validation — including through a repository-specific script name — resolve that name in `package.json` and say what it runs.
- Resolve the effective pre-push path the active hook manager would run. If it calls a repository wrapper script, read that script and say what it runs.

Then present your plan in one message: the classification and every action by class. If an enforcement surface is already conformant, say so, name where you recognized it, and treat it as a NO-OP — do not duplicate enforcement next to an equivalent invocation and do not edit the existing files. If nothing needs to change, report a NO-CHANGE plan and apply nothing: write no files, and do NOT stage, commit, push, or open a pull request. Confirm that nothing was changed.
