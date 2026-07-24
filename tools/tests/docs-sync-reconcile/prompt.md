This repository has an OKF v0.1 documentation bundle under `docs/`, including a `payments` subsystem. On this branch I raised the payment gateway's retry limit in the source code, but I have not touched the docs yet, so the bundle is now stale.

Use the docs-sync skill in branch mode. The target branch to compare against is `master`. Reconcile every concept my branch affected with the current working state of the repository, so the docs match the code I changed.

Do the reconciliation entirely in the working tree. Do not stage, commit, push, or open a pull request.
