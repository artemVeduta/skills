#!/usr/bin/env bash
#
# setup-test-profiles.sh — cross-machine, human-run bootstrap for the
# three harness TEST PROFILES used by the gating skill-test runner
# (tools/test-runner/). Run this by hand on any machine before using
# `npm run test:case`; it creates the profile dirs, pauses for you to
# complete each harness's interactive OAuth/login flow, and verifies the
# result.
#
# Design source of truth (once it lands): tools/test-runner/profiles.mjs
# (profileDirFor / profileEnvFor / authMaterialPath) per
# docs/superpowers/specs/2026-07-15-test-runner-profile-isolation-design.md
# and docs/superpowers/plans/2026-07-15-test-runner-profile-isolation.md
# (Task 4). As of this writing that module does NOT exist yet in the repo —
# this script hand-mirrors the SAME per-harness mapping (profile dir names,
# env-var names, auth-material suffixes) independently in the shell case
# statements below. Nothing yet keeps the two in lockstep: once profiles.mjs
# lands, re-check this script's tables against its exports (or, better,
# replace this bootstrap with the planned tools/test-auth.mjs, which imports
# directly from profiles.mjs) so they cannot silently drift apart.
#   - Spec D1: the profile root is a FIXED convention
#     ($HOME/.skills-test-profiles/<harness-id>/) — deliberately NO env-var
#     override (YAGNI). Do not add one here either.
#   - Spec D6: profiles are mutable harness state by design (sessions,
#     tokens, caches land there) and sit OUTSIDE the repo's immutability
#     guard — this script is expected to create/update files under the
#     profile root across repeated runs.
#
# SAFETY (non-negotiable): this script only ever WRITES inside
# "$HOME/.skills-test-profiles" and mktemp dirs. It READS the developer's
# real ~/.claude.json, ~/.config/opencode and ~/.local/share/opencode only
# to snapshot/verify/seed-from them — it NEVER deletes or overwrites them.
#
# Portability: macOS default Bash 3.2 AND Linux. No associative arrays, no
# mapfile, no ${var,,}. Indexed arrays are fine (Bash 3.2 has them). Note:
# Bash 3.2 treats "${arr[@]}" on a never-populated array as an unbound
# variable under `set -u` (fixed only in bash 4.4+) — every array expansion
# below that might legitimately be empty uses the "${arr[@]:-}" form to stay
# safe on the older shell.

set -Eeuo pipefail
IFS=$'\n\t'

trap 'echo "ERROR: command failed (exit $?) at line $LINENO: $BASH_COMMAND" >&2' ERR

SCRIPT_NAME="$(basename "$0")"
CURRENT_USER="${USER:-$(id -un)}"
OS_NAME="$(uname -s)"
PROFILES_ROOT="$HOME/.skills-test-profiles"   # spec D1 — fixed, no override

FORCE=0
PROBE_DISCOVERY=0
ONLY_ID=""

# Bash-3.2-safe global array of paths to remove unconditionally on exit
# (registered immediately after each mktemp call). A linear `rm` placed only
# after the code that consumes a temp path cleans up the happy path alone —
# this trap guarantees cleanup even if some other command between the
# mktemp and that `rm` trips `set -e` + the ERR trap and aborts the script
# early.
_CLEANUP_PATHS=()

register_cleanup() {
  _CLEANUP_PATHS+=("$1")
}

cleanup_temp_paths() {
  local p
  for p in "${_CLEANUP_PATHS[@]:-}"; do
    [ -n "$p" ] && [ -e "$p" ] && rm -rf "$p" || true
  done
}

trap cleanup_temp_paths EXIT

# ---------------------------------------------------------------------------
# Usage / arg parsing
# ---------------------------------------------------------------------------

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS]

Provisions the three harness TEST PROFILES for the gating skill-test runner
under \$HOME/.skills-test-profiles/<harness-id>/ and pauses for you to
complete each harness's interactive OAuth/login flow.

Harnesses: claude-code, codex, opencode

Options:
  --only <id>        Provision only one harness (claude-code|codex|opencode).
  --force             Re-run the login flow even if the profile already has
                      auth material.
  --probe-discovery  After codex is authenticated, spend ONE live inference
                      call to verify skill discovery under the profile
                      CODEX_HOME (default OFF — it costs real inference).
  -h, --help          Show this help and exit.

Examples:
  $SCRIPT_NAME
  $SCRIPT_NAME --only codex
  $SCRIPT_NAME --force --only opencode
  $SCRIPT_NAME --probe-discovery
EOF
}

is_known_harness() {
  case "$1" in
    claude-code|codex|opencode) return 0 ;;
    *) return 1 ;;
  esac
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      -h|--help)
        usage
        exit 0
        ;;
      --only)
        if [ $# -lt 2 ]; then
          echo "error: --only requires an argument" >&2
          usage >&2
          exit 2
        fi
        ONLY_ID="$2"
        if ! is_known_harness "$ONLY_ID"; then
          echo "error: unknown harness id: $ONLY_ID (expected claude-code|codex|opencode)" >&2
          exit 2
        fi
        shift 2
        ;;
      --force)
        FORCE=1
        shift
        ;;
      --probe-discovery)
        PROBE_DISCOVERY=1
        shift
        ;;
      *)
        echo "error: unknown argument: $1" >&2
        usage >&2
        exit 2
        ;;
    esac
  done
}

# ---------------------------------------------------------------------------
# Per-harness config (case statements — no associative arrays; matches the
# exact shape of tools/test-runner/profiles.mjs profileEnvFor/authMaterialPath).
# ---------------------------------------------------------------------------

harness_profile_dir() {
  printf '%s/%s\n' "$PROFILES_ROOT" "$1"
}

harness_command() {
  case "$1" in
    claude-code) printf 'claude\n' ;;
    codex) printf 'codex\n' ;;
    opencode) printf 'opencode\n' ;;
    *) echo "harness_command: unknown harness id: $1" >&2; return 1 ;;
  esac
}

# The file whose EXISTENCE means "this profile is authenticated".
harness_auth_path() {
  local id="$1" dir="$2"
  case "$id" in
    claude-code) printf '%s/.claude.json\n' "$dir" ;;
    codex) printf '%s/auth.json\n' "$dir" ;;
    opencode) printf '%s/xdg-data/opencode/auth.json\n' "$dir" ;;
    *) echo "harness_auth_path: unknown harness id: $id" >&2; return 1 ;;
  esac
}

# Pinned default-model hints, for the summary only — never passed to login.
harness_model_hint() {
  case "$1" in
    claude-code) printf 'claude-sonnet-5\n' ;;
    codex) printf 'gpt-5.2-codex\n' ;;
    opencode) printf 'anthropic/claude-sonnet-5\n' ;;
    *) printf 'unknown\n' ;;
  esac
}

# Sets the global _ENV_ASSIGNMENTS array to "KEY=VALUE" strings (Bash 3.2 has
# no nameref/declare -n, so an out-param global is the portable way to
# "return" an array). claude-code and codex intentionally OMIT HOME — the
# real HOME must stay visible (macOS Keychain access for claude; on-disk
# CODEX_HOME relocation is enough for codex). opencode confines HOME plus all
# four XDG roots and disables autoupdate.
harness_env_assignments() {
  local id="$1" dir="$2"
  case "$id" in
    claude-code)
      _ENV_ASSIGNMENTS=("CLAUDE_CONFIG_DIR=$dir")
      ;;
    codex)
      _ENV_ASSIGNMENTS=("CODEX_HOME=$dir")
      ;;
    opencode)
      _ENV_ASSIGNMENTS=(
        "HOME=$dir"
        "XDG_CONFIG_HOME=$dir/xdg-config"
        "XDG_DATA_HOME=$dir/xdg-data"
        "XDG_CACHE_HOME=$dir/xdg-cache"
        "XDG_STATE_HOME=$dir/xdg-state"
        "OPENCODE_DISABLE_AUTOUPDATE=1"
      )
      ;;
    *)
      echo "harness_env_assignments: unknown harness id: $id" >&2
      return 1
      ;;
  esac
}

# Sets the global _LOGIN_ARGV array. Genuinely re-confirmed on this machine
# right before writing this script (not assumed, and not the same as the
# planned Task 9 LOGIN_ARGS draft, which had the claude-code entry wrong):
#   - `claude --help` lists NO top-level `login` — only `auth` (Manage
#     authentication) and `setup-token`. `claude auth --help` then shows
#     `login [options]  Sign in to your Anthropic account`, so the real
#     entry point is the NESTED `claude auth login`, not `claude login`.
#   - `codex --help` lists a top-level `login  Manage login`; bare
#     `codex login` starts the interactive flow (`codex login status` only
#     reports status), so `codex login` is correct as-is.
#   - `opencode auth --help` confirms `opencode auth login [url]  log in to
#     a provider`, so `opencode auth login` is correct as-is.
# Versions checked: claude 2.1.210, codex-cli 0.139.0, opencode 1.18.0. If a
# CLI renames its login entry point later, re-run its `--help` and update
# the case arm below — do not guess.
harness_login_argv() {
  local id="$1"
  case "$id" in
    claude-code) _LOGIN_ARGV=(auth login) ;;
    codex) _LOGIN_ARGV=(login) ;;
    opencode) _LOGIN_ARGV=(auth login) ;;
    *) echo "harness_login_argv: unknown harness id: $id" >&2; return 1 ;;
  esac
}

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

# Portable RECURSIVE mtime+path snapshot: stat -f on Darwin, stat -c on
# Linux, over every entry found under each given root — not just the root's
# own mtime, which only changes when a DIRECT child is added/removed/
# renamed and would miss an in-place rewrite of an existing nested file.
# Missing roots are reported as MISSING so a snapshot diff also catches "the
# real dir got CREATED during login", not just mtime bumps. Sorted so
# filesystem enumeration order doesn't cause spurious diffs.
real_mtime_snapshot() {
  local p
  for p in "$@"; do
    if [ -e "$p" ]; then
      if [ "$OS_NAME" = "Darwin" ]; then
        find "$p" -exec stat -f '%m %N' {} \; 2>/dev/null | sort
      else
        find "$p" -exec stat -c '%Y %n' {} \; 2>/dev/null | sort
      fi
    else
      printf 'MISSING %s\n' "$p"
    fi
  done
}

print_login_banner() {
  local id="$1" cmd="$2"
  # Build the display string explicitly instead of relying on
  # "${_LOGIN_ARGV[*]}" — the script sets IFS=$'\n\t' globally, and `[*]`
  # joins using the FIRST character of $IFS (a newline here, not a space),
  # which would splinter multi-word argv (e.g. opencode's `auth login`)
  # across lines in this operator-facing banner.
  local argv_str
  argv_str="$(printf '%s ' "${_LOGIN_ARGV[@]}")"
  argv_str="${argv_str% }"
  cat <<BANNER

----------------------------------------------------------------------
$id: starting the interactive login flow ($cmd $argv_str).

A browser window should open for OAuth / provider login. This script
will WAIT here until you finish (or cancel) that flow before it
continues to verification.
----------------------------------------------------------------------
BANNER
}

# Runs the harness's login command under ITS profile env via
# `env VAR=val ... COMMAND ARGS`. The login's own exit code is deliberately
# NOT the success verdict and must NOT abort this script (a cancelled
# browser flow, a nonzero from an already-open session, etc. are all
# recoverable) — the real verdict is the post-login auth-material check the
# caller performs afterward.
run_login() {
  local id="$1" dir="$2"
  harness_env_assignments "$id" "$dir"
  harness_login_argv "$id"
  local cmd
  cmd="$(harness_command "$id")"

  print_login_banner "$id" "$cmd"

  # `cmd || rc=$?` (not `set +e`/`set -e`) is deliberate: the ERR trap fires
  # based on a command's structural position in a &&/|| list, not on whether
  # errexit happens to be toggled off around it — a bare `set +e` still lets
  # the trap fire and print a spurious "ERROR:" line for an expected
  # cancelled/nonzero login. Putting the command directly before the final
  # `||` exempts it from both `set -e` AND the ERR trap, same as Bash grants
  # `cmd || true`.
  local rc=0
  env "${_ENV_ASSIGNMENTS[@]}" "$cmd" "${_LOGIN_ARGV[@]}" || rc=$?

  if [ "$rc" -ne 0 ]; then
    echo "$id: login command exited $rc (nonzero/cancelled) — verifying auth material anyway" >&2
  fi
}

# Parallel "arrays" (Bash 3.2 has no associative arrays / structs) recording
# the final per-harness report.
SUMMARY_ID=()
SUMMARY_AUTHED=()
SUMMARY_PATH=()
SUMMARY_OUTCOME=()
SUMMARY_MODEL=()

# Set by probe_codex_discovery only when --probe-discovery actually ran;
# stays empty otherwise so main()'s exit-code gate never fires spuriously.
PROBE_OUTCOME=""

record_result() {
  SUMMARY_ID+=("$1")
  SUMMARY_AUTHED+=("$2")
  SUMMARY_PATH+=("$3")
  SUMMARY_OUTCOME+=("$4")
  SUMMARY_MODEL+=("$5")
}

# ---------------------------------------------------------------------------
# V3 (codex): optional, one-inference-call skill-discovery probe.
# Gated behind --probe-discovery; never runs by default.
# ---------------------------------------------------------------------------

probe_codex_discovery() {
  local dir="$1"
  echo
  echo "!!! --probe-discovery: this spends ONE live inference call (codex exec) !!!"

  local probe_dir
  probe_dir="$(mktemp -d "${TMPDIR:-/tmp}/codex-skill-probe.XXXXXX")"
  register_cleanup "$probe_dir"
  mkdir -p "$probe_dir/.agents/skills/probe-skill"
  cat > "$probe_dir/.agents/skills/probe-skill/SKILL.md" <<'SKILL_EOF'
---
name: probe-skill
description: Discovery-path probe. Use when asked which skills are available.
---
When asked which skills are available, reply with exactly: PROBE-SKILL-DISCOVERED
SKILL_EOF

  local prompt="Which skills are available to you? If one is named probe-skill, follow its instruction exactly."
  local out=""
  out="$(cd "$probe_dir" && env CODEX_HOME="$dir" codex exec --sandbox workspace-write --skip-git-repo-check "$prompt" 2>&1)" || true

  if printf '%s' "$out" | grep -q 'PROBE-SKILL-DISCOVERED'; then
    echo "codex: V3 probe outcome = CWD (discovered via cwd-relative .agents/skills)"
    PROBE_OUTCOME="CWD"
    rm -rf "$probe_dir"
    return 0
  fi

  echo "codex: cwd-relative discovery MISSED — staging into the profile and retrying"
  mkdir -p "$dir/skills"
  cp -R "$probe_dir/.agents/skills/probe-skill" "$dir/skills/probe-skill"
  register_cleanup "$dir/skills/probe-skill"
  # Remove the cwd-relative source now that it is staged, so this retry is a
  # clean, isolated test of profile-staging discovery — not a re-run
  # alongside a cwd-relative copy that already missed once.
  rm -rf "$probe_dir/.agents/skills/probe-skill"

  local out2=""
  out2="$(cd "$probe_dir" && env CODEX_HOME="$dir" codex exec --sandbox workspace-write --skip-git-repo-check "$prompt" 2>&1)" || true
  rm -rf "$dir/skills/probe-skill"

  if printf '%s' "$out2" | grep -q 'PROBE-SKILL-DISCOVERED'; then
    echo "codex: V3 probe outcome = PROFILE-STAGING (only discovered after staging into <profile>/skills)"
    PROBE_OUTCOME="PROFILE-STAGING"
  else
    echo "codex: V3 probe outcome = NOT-DISCOVERED (neither cwd nor profile staging worked — escalate)" >&2
    PROBE_OUTCOME="NOT-DISCOVERED"
  fi
  rm -rf "$probe_dir"
}

# ---------------------------------------------------------------------------
# Per-harness provisioning
# ---------------------------------------------------------------------------

# V1 — claude-code. Outcome is LOGIN (profile-scoped `claude auth login`
# landed oauthAccount inside the profile) or SEED (it didn't, but the real
# install IS authed, so we copy ~/.claude.json -> profile). Either way the
# real ~/.claude.json must stay byte-identical to its pre-login snapshot,
# and on macOS the Keychain entry must still resolve.
provision_claude() {
  local id="claude-code"
  local dir auth_path model_hint
  dir="$(harness_profile_dir "$id")"
  auth_path="$(harness_auth_path "$id" "$dir")"
  model_hint="$(harness_model_hint "$id")"

  echo
  echo "=== Provisioning: $id ==="
  mkdir -p "$dir"

  # Gate the "already authenticated" fast-path skip on the SAME predicate
  # used for LOGIN-outcome detection below (existence AND oauthAccount) —
  # not existence alone. Otherwise a stale/partial profile file (exists but
  # lacks oauthAccount) would be reported "already authenticated" here and
  # then silently overwritten by the SEED branch a few lines later: a
  # confusing contradiction that also hides the fact the file wasn't valid.
  local already_authed=0
  if [ -f "$auth_path" ] && grep -q oauthAccount "$auth_path" 2>/dev/null && [ "$FORCE" -eq 0 ]; then
    already_authed=1
  fi

  # Track real-file existence regardless of content, and regardless of
  # whether we end up taking a snapshot — a fresh machine with no prior
  # `~/.claude.json` has nothing to snapshot, but if login then CREATES one
  # on the real HOME, that is still a real-file mutation that must be
  # flagged, not silently treated as an expected SEED source.
  local snapshot="" pre_existed="no" ran_login=0
  [ -f "$HOME/.claude.json" ] && pre_existed="yes"

  if [ "$already_authed" -eq 1 ]; then
    echo "$id: already authenticated — auth material at $auth_path"
  else
    if [ "$pre_existed" = "yes" ]; then
      snapshot="$(mktemp "${TMPDIR:-/tmp}/claude-json-before.XXXXXX")"
      register_cleanup "$snapshot"
      cp "$HOME/.claude.json" "$snapshot"
    fi
    run_login "$id" "$dir"
    ran_login=1
  fi

  local outcome="UNAUTHENTICATED"
  if [ -f "$auth_path" ] && grep -q oauthAccount "$auth_path" 2>/dev/null; then
    outcome="LOGIN"
  elif [ -f "$HOME/.claude.json" ] && grep -q oauthAccount "$HOME/.claude.json" 2>/dev/null; then
    # SEED: profile-scoped login didn't land the pointer, but the real
    # install IS authed (content-checked, not just present). Copy FROM the
    # real file INTO the profile only — never the reverse.
    cp "$HOME/.claude.json" "$auth_path"
    outcome="SEED"
  fi

  if [ "$ran_login" -eq 1 ]; then
    if [ "$pre_existed" = "no" ]; then
      if [ -f "$HOME/.claude.json" ]; then
        echo "$id: WARNING — real ~/.claude.json CHANGED during the login run (it did not exist before)" >&2
      else
        echo "$id: real ~/.claude.json still absent (untouched) after the login run"
      fi
    elif [ -n "$snapshot" ]; then
      if cmp -s "$HOME/.claude.json" "$snapshot"; then
        echo "$id: real ~/.claude.json untouched (byte-identical to pre-login snapshot)"
      else
        echo "$id: WARNING — real ~/.claude.json CHANGED during the login run" >&2
      fi
    fi
  fi

  if [ "$OS_NAME" = "Darwin" ]; then
    if security find-generic-password -s "Claude Code-credentials" >/dev/null 2>&1; then
      echo "$id: Keychain entry \"Claude Code-credentials\" resolves"
    else
      echo "$id: Keychain entry \"Claude Code-credentials\" NOT found" >&2
    fi
  fi

  local authed="no"
  [ -e "$auth_path" ] && authed="yes"

  echo "$id: $([ "$authed" = yes ] && echo PASS || echo FAIL) — outcome=$outcome"
  record_result "$id" "$authed" "$auth_path" "$outcome" "$model_hint"
}

# codex — simple presence check (no LOGIN/SEED split): auth.json under
# CODEX_HOME. V3 skill-discovery is a separate, opt-in probe (--probe-discovery).
provision_codex() {
  local id="codex"
  local dir auth_path model_hint
  dir="$(harness_profile_dir "$id")"
  auth_path="$(harness_auth_path "$id" "$dir")"
  model_hint="$(harness_model_hint "$id")"

  echo
  echo "=== Provisioning: $id ==="
  mkdir -p "$dir"

  if [ -e "$auth_path" ] && [ "$FORCE" -eq 0 ]; then
    echo "$id: already authenticated — auth material at $auth_path"
  else
    run_login "$id" "$dir"
  fi

  local authed="no" outcome="UNAUTHENTICATED"
  if [ -e "$auth_path" ]; then
    authed="yes"
    outcome="AUTHENTICATED"
  fi

  if [ "$PROBE_DISCOVERY" -eq 1 ]; then
    if [ "$authed" = "yes" ]; then
      probe_codex_discovery "$dir"
      outcome="$outcome, probe=$PROBE_OUTCOME"
    else
      echo "$id: skipping --probe-discovery (not authenticated)" >&2
    fi
  fi

  echo "$id: $([ "$authed" = yes ] && echo PASS || echo FAIL) — outcome=$outcome"
  record_result "$id" "$authed" "$auth_path" "$outcome" "$model_hint"
}

# V2 — opencode. A running daemon is refused up front (unsafe + invalidates
# isolation). Real ~/.config/opencode and ~/.local/share/opencode are
# snapshotted RECURSIVELY before login and MUST be unchanged after
# (CONFIRMED); if they changed, or auth landed outside the profile, that is
# BLOCKED — reported loudly, never treated as success.
provision_opencode() {
  local id="opencode"
  local dir auth_path model_hint real_config real_data
  dir="$(harness_profile_dir "$id")"
  auth_path="$(harness_auth_path "$id" "$dir")"
  model_hint="$(harness_model_hint "$id")"
  real_config="$HOME/.config/opencode"
  real_data="$HOME/.local/share/opencode"

  echo
  echo "=== Provisioning: $id ==="

  # The daemon-refusal gate is a non-negotiable safety requirement, so a
  # missing `pgrep` must fail loudly (BLOCKED) rather than silently no-op as
  # "no daemon found" — `if pgrep ...` cannot distinguish exit 127 (command
  # not found) from exit 1 (no matching process).
  if ! command -v pgrep >/dev/null 2>&1; then
    echo "$id: REFUSED — pgrep not found; cannot safely verify no opencode daemon is running" >&2
    record_result "$id" "no" "$auth_path" "BLOCKED (pgrep unavailable)" "$model_hint"
    return 0
  fi

  if pgrep -u "$CURRENT_USER" -x opencode >/dev/null 2>&1; then
    echo "$id: REFUSED — a user-owned opencode daemon is running." >&2
    echo "  A resident daemon invalidates profile isolation and is unsafe to" >&2
    echo "  provision against (it can attach to auth/run and escape the profile)." >&2
    echo "  Kill it, then re-run:" >&2
    echo "    pkill -u \"$CURRENT_USER\" -x opencode" >&2
    echo "    $SCRIPT_NAME --only opencode" >&2
    record_result "$id" "no" "$auth_path" "BLOCKED (opencode daemon running)" "$model_hint"
    return 0
  fi

  mkdir -p "$dir/xdg-config" "$dir/xdg-data" "$dir/xdg-cache" "$dir/xdg-state"

  local ran_login=0 before_snapshot=""
  if [ -e "$auth_path" ] && [ "$FORCE" -eq 0 ]; then
    echo "$id: already authenticated — auth material at $auth_path"
  else
    before_snapshot="$(mktemp "${TMPDIR:-/tmp}/opencode-mtimes-before.XXXXXX")"
    register_cleanup "$before_snapshot"
    real_mtime_snapshot "$real_config" "$real_data" > "$before_snapshot"
    run_login "$id" "$dir"
    ran_login=1
  fi

  local confinement="CONFIRMED"
  if [ "$ran_login" -eq 1 ]; then
    local after_snapshot
    after_snapshot="$(mktemp "${TMPDIR:-/tmp}/opencode-mtimes-after.XXXXXX")"
    register_cleanup "$after_snapshot"
    real_mtime_snapshot "$real_config" "$real_data" > "$after_snapshot"
    if diff -q "$before_snapshot" "$after_snapshot" >/dev/null 2>&1; then
      echo "$id: real ~/.config/opencode and ~/.local/share/opencode UNCHANGED"
    else
      confinement="BLOCKED"
      echo "$id: WARNING — real opencode config/data dirs CHANGED during login; isolation BLOCKED" >&2
    fi
    rm -f "$before_snapshot" "$after_snapshot"
  fi

  local authed="no"
  if [ "$confinement" = "CONFIRMED" ] && [ -e "$auth_path" ]; then
    authed="yes"
  fi

  local material_state="absent"
  [ -e "$auth_path" ] && material_state="present"
  echo "$id: $([ "$authed" = yes ] && echo PASS || echo FAIL) — auth-material=$material_state, confinement=$confinement"
  record_result "$id" "$authed" "$auth_path" "$confinement" "$model_hint"
}

# ---------------------------------------------------------------------------
# Summary + exit code
# ---------------------------------------------------------------------------

print_summary() {
  echo
  echo "=== Summary ==="
  local i
  for i in "${!SUMMARY_ID[@]}"; do
    printf '%s | authed=%s | %s | outcome=%s | pinned-model-hint=%s\n' \
      "${SUMMARY_ID[$i]}" "${SUMMARY_AUTHED[$i]}" "${SUMMARY_PATH[$i]}" \
      "${SUMMARY_OUTCOME[$i]}" "${SUMMARY_MODEL[$i]}"
  done
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
  parse_args "$@"

  local harnesses
  if [ -n "$ONLY_ID" ]; then
    harnesses=("$ONLY_ID")
  else
    harnesses=(claude-code codex opencode)
  fi

  echo "Profile root: $PROFILES_ROOT (fixed convention — spec D1, no env-var override)"
  echo "OS: $OS_NAME"
  [ "$PROBE_DISCOVERY" -eq 1 ] && echo "NOTE: --probe-discovery is ON — codex leg will spend one inference call."

  # NOTE: each provision_* function always returns 0 (failures are recorded
  # into the SUMMARY_* arrays, not signalled via exit status) precisely so
  # that a genuine unexpected error elsewhere still trips `set -e` + the ERR
  # trap above instead of being silently swallowed.
  local id
  for id in "${harnesses[@]}"; do
    case "$id" in
      claude-code) provision_claude ;;
      codex) provision_codex ;;
      opencode) provision_opencode ;;
    esac
  done

  print_summary

  local all_authed=1 a
  for a in "${SUMMARY_AUTHED[@]}"; do
    [ "$a" = "yes" ] || all_authed=0
  done

  # An explicitly-requested --probe-discovery that came back NOT-DISCOVERED
  # is a real failure signal (neither cwd-relative nor profile-staging skill
  # discovery worked) — fold it into the exit code so a caller gating on
  # exit status alone (e.g. CI) doesn't get a false-clean result.
  if [ "$PROBE_DISCOVERY" -eq 1 ] && [ "$PROBE_OUTCOME" = "NOT-DISCOVERED" ]; then
    echo "codex --probe-discovery came back NOT-DISCOVERED — failing overall exit status" >&2
    all_authed=0
  fi

  if [ "$all_authed" -eq 1 ]; then
    exit 0
  else
    exit 1
  fi
}

main "$@"
