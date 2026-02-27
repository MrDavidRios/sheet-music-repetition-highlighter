# Analyzer

Detects repeated note patterns in MusicXML files.

## Build standalone binary

```bash
# Install deps (if not already)
uv sync
uv add pyinstaller

# Build and copy to Tauri
./build.sh
```

The script auto-detects your architecture and copies to the right Tauri sidecar location.

## Usage

```bash
./dist/analyzer <musicxml_path> [min_length]
```

Outputs JSON with detected patterns.
