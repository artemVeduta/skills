Set up an OKF (Open Knowledge Format) v0.1 documentation bundle in THIS repository using the docs-setup skill.

This is a fresh repository: there is no `docs/` bundle, no validator, and no `docs:validate` script yet. All inputs are provided below — do NOT ask any questions:

- Target repo root: the current working directory
- Project name: FixtureProj
- Package manager: npm
- Subsystems: none yet
- Existing documentation to convert: none
- GitHub Actions PR workflow: not needed

Run the mandatory read-only audits, classify the state, and present your COMPLETE plan in one message: the classification, every file you would create, and everything you would preserve. Then STOP and wait for my explicit go-ahead before changing anything.

When copying the verbatim asset files, do NOT modify `scripts/validate-docs.mjs` or `scripts/validate-docs.test.mjs` in any way — leave them byte-identical to the skill's assets. Preserve the existing `AGENTS.md` guidance and the `README.md` exactly; only splice the marked Documentation router into `AGENTS.md`.
