#!/bin/bash
set -e

INPUT=$(cat)
NAME=$(echo "$INPUT" | jq -r '.name')
CWD=$(echo "$INPUT" | jq -r '.cwd')

REPO_ROOT=$(git -C "$CWD" rev-parse --show-toplevel)
WORKTREE_PATH="$REPO_ROOT/.claude/worktrees/$NAME"
SETUP_LOG="$REPO_ROOT/.claude/worktrees/$NAME-setup.log"

step() { echo "[worktree setup] $*" | tee -a "$SETUP_LOG" >&2; }
trap 'echo "[worktree setup] FAILED at line $LINENO — see $SETUP_LOG" | tee -a "$SETUP_LOG" >&2' ERR

step "Creating worktree '$NAME'..."
git -C "$REPO_ROOT" worktree add -B "$NAME" "$WORKTREE_PATH" HEAD >> "$SETUP_LOG" 2>&1

step "Running uv sync in analyzer..."
cd "$WORKTREE_PATH/analyzer"
uv sync >> "$SETUP_LOG" 2>&1
export PATH="$WORKTREE_PATH/analyzer/.venv/bin:$PATH"

step "Downloading homr ONNX models..."
bash download_homr_models.sh >> "$SETUP_LOG" 2>&1

step "Building analyzer..."
bash build.sh >> "$SETUP_LOG" 2>&1

step "Running bun install in desktop..."
cd "$WORKTREE_PATH/desktop"
bun install >> "$SETUP_LOG" 2>&1

LOG_FILE="$WORKTREE_PATH/tauri-dev.log"
step "Starting tauri dev server (logs at tauri-dev.log)..."
export WORKTREE_NAME="$NAME"
nohup bun run tauri dev > "$LOG_FILE" 2>&1 &

step "Done."
echo "$WORKTREE_PATH"
