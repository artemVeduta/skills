Set up an OKF (Open Knowledge Format) v0.1 documentation bundle in THIS repository using the okf-docs-setup skill.

All inputs are provided below — do NOT ask any questions and do NOT stop for approval. Proceed directly with the full installation:

- Target repo root: the current working directory
- Project name: FixtureProj
- Package manager: npm
- Source edit path glob: src/**
- Subsystems: none yet
- Where existing docs live: none

Install the complete machinery now: copy the verbatim asset files, apply the placeholder substitutions (project name, date, source-edit glob), and add the two package.json scripts. There are no subsystems and no existing documentation to convert, so there is nothing to fan out — perform only the mechanical installation, then stop.

Copy the verbatim asset files exactly as shipped: do NOT modify `scripts/validate-docs.mjs` or `scripts/validate-docs.test.mjs` in any way — leave them byte-identical to the skill's assets even though the installed docs-authoring rule mentions editing `excludedTopLevelDirs`. After copying and substituting you MAY run the docs validator once to confirm zero hard ERRORS, but do NOT chase or fix warnings and do NOT edit any installed file. Do NOT wire anything into CLAUDE.md or AGENTS.md — skip the project-memory step entirely.
