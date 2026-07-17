---
type: Decision
title: Snapshot releases with mirrored manifest versions
description: Tag GitHub releases as no-contract snapshots, mirror the tag into native plugin manifests, and drive the ritual with a release script in scripts/.
timestamp: 2026-07-11
---

# Snapshot releases with mirrored manifest versions

## Context

The library ships through three channels with deliberately separate update
lifecycles — development symlinks update on `git pull`, portable installs update via
the external `skills` CLI, and native plugins update through each harness's
marketplace (see
[Use three skill distribution channels](/decisions/skill-distribution-channels.md)).
No version field exists anywhere in the repository today: `package.json` is private
and unversioned, no plugin manifests exist yet, and no `SKILL.md` carries a version
key. The frontmatter allowlist in
[Skill authoring conventions and quality bar](/decisions/skill-authoring-conventions.md)
forecloses per-skill `version:` keys. What is wanted is the ability to mark
checkpointable states of the library as GitHub releases, without inventing a
compatibility contract no consumer reads.

## Decision

1. **GitHub release tags exist.** The library is checkpointed with semver-shaped
   tags (`vX.Y.Z`) published as GitHub releases.
2. **Tags are snapshots with no compatibility contract.** A release means "this
   state was good", nothing about compatibility. What constitutes a breaking skill
   change stays where it already lives — installer-time dependency validation per
   [Declare skill dependencies in SKILL.md](/decisions/skill-dependencies.md) — and
   is not encoded in release numbering.
3. **Native plugin manifest versions mirror the tag.** When the Codex and Claude
   marketplace manifests exist, cutting a release bumps both to the tag's value.
   One number answers "what version is installed" across the native channel.
4. **A release script in `scripts/` owns the ritual.** One command bumps the
   manifests, commits, tags, and creates the GitHub release, so manifests cannot
   drift from the tag. The script tolerates manifests that do not exist yet.

The development-symlink and portable (`npx skills`) channels are explicitly
unaffected: both keep tracking git, as the distribution-channels decision fixed.
Writing the release script is implementation work that happens after this map's
locked spec.

## Alternatives

- **Structural or strict semver** (major = removing/renaming a skill or breaking a
  `## Required skills` edge): rejected — no channel's tooling reads a compatibility
  contract from the tag, and breaking-ness is already caught at install time by
  dependency validation.
- **Per-skill versions**: rejected — violates the frontmatter allowlist, is read by
  none of the three channels' tooling, and needs bespoke bump/validation machinery.
- **Independent manifest versions** (each manifest bumps on its own cadence):
  rejected — three unrelated numbers to maintain and remember the meaning of.
- **Static placeholder manifest versions**: rejected — marketplaces may use the
  version field for update detection or display, showing users a stale number.
- **Changesets**: rejected — multi-package JS release tooling with per-change intent
  files and changelogs is heavy for a private, prose-content library whose tags
  carry no contract.
- **Fully manual `gh release` ritual**: rejected in favor of the script — manual
  bumps across two manifests invite drift from the tag.

## Consequences

- One number everywhere: the tag and both manifest versions always agree, and a
  release is a single script invocation.
- The library gains rollback/checkpoint points ("install the library as of X") for
  the native channel and for future-you reading history.
- Releases carry no compatibility signal; anyone updating must rely on installer
  dependency validation, not the version delta, to detect breakage.
- The release script must handle the current state where no manifest exists yet,
  and it is one more `scripts/` utility to write and maintain post-map.

## Amendments

<!-- Append dated entries; never rewrite the decision above.
## YYYY-MM-DD — <short title>
<what changed and why; link the driving work>
-->
