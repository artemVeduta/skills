Yes — apply the plan now.

Install both enforcement surfaces: the dedicated managed GitHub workflow, and one managed validation block on the effective pre-push path. Keep every already-current managed file a no-op — do not touch the validator, the bundle, the policy, the OKF reference, `AGENTS.md`, or `README.md`.

Constraints on the write, all of which I will check:

- Leave the existing `ci.yml` workflow exactly as it is; do not edit arbitrary CI logic.
- Leave every existing pre-push command byte-intact and in its current order; append your managed block, do not splice it in front of them.
- Add the managed block exactly once, between its stable markers.
- Do not install, initialize, or upgrade the hook manager, do not add a `prepare` script, and do not add any dependency.
- Do not write or edit native `.git/hooks/*` and do not change the configured hooks path.
- Do not call the GitHub API or the GitHub CLI, and do not configure branch protection, rulesets, or required checks.
- Do not stage, commit, push, add a remote, or open a pull request.

Then verify and report the two results independently, and confirm exactly which files you changed.
