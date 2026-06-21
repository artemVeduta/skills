#!/usr/bin/env bash
set -euo pipefail

# install.sh — symlink top-level skills from this repo into one or more
# target agent skill directories (~/.agents/skills, ~/.claude/skills,
# ~/.claude-work/skills, or a custom path).
#
# Only <repo>/<skill-dir>/SKILL.md is discovered. Nested SKILL.md files
# (e.g. inside <skill>/assets/) are children of their parent skill and
# are NOT installed standalone.
#
# Usage:
#   ./scripts/install.sh                  # interactive: pick skills, then targets
#   ./scripts/install.sh --list           # print discovered skills, exit
#   ./scripts/install.sh --all            # all skills -> all default targets
#   ./scripts/install.sh --target <path>  # all skills -> <path> (repeatable)
#   ./scripts/install.sh --help

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DEFAULT_TARGETS=(
  "$HOME/.agents/skills"
  "$HOME/.claude/skills"
  "$HOME/.claude-work/skills"
)

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --target <path>  Install all skills to <path> (repeatable). Skips menus.
  --all            All skills -> all default targets, no menus:
                       ~/.agents/skills
                       ~/.claude/skills
                       ~/.claude-work/skills
  --list           Print discovered skills and exit.
  --help           Show this help.

Default (no flags): interactive menu — pick skills, then pick targets.

Default targets:
  ~/.agents/skills
  ~/.claude/skills
  ~/.claude-work/skills
EOF
}

# ---- arg parsing --------------------------------------------------------

declare -a cli_targets=()
do_all=0
do_list=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      [[ $# -ge 2 ]] || { echo "--target requires a path" >&2; exit 2; }
      cli_targets+=("$2"); shift 2 ;;
    --all)    do_all=1;   shift ;;
    --list)   do_list=1;  shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "unknown flag: $1" >&2; usage >&2; exit 2 ;;
  esac
done

# ---- discovery (top-level skills only) ----------------------------------

# -maxdepth 2: <repo>/<skill>/SKILL.md. Excludes nested SKILL.md inside
# <skill>/assets/... — those are children of the parent skill.
declare -a skill_srcs=()
declare -a skill_names=()

while IFS= read -r -d '' skill_md; do
  src="$(dirname "$skill_md")"
  name="$(basename "$src")"
  skill_srcs+=("$src")
  skill_names+=("$name")
done < <(find "$REPO" -maxdepth 2 -name SKILL.md \
           -not -path '*/.git/*' \
           -not -path '*/node_modules/*' \
           -print0)

count="${#skill_srcs[@]}"

if [[ $count -eq 0 ]]; then
  echo "no skills found under $REPO" >&2
  exit 1
fi

print_skills() {
  local i
  for i in "${!skill_srcs[@]}"; do
    printf '  [%d] %-24s -> %s\n' "$((i+1))" "${skill_names[$i]}" "${skill_srcs[$i]}"
  done
}

print_targets() {
  local i
  for i in "${!DEFAULT_TARGETS[@]}"; do
    printf '  [%d] %s\n' "$((i+1))" "${DEFAULT_TARGETS[$i]}"
  done
  echo "  [a] all of the above"
  echo "  [c] custom path"
}

if [[ $do_list -eq 1 ]]; then
  echo "Skills found ($count):"
  print_skills
  exit 0
fi

echo "Skills found ($count):"
print_skills
echo

# ---- selection state ----------------------------------------------------

declare -a sel_skill_idx=()   # indices into skill_srcs/skill_names
declare -a targets=()

# ---- skill selection ----------------------------------------------------

if [[ ${#cli_targets[@]} -gt 0 || $do_all -eq 1 ]]; then
  # non-interactive: all skills
  for i in "${!skill_srcs[@]}"; do sel_skill_idx+=("$i"); done
else
  echo "Select skills to install:"
  print_skills
  echo "  [a] all of the above"
  echo
  read -r -p "Select (comma-separated indices / a): " reply

  case "$reply" in
    a|A)
      for i in "${!skill_srcs[@]}"; do sel_skill_idx+=("$i"); done ;;
    *)
      IFS=',' read -ra idxs <<< "$reply"
      for idx in "${idxs[@]}"; do
        idx="${idx// /}"
        if [[ "$idx" =~ ^[0-9]+$ ]] && (( idx >= 1 && idx <= count )); then
          sel_skill_idx+=("$((idx-1))")
        else
          echo "invalid skill selection: $idx" >&2; exit 2
        fi
      done ;;
  esac
fi

if [[ ${#sel_skill_idx[@]} -eq 0 ]]; then
  echo "no skills selected" >&2
  exit 1
fi

echo
echo "Selected ${#sel_skill_idx[@]} skill(s):"
for i in "${sel_skill_idx[@]}"; do
  printf '  - %s\n' "${skill_names[$i]}"
done
echo

# ---- target selection ---------------------------------------------------

if [[ ${#cli_targets[@]} -gt 0 ]]; then
  for t in "${cli_targets[@]}"; do targets+=("$t"); done
elif [[ $do_all -eq 1 ]]; then
  for t in "${DEFAULT_TARGETS[@]}"; do targets+=("$t"); done
else
  echo "Select target(s):"
  print_targets
  echo
  read -r -p "Select (comma-separated indices / a / c): " reply

  pick_custom() {
    read -r -p "Custom target path: " custom
    [[ -n "$custom" ]] || { echo "empty path"; exit 2; }
    targets+=("${custom/#\~/$HOME}")
  }

  case "$reply" in
    a|A)
      for t in "${DEFAULT_TARGETS[@]}"; do targets+=("$t"); done ;;
    c|C)
      pick_custom ;;
    *)
      IFS=',' read -ra idxs <<< "$reply"
      for idx in "${idxs[@]}"; do
        idx="${idx// /}"
        case "$idx" in
          a|A) for t in "${DEFAULT_TARGETS[@]}"; do targets+=("$t"); done ;;
          c|C) pick_custom ;;
          *)
            if [[ "$idx" =~ ^[0-9]+$ ]] && (( idx >= 1 && idx <= ${#DEFAULT_TARGETS[@]} )); then
              targets+=("${DEFAULT_TARGETS[$((idx-1))]}")
            else
              echo "invalid target selection: $idx" >&2; exit 2
            fi ;;
        esac
      done ;;
  esac
fi

if [[ ${#targets[@]} -eq 0 ]]; then
  echo "no targets selected" >&2
  exit 1
fi

# ---- install ------------------------------------------------------------

install_to() {
  local dest="$1"
  local resolved

  # Self-symlink guard: if $dest is a symlink resolving into $REPO, we'd
  # write per-skill links back into the working copy. Bail.
  if [[ -L "$dest" ]]; then
    resolved="$(readlink -f "$dest" 2>/dev/null || true)"
    case "$resolved" in
      "$REPO"|"$REPO"/*)
        echo "error: $dest is a symlink into this repo ($resolved)." >&2
        echo "remove it (rm \"$dest\") and re-run; the script will recreate it as a real dir." >&2
        return 1 ;;
    esac
  fi

  mkdir -p "$dest"

  local i src name target linked=0
  for i in "${sel_skill_idx[@]}"; do
    src="${skill_srcs[$i]}"
    name="${skill_names[$i]}"
    target="$dest/$name"

    if [[ -e "$target" && ! -L "$target" ]]; then
      rm -rf "$target"
    fi

    ln -sfn "$src" "$target"
    printf '  linked %-24s -> %s\n' "$name" "$target"
    linked=$((linked+1))
  done

  echo "  ($linked skill(s) installed to $dest)"
}

echo
echo "Installing to ${#targets[@]} target(s):"
for t in "${targets[@]}"; do
  echo
  echo "Target: $t"
  install_to "$t"
done

echo
echo "Done."
