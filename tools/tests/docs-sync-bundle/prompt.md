This repository has an OKF v0.1 documentation bundle under `docs/`, including a `payments` subsystem. The docs have not been reconciled in a long time and have drifted against the code: some concepts are stale, some source has no concept at all, and the bookkeeping is out of date.

Use the docs-sync skill in bundle-wide reconciliation mode. Audit the complete bundle against the current source and repair everything that no longer matches — do not limit yourself to any one branch's changes.

Do the whole reconciliation in the working tree. Do not stage, commit, push, or open a pull request.
