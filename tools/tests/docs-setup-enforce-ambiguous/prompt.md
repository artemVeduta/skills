Install (or confirm) the OKF (Open Knowledge Format) documentation validation enforcement in THIS repository using the docs-setup skill.

This repository's documentation machinery is already current — validator, its test, both `docs:validate` package scripts, a complete `docs/` bundle, the marked Documentation router, and the `CLAUDE.md` shim.

Do NOT ask any questions about the inputs; they are all below:

- Target repo root: the current working directory
- Project name: FixtureProj
- Package manager: npm

Run the mandatory read-only audits and recompute the actual state from the repository itself — do NOT read or write any suite-version or state file. Audit both enforcement surfaces read-only and, for each, follow any indirection you find:

- Read every file under `.github/workflows/`. If a step reaches the documentation validation through an indirection, follow it and say what it runs.
- Resolve the effective pre-push path the active hook manager would run, and follow any wrapper it calls.

If you CANNOT establish read-only whether an existing surface already invokes this repository's strict documentation validation, do not decide it for me. Present it as an AMBIGUITY in the plan, name the exact file and the step or command you could not resolve, and state what you need from me. Do not guess either way — do not assume the existing surface already covers documentation and skip, and do not install enforcement alongside it "just in case".

Present your COMPLETE plan in one message — the classification, every action by class, and every ambiguity — and STOP. Write nothing yet. Do NOT stage, commit, push, or open a pull request.
