---
type: Decision
title: Enforce minimal OKF errors through one strict validator contract
description: Give docs:validate stable 0/1/2 exits, limit blocking errors to the OKF conformance floor, and carry enforcement through portable shell wiring.
timestamp: 2026-07-25
---

# Enforce minimal OKF errors through one strict validator contract

## Context

The v1 validator reports hard errors but always exits successfully, so CI and Git hooks
cannot distinguish an invalid bundle from warnings. Making every house convention
blocking would conflict with OKF's deliberately small conformance floor and make
portable enforcement noisy. Maintaining two persistent validator copies also creates a
raw-byte drift risk.

## Decision

`docs:validate` is the only entry point and accepts no strictness flag. Its process exits
are:

- `0` for clean or warnings-only results;
- `1` when the bundle contains one or more hard errors;
- `2` when the validator itself malfunctions, including an unreadable or missing docs
  root.

Hard errors are limited to the OKF v0.1 conformance pair: unparseable concept
frontmatter and missing or empty `type`. All other findings are non-blocking warnings.

The v2 warning suite retains structural checks and adds only contradictions provable
from a zero-config snapshot:

- missing recommended `title`, `description`, or `timestamp`;
- malformed timestamps;
- `status: superseded` without `superseded_by`;
- broken internal links and malformed reserved-file structure;
- a missing local `index.md`, or concepts not linked by exact bundle-relative path from
  that local index, aggregated once per directory;
- a valid frontmatter timestamp older than the newest exact dated heading under
  `# Amendments`.

The validator does not infer duplicate identities from basenames, compare index blurbs,
require log entries, recognize debt markers, weigh amendments, compare code values,
deduplicate reports, enforce retention, inspect non-Markdown sidecars, or accept
per-project suppressions and exclusions.

Portable enforcement is a documented `pre-push` command running plain
`npm run docs:validate`, with recipes for husky v4 and v8/v9. Setup never installs
husky. An optional minimal GitHub Actions asset runs the same command on pull requests.
Bitbucket Server/Data Center uses the client pre-push recipe unless administrators add
server-side enforcement.

The canonical validator and test assets remain authoritative over the two repository
copies. A focused repository-only Node test, reached through `npm test`, compares the
two persistent mirror pairs as raw buffers. It fails on missing files or any byte
difference, names both paths and the authoritative asset, and never repairs
automatically. Transformed setup payloads remain covered by fresh-install behavior
tests.

## Alternatives

- **Keep the validator advisory.** Rejected because hard errors cannot protect pull
  requests or pushes.
- **Add `--strict`.** Rejected because ordinary local and automated runs would exercise
  different contracts.
- **Make house warnings blocking.** Rejected because index, link, timestamp, and
  lifecycle guidance is intentionally recoverable and broader than OKF conformance.
- **Install hooks automatically.** Rejected because repository package managers, husky
  generations, and enterprise enforcement differ.
- **Normalize or hash mirrored files.** Rejected because the contract is exact bytes and
  hashes would add another expected value to update.

## Consequences

- Existing advisory prose, tests, CI expectations, and both validator copies change in
  one implementation slice.
- Warnings remain visible and non-blocking without a suppression language.
- Repository CI becomes validation-gating automatically when it runs the revised
  command.
- A malfunction is distinguishable from an invalid bundle, so setup and sync can report
  the correct failure class.

# Amendments

<!-- Append dated entries; never rewrite accepted history. -->

## 2026-07-25 — The husky recipes were never written

The Decision above states that portable enforcement carries "recipes for husky v4 and
v8/v9". No such recipe ships. `skills/docs-validate/SKILL.md` ("Enforcement wiring")
names the portable hook — `pre-push` running the package-manager-neutral `docs:validate`
script — and assigns the wiring itself to docs-setup's managed surface; it supplies no
hook body, and no other skill mentions husky except `skills/docs-setup/SKILL.md`, which
forbids installing it.

What the decision actually settled is unchanged and still holds: enforcement is the plain
script behind a documented `pre-push` name, setup installs no hook, no husky dependency,
and no `prepare` script, and the optional GitHub Actions asset runs the same command on
pull requests. Only the claim that concrete recipes are already documented was wrong. The
recipes remain unwritten work, not a reversal;
[/docs-setup/specs/validator.md](/docs-setup/specs/validator.md) and
[/docs-setup/specs/install-contract.md](/docs-setup/specs/install-contract.md) carry the
shipped position.
