# Issue #43 evidence — byte-exact enforcement

Research date: 2026-07-23  
Decision ticket: [artemVeduta/skills#43](https://github.com/artemVeduta/skills/issues/43)

## Executive finding

The two validator source/install pairs are byte-identical today:

- `skills/okf-docs-setup/assets/scripts/validate-docs.mjs` =
  `scripts/validate-docs.mjs`
- `skills/okf-docs-setup/assets/scripts/validate-docs.test.mjs` =
  `scripts/validate-docs.test.mjs`

The first pair has SHA-256
`43e6fd82c5095a6156333d5ba3eac38deb7a0b1d85c49cfd0688562ccbbcfc68`;
the second has
`d589640edf85b90702528ffc297c2c5e41b49a9253381e28d4cbbe7de4c02de0`
on both sides. The asset test suite also passes all 16 tests. This is a clean
snapshot, not an enforced invariant: the current repository test suite never
compares either canonical asset with its repository install.

The strongest fit with the repository's already-decided enforcement model is:

1. treat a mismatch in the two zero-transform validator pairs as a skill-linter
   **ERROR**;
2. unit-test that comparison with Node's built-in test runner;
3. let the existing `lint:skills:strict` CI step make the mismatch blocking;
4. keep coverage of the transformed/evolving remainder in the
   `okf-docs-setup` install case, using each entry's declared install policy
   rather than a blanket byte comparison.

That recommendation does **not** decide the ticket. In particular, the human
still needs to choose the gate's breadth and whether the pending #29 payload
split lands before or with this check.

## Sources and method

This audit used the current repository code, tests, workflow, and governing OKF
concepts as primary sources. The starting recon identified the duplicate
validator, four substitution classes, three coupled-text drifts, and this exact
mechanization question
(`research/reference-okf-docs-v2-recon.md:15,29,45,53`). The accepted #29
resolution is also material: it keeps the dual validator copy, makes the asset
copy authoritative, keeps `docs-validate` script-less, and moves the nested
helper skills out of the setup payload
([issue #29 resolution](https://github.com/artemVeduta/skills/issues/29#issuecomment-5025296486)).
That resolution is not yet reflected in the current tree, so the inventory
below reports current files and calls out the migration boundary separately.

Checks performed:

- enumerated all files under `skills/okf-docs-setup/assets/`;
- paired each with its current repository install destination;
- used byte comparisons and SHA-256 for zero-transform pairs;
- inspected diffs and normalized only the substitutions declared by the
  install contract;
- ran the asset validator tests, `npm run docs:validate`,
  `npm run lint:skills:strict`, and `npm test`.

No repository or GitHub state was mutated during the audit.

## Current contract

The contract has three distinct layers that should not be collapsed into one
meaning of “byte-exact”:

1. **Canonical payload authority.** Every file under
   `skills/okf-docs-setup/assets/` is distributed contract material. Changes to
   an asset are intentional product changes, and validator behavior changes
   must keep its test and the skill manifest synchronized
   (`docs/okf-docs-setup/conventions/byte-exact-assets.md:10-16`;
   `docs/specs/skills-platform.md:290-295`).
2. **Install transformation contract.** The manifest declares each destination
   and whether the source is copied unchanged or receives a date, package
   manager, project-name, or source-path substitution
   (`skills/okf-docs-setup/SKILL.md:33-61`). The explanatory install contract
   says exactly four substitution classes are allowed and everything else is
   copied byte-for-byte
   (`docs/okf-docs-setup/specs/install-contract.md:39-56`).
3. **Persistent dual-copy invariant.** For this repository specifically, the
   validator asset is the source of truth and `scripts/validate-docs.mjs` is an
   installed copy (`docs/okf-docs-setup/specs/validator.md:10-13,38-40`). The
   current completion instruction is only a manual empty-`diff` check
   (`skills/okf-docs-setup/SKILL.md:199-205`;
   `docs/okf-docs-setup/specs/install-contract.md:75-82`).

The docs validator itself is intentionally advisory and always exits zero
(`docs/okf-docs-setup/specs/validator.md:15-26`). Deterministic contract
assertions, by contrast, are valid pass/fail oracles
(`docs/decisions/skill-testing-architecture.md:45-52`). A byte mismatch is
therefore not a docs-conformance warning; it is a repository contract break.

## Payload-pair inventory and observed status

The current asset tree contains 19 files, all with a current repository
destination. The manifest is the authoritative destination map
(`skills/okf-docs-setup/SKILL.md:38-50`).

| Asset source | Current repository destination | Raw status | Contract interpretation |
| --- | --- | --- | --- |
| `assets/scripts/validate-docs.mjs` | `scripts/validate-docs.mjs` | identical | Persistent zero-transform dual copy; mechanically gate |
| `assets/scripts/validate-docs.test.mjs` | `scripts/validate-docs.test.mjs` | identical | Same authority and copy rule as the validator (`SKILL.md:40-41,56-58`) |
| `assets/claude/rules/docs-authoring.md` | `.claude/rules/docs-authoring.md` | identical | Zero-transform installed copy |
| `assets/claude/skills/docs-add/templates/convention.md` | `.claude/skills/docs-add/templates/convention.md` | identical | Zero-transform current installed copy |
| `assets/claude/skills/docs-add/templates/decision.md` | `.claude/skills/docs-add/templates/decision.md` | identical | Zero-transform current installed copy |
| `assets/claude/skills/docs-add/templates/glossary.md` | `.claude/skills/docs-add/templates/glossary.md` | identical | Zero-transform current installed copy |
| `assets/claude/skills/docs-add/templates/reference.md` | `.claude/skills/docs-add/templates/reference.md` | identical | Zero-transform current installed copy |
| `assets/claude/skills/docs-add/templates/specification.md` | `.claude/skills/docs-add/templates/specification.md` | identical | Zero-transform current installed copy |
| `assets/claude/skills/docs-add/templates/subsystem-index.md` | `.claude/skills/docs-add/templates/subsystem-index.md` | identical | Zero-transform current installed copy |
| `assets/claude/rules/docs-maintenance.md` | `.claude/rules/docs-maintenance.md` | differs | Normalized-identical after the declared source-path substitution; current paths are `skills/**/*`, `scripts/**/*`, and `tools/**/*` (`.claude/rules/docs-maintenance.md:1-6`) |
| `assets/claude/skills/docs-add/SKILL.md` | `.claude/skills/docs-add/SKILL.md` | differs | Normalized-identical after `pnpm docs:validate` → `npm run docs:validate` (`.claude/skills/docs-add/SKILL.md:43-52`) |
| `assets/claude/skills/docs-validate/SKILL.md` | `.claude/skills/docs-validate/SKILL.md` | differs | Normalized-identical after the same package-manager substitution (`.claude/skills/docs-validate/SKILL.md:14-23,40-47`) |
| `assets/docs/conventions/documentation.md` | `docs/conventions/documentation.md` | differs | Normalized-identical after date and package-manager substitutions |
| `assets/docs/references/okf.md` | `docs/references/okf.md` | differs | Normalized-identical after date and package-manager substitutions |
| `assets/docs/index.md` | `docs/index.md` | differs | Project-name substitution plus expected post-install bundle growth; not a persistent mirror |
| `assets/docs/log.md` | `docs/log.md` | differs | Install-date substitution plus expected append-only project history; not a persistent mirror |
| `assets/docs/conventions/index.md` | `docs/conventions/index.md` | differs | Seed index expanded with project concepts; not a persistent mirror |
| `assets/docs/glossary/index.md` | `docs/glossary/index.md` | differs | Seed index expanded with project concepts; not a persistent mirror |
| `assets/docs/references/index.md` | `docs/references/index.md` | differs | Seed index expanded with project concepts; not a persistent mirror |

Summary:

- **9 raw-identical pairs**
- **5 substitution-only pairs with no unexplained drift**
- **5 seed/evolving pairs where persistent equality is not the contract**
- **0 missing current destinations**

This is why “compare the entire asset tree with the repository” is not a sound
check. It would reject required substitutions and ordinary documentation
growth. Conversely, comparing only the canonical asset tree to itself cannot
detect accidental content edits because no second authority exists for those
files.

## Actual enforcement and drift status

### The validator has no byte drift, but CI cannot currently prove that

The local install case declares byte-equality assertions for both validator
files (`tools/tests/okf-docs-setup/case.mjs:23-32`), and a cheap test confirms
that the case contains the first assertion
(`tools/test-runner/okf-case.test.mjs:16-21`). Neither check compares the
canonical files with this repository's `scripts/` copies:

- the case assertions run only when the inference-bearing local harness case
  runs;
- the cheap test verifies case configuration, not file contents;
- `npm test` runs the repository-side validator test, but it does not run or
  compare the asset-side copy (`package.json:15`).

Thus a contributor can edit only one validator copy and still pass the current
skill linter and validator unit tests.

### Three coupled-text drifts are real, but separate from byte identity

The recon's three reported documentation drifts remain present:

1. The setup skill says a clean install emits one benign warning
   (`skills/okf-docs-setup/SKILL.md:140-144,199-202`), while the validator spec
   says illustrative links are stripped and a clean install has zero warnings
   (`docs/okf-docs-setup/specs/validator.md:24-26`). The current repository
   actually reports `OKF bundle conformant; no warnings.`
2. The setup manifest prescribes
   `node --test scripts/*.test.mjs`
   (`skills/okf-docs-setup/SKILL.md:60-61`), while this repository's installed
   script is `node --test scripts/validate-docs.test.mjs`
   (`package.json:5-6`). The validator spec claims the glob form for this repo
   (`docs/okf-docs-setup/specs/validator.md:28-33`).
3. The Phase 4 wiring snippet says `specifications/`
   (`skills/okf-docs-setup/SKILL.md:154-164`), while this repository and its
   governing docs use `specs/` (for example `AGENTS.md:18-24` and
   `docs/specs/skills-platform.md`).

A byte-pair check will not catch these because each statement can be internally
byte-stable while disagreeing semantically with another file. They need their
own cleanup and, if recurring, targeted contract assertions. Expanding a byte
checker into prose-consistency heuristics would mix unrelated responsibilities.

### Verification snapshot

- Asset validator tests: **16/16 passed**
- `npm run docs:validate`: **passed, zero warnings**
- `npm run lint:skills:strict`: **passed with one non-blocking 202-line size warning**
- `npm test`: **183/184 passed**; the unrelated existing failure is
  `scripts/manifests.test.mjs`, because
  `.agents/plugins/marketplace.json` is absent

The last result matters for wiring: a new test reached only through `npm test`
would not create a distinct red signal while that aggregate command already
has an unrelated failure.

## Mechanism options

| Option | Strengths | Costs / mismatch | Assessment |
| --- | --- | --- | --- |
| Focused Node test asserting the two byte pairs | Small, deterministic, zero dependencies; follows the repo's `node:test` precedent (`docs/specs/skills-platform.md:521-532`) | A test alone does not define whether drift is advisory or blocking; putting it only in `npm test` relies on a currently failing aggregate command | Useful implementation test, insufficient enforcement policy by itself |
| New dedicated CI job or step | Very visible failure and easy to diagnose | Duplicates existing static-check wiring; conflicts with the Decision that CI fails only on linter ERRORs unless that Decision is amended (`docs/decisions/ci-and-automation-wiring.md:28-39`) | Unnecessary if the linter owns the finding |
| Skill-linter ERROR, backed by focused unit tests | Uses the existing advisory/default and blocking/strict modes (`tools/lint-skills.mjs:275-315`); matches “deterministic contract break” semantics; existing CI already runs strict lint (`.github/workflows/ci.yml:15-18`) | Requires a small repo-level comparison seam in a linter otherwise focused on authoring structure | Best fit if the human wants PR-time blocking |
| Docs-validator check | Already runs everywhere | Wrong subject and wrong exit contract: it validates `docs/` semantics, deliberately always exits zero, and the validator asset lives outside the bundle | Reject |
| Blanket recursive diff of all 19 destinations | Simple mental model | Incorrect: substitutions and expected seed-file evolution guarantee legitimate differences | Reject |
| Declarative per-entry transform manifest + renderer/snapshot | Could verify every installed byte after applying named transforms | Creates a second executable install system beside the current agent procedure; premature before the #29/#40 payload migration settles | Defer unless full-payload PR-time proof is explicitly chosen |
| Replace the dual copy with a symlink/generated file | Removes drift by construction | Reopens the accepted #29 authority decision and changes what this repo demonstrates as an installed target | Out of scope unless the human deliberately reopens #29 |

## Recommended design

### 1. Make the narrow invariant explicit

Define exactly two persistent byte-exact pairs in one data constant:

- validator source ↔ repository install;
- validator test source ↔ repository install.

Compare raw bytes, not decoded text, normalized line endings, mtimes, or hashes.
Hashes are useful in the failure message, but direct byte comparison is the
oracle. A mismatch should report both paths, byte lengths, and hashes; it should
not overwrite either side or guess which change was intended.

Keeping the pair list as data makes the authority visible and lets the pending
payload migration update scope without spreading path literals. It also avoids
parsing the prose manifest table, which is explanatory procedure rather than an
executable schema.

### 2. Surface mismatch as a linter ERROR

Add the comparison as a focused repo-level check composed into the skill
linter, with unit tests for:

- both pairs equal;
- first pair differs;
- second pair differs;
- either side missing;
- default linter invocation still exits zero;
- `--strict` exits nonzero on the finding.

This preserves the existing two-mode contract: authors get the complete report
locally, while CI's strict invocation blocks deterministic contract breaks.
The check belongs in a small comparison module or narrowly named function, not
inside frontmatter/body parsing; that keeps byte comparison separate from
skill syntax while letting the linter aggregate the finding.

### 3. Verify the remainder at the install boundary

Do not add the other 17 current pairs to the same raw-byte invariant.
Instead, extend the `okf-docs-setup` behavioral case after the #29 payload
migration:

- assert every remaining payload destination exists;
- use `file-equals` only for zero-transform outputs;
- assert declared placeholder replacement and preservation for transformed
  outputs;
- assert the package script values exactly;
- do not compare repository-grown `index.md` or `log.md` with their seed after
  installation.

The existing case already provides the right assertion vocabulary and starts
this split (`tools/tests/okf-docs-setup/case.mjs:13-36`). Deterministic
filesystem assertions are the established behavioral oracle
(`docs/decisions/skill-testing-architecture.md:45-59`).

### 4. Never auto-repair

The check should fail with a message such as “asset contract and repository
install differ; decide which change is intentional, then update both.” A
pre-test copy or generated rewrite would hide a one-sided edit and could
silently discard an intentional change. Authority remains the asset copy
(`docs/okf-docs-setup/specs/validator.md:10-13`).

## Command and CI integration

No new CI job is required for the recommended linter design:

1. `npm run lint:skills` reports byte drift as an ERROR but preserves the
   linter's advisory exit-zero authoring mode.
2. `npm run lint:skills:strict` exits nonzero on the same finding.
3. `.github/workflows/ci.yml:15-16` already invokes strict lint on push and PR.
4. The comparison's unit tests run through the existing `tools/*.test.mjs`
   portion of `npm test` (`package.json:15`).

This keeps responsibilities distinct:

- **skill linter:** repository/skill contract findings, including byte-pair
  drift;
- **docs validator:** OKF bundle semantics only, always advisory
  (`docs/conventions/documentation.md:120-125`);
- **local harness case:** behavior of installing the full payload;
- **CI:** cheap deterministic checks, no agent inference.

There is one documentation/code mismatch to resolve if this ticket chooses a
new test-only CI gate instead: the Decision says push/PR CI runs only linter +
docs validator and goes red solely on linter ERRORs
(`docs/decisions/ci-and-automation-wiring.md:26-39`;
`docs/specs/skills-platform.md:479-488`), while the actual workflow also runs
blocking `npm test` (`.github/workflows/ci.yml:17-20`). Code is the source of
truth for current behavior, but choosing another blocking path should be
accompanied by an explicit Decision amendment rather than silently widening
the policy.

## Unresolved human preference questions

1. **Gate breadth:** should PR-time strict lint enforce only the two
   authority-bearing validator pairs, or every current zero-transform
   repository copy? The latter would also include `docs-authoring.md` and six
   nested templates, but #29 intends to remove/move several of those copies.
2. **Migration sequencing:** should #43 land against today's 19-file payload,
   or after #40 applies the accepted #29 split and leaves a stable machinery-only
   manifest?
3. **Test file scope:** is
   `validate-docs.test.mjs` explicitly part of the persistent dual-copy gate?
   The current manifest says both scripts are pure verbatim copies, so the
   evidence favors yes, but the ticket title names only the validator.
4. **Failure policy:** should byte drift be a blocking linter ERROR (recommended)
   or advisory until the coupled prose drifts and the current `npm test`
   baseline are clean?
5. **Visibility:** is strict-linter output sufficient, or is a separate
   `byte-exact:check` command desirable for discoverability despite duplicating
   a check already reached by `lint:skills:strict`?
6. **Full-payload ambition:** does the human want only persistent-copy drift
   prevention, or reproducible proof of every transformed install byte? The
   latter requires an executable transform manifest/renderer and is a larger
   design than the validator dual-copy fix.

## Decision boundary

The evidence supports a narrow, blocking, byte-level invariant for the two
validator pairs and policy-aware behavioral assertions for the rest. The
remaining choices above affect CI policy and the post-#29 payload boundary;
they require the ticket owner's explicit decision before implementation.
