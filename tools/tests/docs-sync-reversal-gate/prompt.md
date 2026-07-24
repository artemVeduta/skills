This repository has an OKF v0.1 documentation bundle under `docs/`, including a `payments` subsystem. There is a "Payment token storage" decision that records storing payment tokens in PostgreSQL, and it lists Redis as an alternative it rejected.

On this branch I switched the token store to Redis: `src/token-store.js` now selects Redis instead of Postgres. I have not touched the docs yet.

Use the docs-sync skill in branch mode. The target branch to compare against is `master`. Reconcile every concept my branch affected with the current working state of the repository, so the docs match the code I changed.

Do the reconciliation entirely in the working tree. Do not stage, commit, push, or open a pull request.
