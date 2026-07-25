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

## 2026-07-25 — Enforcement ownership, and what the two managed surfaces actually are

Issue #65 settles enforcement, and two statements in the Decision above no longer describe
it. The first — "with recipes for husky v4 and v8/v9" — was already self-refuted by the
amendment directly above: no hook body exists anywhere in the shipped skills, scripts, or
bundle, and none is planned. **There is no hook "recipe" because the managed block *is* the
wiring.** The second — that the GitHub Actions asset "runs the same command on pull
requests" — is now factually wrong: the asset triggers on both events. The exit contract
(`0` / `1` / `2`), the hard-error floor, the warning suite, and the mirror rules are
untouched.

**Ownership splits cleanly.** `docs-setup` owns enforcement **discovery, planning,
installation, upgrade, and verification**; `docs-validate` owns **running and interpreting**
the strict command and its exit class. Neither reaches into the other's half. The mechanics
live with the skill that owns them — `skills/docs-setup/references/enforcement.md` — and
[/docs-setup/specs/install-contract.md](/docs-setup/specs/install-contract.md) states the
contract at the explanatory level.

There are exactly two managed enforcement surfaces:

- **A managed GitHub Actions workflow**, installed only on GitHub evidence (a GitHub
  remote, existing workflow structure, or an explicit request) and only when no equivalent
  strict-validation invocation is already present. It triggers on **both `push` and
  `pull_request`**, and exit `1` **or** `2` fails the job. Setup never modifies arbitrary CI
  logic and owns nothing but this one dedicated file.
- **One marked managed block on an already-active, repository-owned Husky `pre-push`
  path**, validating the **complete bundle on every push** — never a diff-scoped or
  path-filtered subset, so merges, validator changes, and errors inherited from another
  branch cannot bypass enforcement. Existing hook commands stay byte-preserved, the block is
  idempotent, and an equivalent existing invocation (including one through a repository
  wrapper script) is a no-op.

Husky detection requires an **initialized hook manager** the repository already owns; a
`dependencies`/`devDependencies` entry, a lockfile line, or a `prepare` script alone is not
evidence. With no active configuration, local enforcement is a **reported skip**.

The Decision's "Setup never installs husky" holds and widens: setup never installs,
initializes, or upgrades Husky, adds no `prepare` script, and never changes native Git
hooks, the configured hooks path, or any other Git state. Setup also never calls GitHub
APIs or the GitHub CLI and never configures branch protection, rulesets, or required
checks — remote repository governance stays outside setup and belongs to a repository
administrator.

Finally, enforcement is installed **even when the current bundle fails validation** — that
is precisely the case it exists for. Machinery success and content validation are reported
independently, and the report states plainly that pushes remain blocked until the bundle is
repaired.
