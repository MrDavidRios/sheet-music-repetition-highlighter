"""CLI wrapper for pattern detection with JSON output."""

import json
import sys
from pathlib import Path

from music21 import chord

from patterns import find_repeats


def extract_note_locator(note, index: int) -> dict:
    """Extract location info from a note for UI highlighting."""
    if isinstance(note, chord.Chord):
        pitch = note.pitches[-1].nameWithOctave
    else:
        pitch = note.pitch.nameWithOctave

    return {
        "index": index,
        "measure": note.measureNumber,
        "beat": float(note.beat),
        "pitch": pitch,
    }


def analyze(musicxml_path: str, min_length: int = 4) -> dict:
    """Analyze MusicXML file and return patterns as JSON-serializable dict."""
    repeats = find_repeats(musicxml_path, min_length)

    patterns = []
    for i, r in enumerate(repeats):
        # Get note locators for first occurrence
        note_locators = [
            extract_note_locator(n, r.positions[0] + j)
            for j, n in enumerate(r.notes)
        ]

        patterns.append({
            "id": i,
            "length": r.length,
            "count": r.count,
            "positions": r.positions,
            "notes": note_locators,
        })

    return {
        "file": str(musicxml_path),
        "patterns": patterns,
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: cli.py <musicxml_path> [min_length]"}))
        sys.exit(1)

    path = sys.argv[1]
    min_len = int(sys.argv[2]) if len(sys.argv) > 2 else 4

    if not Path(path).exists():
        print(json.dumps({"error": f"File not found: {path}"}))
        sys.exit(1)

    try:
        result = analyze(path, min_len)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
