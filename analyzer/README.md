# Analyzer

Detects repeated note patterns in MusicXML files.

## Build standalone binary

```bash
# Install deps (if not already)
uv sync
uv pip install pyinstaller

# Build
.venv/bin/pyinstaller analyzer.spec

# Copy to Tauri (macOS ARM)
cp dist/analyzer ../desktop/src-tauri/analyzer-aarch64-apple-darwin
cp dist/analyzer ../desktop/src-tauri/target/debug/analyzer-aarch64-apple-darwin
```

For other architectures, rename binary with appropriate target triple:
- `analyzer-x86_64-apple-darwin` (macOS Intel)
- `analyzer-x86_64-pc-windows-msvc.exe` (Windows)
- `analyzer-x86_64-unknown-linux-gnu` (Linux)

## Usage

```bash
./dist/analyzer <musicxml_path> [min_length]
```

Outputs JSON with detected patterns.
