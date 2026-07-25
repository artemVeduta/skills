# docs-setup specifications

How the mechanisms shipped by the `docs-setup` skill actually behave.

- [Install contract](/docs-setup/specs/install-contract.md) - what an install delivers into a target repo: the managed surfaces, the per-install substitutions, the `claude/` → `.claude/` rename, the audit → classify → approve → write → verify workflow, and the done criteria
- [OKF validator behaviour and invocation](/docs-setup/specs/validator.md) - the strict 0/1/2 exit contract, the YAML frontmatter oracle, the warning suite, the uniform no-exclusion walk, enforcement wiring (CI, the documented pre-push invocation, optional PR workflow), the raw-byte mirror test, and how to run the validator and its tests
