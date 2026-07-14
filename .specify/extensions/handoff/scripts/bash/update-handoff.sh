#!/usr/bin/env bash
# Handoff extension: update-handoff.sh
# Ensures specs/<feature-folder>/handoff.md exists, seeding it from
# specs/_templates/handoff.md when missing. The calling agent fills in the
# actual content afterward.
#
# Usage: update-handoff.sh [feature_folder]
#   e.g.: update-handoff.sh 001-auth-user-accounts

set -e

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

_find_project_root() {
    local dir="$1"
    while [ "$dir" != "/" ]; do
        if [ -d "$dir/.specify" ] || [ -d "$dir/.git" ]; then
            echo "$dir"
            return 0
        fi
        dir="$(dirname "$dir")"
    done
    return 1
}

REPO_ROOT=$(_find_project_root "$SCRIPT_DIR") || REPO_ROOT="$(pwd)"
cd "$REPO_ROOT"

FEATURE_FOLDER="${1:-}"

if [ -z "$FEATURE_FOLDER" ]; then
    _branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    if [ -n "$_branch" ] && [ -d "specs/$_branch" ]; then
        FEATURE_FOLDER="$_branch"
    fi
fi

if [ -z "$FEATURE_FOLDER" ]; then
    FEATURE_FOLDER=$(ls -td specs/*/ 2>/dev/null | grep -v 'specs/_templates/' | head -n1 | xargs -n1 basename 2>/dev/null || echo "")
fi

if [ -z "$FEATURE_FOLDER" ]; then
    echo "[handoff] Warning: could not determine a feature folder under specs/; skipped" >&2
    exit 0
fi

TEMPLATE="$REPO_ROOT/specs/_templates/handoff.md"
if [ ! -f "$TEMPLATE" ]; then
    echo "[handoff] Warning: template not found at specs/_templates/handoff.md; skipped" >&2
    exit 0
fi

TARGET_DIR="$REPO_ROOT/specs/$FEATURE_FOLDER"
TARGET="$TARGET_DIR/handoff.md"
mkdir -p "$TARGET_DIR"

if [ ! -f "$TARGET" ]; then
    cp "$TEMPLATE" "$TARGET"
    echo "[handoff] Seeded specs/$FEATURE_FOLDER/handoff.md from template; fill in this task's details before committing."
else
    echo "[handoff] specs/$FEATURE_FOLDER/handoff.md exists; overwrite it with this task's details before committing."
fi
