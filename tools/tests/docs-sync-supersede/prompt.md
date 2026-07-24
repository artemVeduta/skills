This repository has an OKF v0.1 documentation bundle under `docs/`, including a `payments` subsystem. There is a "Payment token storage" decision that records storing payment tokens in PostgreSQL, and it lists Redis as an alternative it rejected.

On this branch I switched the token store to Redis: `src/token-store.js` now selects Redis instead of Postgres. I have not touched the docs yet.

Use the docs-sync skill in branch mode. The target branch to compare against is `master`. Reconcile the documentation with my branch. Before you write anything, walk me through exactly what you propose to do and why, and then wait for my go-ahead — do not change any files yet.
