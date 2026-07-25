---
type: Convention
title: Test-profile provisioning
description: How to provision the persistent, pre-authenticated per-harness test profiles the gating skill-test runner uses.
timestamp: 2026-07-25
---

# Test-profile provisioning

Live (inference-spending) skill-test runs execute against persistent, pre-authenticated
**test profiles** — one per harness — not empty or throwaway homes. Provisioning is a
one-time, developer-run step per machine.

- Profiles live at exactly `~/.skills-test-profiles/<harness-id>/` (fixed convention, no
  env-var override); ids are `claude-code`, `codex`, `opencode`.
- Provision with `scripts/setup-test-profiles.sh`: it creates each profile, runs the
  harness's own login, **pauses for the browser OAuth**, then verifies the profile is
  authenticated. That verdict differs per harness, deliberately: claude-code's is the
  CLI's own `auth status --json` `loggedIn` field rather than the presence of a file,
  because Keychain material can exist while the profile itself is logged out; codex's is
  the presence of its in-profile auth marker; opencode's is that marker PLUS a
  confinement proof — a before/after recursive mtime snapshot of the developer's real
  opencode config and data roots, any change downgrading the leg to BLOCKED
  (`provision_opencode` / `real_mtime_snapshot`). The real-config-unchanged proof is
  opencode-specific; `provision_claude` and `provision_codex` carry no equivalent
  check. Idempotent
  (skips an already-authenticated harness unless `--force`); `--only <id>` scopes to one
  harness; `--probe-discovery` runs a one-call codex skill-discovery check. Portable
  across macOS (Bash 3.2) and Linux.
- Each harness is confined by env only — the developer's real files are never edited. The
  login command and auth-material marker per harness — the marker being what the runner's
  preflight checks for EXISTENCE only, spending no inference to probe auth
  (`preflightHarness` in `tools/test-runner/runner.mjs`, `authMaterialPath` in
  `tools/test-runner/profiles.mjs`):

  | harness | login command | auth-material marker |
  |---|---|---|
  | claude-code | `claude auth login` | `<profile>/.claude.json` |
  | codex | `codex login` | `<profile>/auth.json` |
  | opencode | `opencode auth login` | `<profile>/xdg-data/opencode/auth.json` |

  Each harness's scope env — which vars are relocated into the profile, and why
  claude-code alone inherits the real HOME for macOS Keychain access while codex
  relocates HOME into the profile (finding #4) — is encoded in
  `scripts/setup-test-profiles.sh` (the authoritative source; do not restate it here).
- Profiles are mutable harness state, outside the runner's immutability guard; the runner
  reads them but never handles credentials itself.

## Caveats

- `codex exec` refuses to start in a non-git directory unless given
  `--skip-git-repo-check`, and both codex invocations still pass it
  (`tools/test-runner/drivers.mjs`) — but the flag is now defensive rather than
  load-bearing. Since the opencode fixture-escape fix, every fixture is `git init`-ed
  with a deterministically pinned baseline branch and a baseline commit (`gitInitFixture`
  in `tools/test-runner/fixture.mjs`), so a fixture is an out-of-repo tmpdir that IS a
  git repo: out-of-repo is not the same as non-git.
- codex also reads a global, HOME-based `~/.agents/skills/` independent of `CODEX_HOME`;
  `CODEX_HOME` + `HOME` together confine the HOME-derived `~/.agents/skills` leak
  (finding #4), with the residual out-of-scope surfaces (the system/managed config layer
  and any codex-relevant variables the developer has exported into the parent environment)
  noted in [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md).

## Rationale

Isolation is not emptiness: an empty home hid OAuth credentials (claude/codex could not
run) and failed to confine opencode. Persistent per-harness profiles give a live run
exactly one unit of pre-authenticated user-scope state while project scope stays the
out-of-repo fixture. See
[Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md) and
[Harness](/glossary/harness.md); the executable source of the paths and env is
`scripts/setup-test-profiles.sh`.
