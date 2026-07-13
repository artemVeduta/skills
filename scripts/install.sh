#!/usr/bin/env bash
# Development-links installer entry point. All logic lives in install.mjs;
# this launcher only locates it and hands off, preserving `./scripts/install.sh`.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$here/install.mjs" "$@"
