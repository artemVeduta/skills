Yes — apply the plan now.

The differing `scripts/validate-docs.mjs` is not a customization I want to keep: replace it with the canonical validator from the docs-setup machinery so it is byte-identical to the asset. Leave every already-current file (the validator test, the bundle, the policy, the OKF reference) as a no-op, keep the existing `AGENTS.md` house rules and the `README.md` exactly, and keep the marked Documentation router idempotent. Do not stage, commit, push, or open a pull request.
