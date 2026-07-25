Yes — apply the plan now.

Install both enforcement surfaces: the dedicated managed GitHub workflow, and one managed validation block on the effective pre-push path. Keep every already-current managed file a no-op.

Do NOT repair the bundle content. The legacy imported concepts stay exactly as they are, byte for byte — I will migrate them in a separate docs-sync run later. Do not add or remove frontmatter, do not rename anything, and do not delete any concept to make validation pass.

Constraints on the write, all of which I will check:

- Leave the existing `ci.yml` exactly as it is, and leave every existing pre-push command byte-intact and in order.
- Add the managed block exactly once, between its stable markers.
- Do not install, initialize, or upgrade the hook manager, do not add a `prepare` script, and do not write native `.git/hooks/*` or change the configured hooks path.
- Do not call the GitHub API or the GitHub CLI, and do not configure branch protection, rulesets, or required checks.
- Do not stage, commit, push, add a remote, or open a pull request.

Then report the two results INDEPENDENTLY and unambiguously: whether the machinery and enforcement were installed successfully, and separately whether the bundle validates cleanly — including which validator exit you got, that the content errors were pre-existing rather than introduced by this run, and what happens to my pushes until the bundle is repaired.
