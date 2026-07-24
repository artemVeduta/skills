This repository has an OKF v0.1 documentation bundle under `docs/`, including a `payments` subsystem.

Add a new **Decision** concept recording that all payment writes use idempotency keys to make retries safe. File it at `docs/payments/decisions/idempotency-keys.md`.

Use the docs-add skill. First read the bundle's lifecycle policy (`docs/conventions/documentation.md`), then present the COMPLETE filing plan in ONE message:

- the concept's final frontmatter (including `type: Decision`);
- its body;
- the exact bundle path;
- the entry to add to the parent `docs/payments/decisions/index.md`; and
- the `**Creation**` lifecycle entry to append to the nearest `log.md`.

Then STOP and ask for approval. Do NOT create, modify, or delete any file yet. Do NOT stage, commit, push, or open a pull request. Wait for an explicit yes or no.
