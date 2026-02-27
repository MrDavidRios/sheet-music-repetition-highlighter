#!/bin/bash
set -e

INPUT=$(cat)
NAME=$(echo "$INPUT" | jq -r '.name')
CWD=$(echo "$INPUT" | jq -r '.cwd')

REPO_ROOT=$(git -C "$CWD" rev-parse --show-toplevel)
WORKTREE_PATH="$REPO_ROOT/.claude/worktrees/$NAME"

echo "Creating worktree '$NAME' at $WORKTREE_PATH..." >&2
git -C "$REPO_ROOT" worktree add "$WORKTREE_PATH" >&2

echo "Running uv sync in analyzer..." >&2
cd "$WORKTREE_PATH/analyzer"
uv sync >&2

echo "Building analyzer..." >&2
bash build.sh >&2

echo "Running bun install in desktop..." >&2
cd "$WORKTREE_PATH/desktop"
bun install >&2

LOG_FILE="$WORKTREE_PATH/tauri-dev.log"
echo "Starting tauri dev server (logs: $LOG_FILE)..." >&2
nohup bun run tauri dev > "$LOG_FILE" 2>&1 &

echo "$WORKTREE_PATH"
