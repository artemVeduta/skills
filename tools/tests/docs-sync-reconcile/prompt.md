This repository has an OKF v0.1 documentation bundle under `docs/`, including a `payments` subsystem. I've been working on a docs-only branch and I want the bundle reconciled before I wrap up.

Use the docs-sync skill in branch mode. The target branch to compare against is `master`. Reconcile every concept my branch affected with the current repository state.

If the bundle is already current with the branch's changes, reconcile to that state and make no changes — do not rewrite concepts that are already correct, and do not add operational log entries. Report what you found. Do not stage, commit, push, or open a pull request.
