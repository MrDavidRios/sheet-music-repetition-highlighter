#!/bin/bash
set -e

# Detect architecture
ARCH=$(uname -m)
OS=$(uname -s)

if [[ "$OS" == "Darwin" ]]; then
    if [[ "$ARCH" == "arm64" ]]; then
        TARGET="aarch64-apple-darwin"
    else
        TARGET="x86_64-apple-darwin"
    fi
elif [[ "$OS" == "Linux" ]]; then
    TARGET="x86_64-unknown-linux-gnu"
else
    echo "Unsupported OS: $OS"
    exit 1
fi

BINARY_NAME="analyzer-$TARGET"

echo "Building for $TARGET..."

# Build with PyInstaller
.venv/bin/pyinstaller analyzer.spec --noconfirm

# Copy to Tauri sidecar locations
mkdir -p "../desktop/src-tauri/binaries" "../desktop/src-tauri/target/debug"
cp dist/analyzer "../desktop/src-tauri/binaries/$BINARY_NAME"
cp dist/analyzer "../desktop/src-tauri/target/debug/$BINARY_NAME"

echo "Done! Binary copied to:"
echo "  - desktop/src-tauri/binaries/$BINARY_NAME"
echo "  - desktop/src-tauri/target/debug/$BINARY_NAME"
