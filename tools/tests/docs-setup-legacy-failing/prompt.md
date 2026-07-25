Install the OKF (Open Knowledge Format) documentation validation enforcement in THIS repository using the docs-setup skill.

This repository's managed machinery is current — the canonical validator and its test, both `docs:validate` package scripts, the marked Documentation router, the `CLAUDE.md` shim, the seed lifecycle policy, and the OKF reference. Its BUNDLE, however, is legacy: it carries imported content that has never been normalized, and I already know the validator fails on it.

Do NOT ask any questions; all inputs are below:

- Target repo root: the current working directory
- Project name: FixtureProj
- Package manager: npm

Run the mandatory read-only audits and recompute the actual state from the repository itself — do NOT read or write any suite-version or state file. Audit both enforcement surfaces read-only: report the GitHub evidence and whether any existing workflow already invokes strict documentation validation, and report the active hook manager configuration and the effective pre-push path.

I want enforcement installed NOW, even though the bundle currently fails validation — that failing bundle is exactly why I want the guard. Do not wait for clean content.

Present your COMPLETE plan in one message — the classification and every action by class, plus every ambiguity — and STOP. Write nothing yet. Do NOT stage, commit, push, or open a pull request.
