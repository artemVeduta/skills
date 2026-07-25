# docs-setup specifications

How the mechanisms shipped by the `docs-setup` skill actually behave.

- [Install contract](/docs-setup/specs/install-contract.md) - what an install delivers into a target repo: the six managed surfaces including validation enforcement, the per-install substitutions and the byte-current wildcard rule, versionless retired-surface convergence, the separation from docs-sync, the audit → classify → approve → write → verify workflow, and the done criteria
- [OKF validator behaviour and invocation](/docs-setup/specs/validator.md) - the strict 0/1/2 exit contract, the YAML frontmatter oracle, the warning suite, the uniform no-exclusion walk, enforcement wiring (this repo's CI, the managed push + pull_request workflow, the marked Husky pre-push block), the raw-byte mirror test, and how to run the validator and its tests
