This workspace contains three independent Node projects, each with its own `package.json`: `warn-repo/`, `error-repo/`, and `broken-repo/`.

For EACH of the three projects, use the docs-validate skill to validate that project's OKF docs bundle, then write a file named `OUTCOME.md` at that project's root (`warn-repo/OUTCOME.md`, `error-repo/OUTCOME.md`, `broken-repo/OUTCOME.md`) with exactly this shape:

- Line 1: the classification — exactly one of `RESULT: CLEAN-OR-WARNINGS`, `RESULT: HARD-ERRORS`, or `RESULT: MALFUNCTION`.
- Line 2: `EXIT: <n>` — the exit code the project's `docs:validate` script returned.
- Then the explanation: every hard error on its own line starting `ERROR: ` and every warning on its own line starting `WARNING: `, each paraphrasing the validator's report. If a class is empty, omit its lines.

Report only — do NOT edit, create, or delete anything else. No matter what the validator reports, do not touch any project's `docs/` content, `package.json`, lockfile, or `scripts/` directory, and do not create missing files or directories to "fix" a finding. The three `OUTCOME.md` files are the only writes allowed.
