---
type: Convention
title: Test-profile provisioning
description: How to provision the persistent, pre-authenticated per-harness test profiles the gating skill-test runner uses.
timestamp: 2026-07-15
---

# Test-profile provisioning

Live (inference-spending) skill-test runs execute against persistent, pre-authenticated
**test profiles** — one per harness — not empty or throwaway homes. Provisioning is a
one-time, developer-run step per machine.

- Profiles live at exactly `~/.skills-test-profiles/<harness-id>/` (fixed convention, no
  env-var override); ids are `claude-code`, `codex`, `opencode`.
- Provision with `scripts/setup-test-profiles.sh`: it creates each profile, runs the
  harness's own login, **pauses for the browser OAuth**, then verifies the auth material
  landed inside the profile and the developer's real config is untouched. Idempotent
  (skips an already-authenticated harness unless `--force`); `--only <id>` scopes to one
  harness; `--probe-discovery` runs a one-call codex skill-discovery check. Portable
  across macOS (Bash 3.2) and Linux.
- Each harness is confined by env only — the developer's real files are never edited. The
  login command and auth-material marker per harness:

  | harness | login command | auth-material marker |
  |---|---|---|
  | claude-code | `claude auth login` | `<profile>/.claude.json` |
  | codex | `codex login` | `<profile>/auth.json` |
  | opencode | `opencode auth login` | `<profile>/xdg-data/opencode/auth.json` |

  Each harness's scope env — which vars are relocated into the profile, and why
  claude/codex inherit the real HOME for macOS Keychain access — is encoded in
  `scripts/setup-test-profiles.sh` (the authoritative source; do not restate it here).
- Profiles are mutable harness state, outside the runner's immutability guard; the runner
  reads them but never handles credentials itself.

## Caveats

- `codex exec` refuses to run in a non-git directory unless given `--skip-git-repo-check`
  — required because fixtures are out-of-repo tmpdirs.
- codex also reads a global, HOME-based `~/.agents/skills/` independent of `CODEX_HOME`,
  so `CODEX_HOME` alone does not fully confine codex's skill discovery.

## Rationale

Isolation is not emptiness: an empty home hid OAuth credentials (claude/codex could not
run) and failed to confine opencode. Persistent per-harness profiles give a live run
exactly one unit of pre-authenticated user-scope state while project scope stays the
out-of-repo fixture. See
[Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md) and
[Harness](/glossary/harness.md); the executable source of the paths and env is
`scripts/setup-test-profiles.sh`.
