# okf-docs-setup specifications

How the mechanisms shipped by the `okf-docs-setup` skill actually behave.

- [Install contract](/okf-docs-setup/specs/install-contract.md) - what an install delivers into a target repo: the four delivery groups, the per-install substitutions, the `claude/` → `.claude/` rename, the machinery-vs-content phase structure, and the done criteria
- [OKF validator behaviour and invocation](/okf-docs-setup/specs/validator.md) - advisory always-exit-0 behaviour, hard errors vs soft warnings, `excludedTopLevelDirs`, the one benign policy-link warning, and how to run the validator and its tests
