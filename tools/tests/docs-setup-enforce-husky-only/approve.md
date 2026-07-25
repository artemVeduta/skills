Yes — apply the plan now.

Install local push enforcement only: one managed validation block on the effective pre-push path, validating the complete bundle on every push. Keep every already-current managed file a no-op.

Do NOT install a GitHub workflow: this repository has no GitHub evidence. Report it as a skip.

Constraints on the write, all of which I will check:

- Add the managed block exactly once, between its stable markers, and leave the hook manager's other hooks byte-intact.
- Do not install, initialize, or upgrade the hook manager, do not add or change a `prepare` script, and do not add any dependency — leave `package.json` byte-identical.
- Do not write or edit native `.git/hooks/*` and do not change the configured hooks path.
- Do not create any file under `.github/`.
- Do not call the GitHub API or the GitHub CLI, and do not configure branch protection, rulesets, or required checks.
- Do not stage, commit, push, add a remote, or open a pull request.

Then verify and report the two results independently, and confirm exactly which files you changed.
