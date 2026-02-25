"""CLI wrapper for pattern detection with JSON output."""

import json
import sys
from pathlib import Path

from music21 import chord

from patterns import find_repeats_all_parts, Repeat


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


def _repeats_to_patterns(
    repeats: list[Repeat], part_index: int, id_offset: int = 0
) -> list[dict]:
    """Convert Repeat objects to JSON-serializable pattern dicts."""
    patterns = []
    for i, r in enumerate(repeats):
        note_locators = [
            extract_note_locator(n, r.positions[0] + j)
            for j, n in enumerate(r.notes)
        ]
        patterns.append({
            "id": id_offset + i,
            "partIndex": part_index,
            "length": r.length,
            "count": r.count,
            "positions": r.positions,
            "notes": note_locators,
        })
    return patterns


def analyze(musicxml_path: str, min_length: int = 4) -> dict:
    """Analyze MusicXML file and return patterns as JSON-serializable dict."""
    result = find_repeats_all_parts(musicxml_path, min_length)

    treble_patterns = []
    bass_patterns = []

    if result.treble:
        treble_patterns = _repeats_to_patterns(
            result.treble.repeats, part_index=0, id_offset=0)

    if result.bass:
        # Offset bass pattern IDs to avoid collision with treble
        bass_id_offset = len(treble_patterns)
        bass_patterns = _repeats_to_patterns(
            result.bass.repeats, part_index=1, id_offset=bass_id_offset)

    return {
        "file": str(musicxml_path),
        "treble": {
            "part_index": 0,
            "part_name": result.treble.part_name if result.treble else "Treble",
            "patterns": treble_patterns,
        },
        "bass": {
            "part_index": 1,
            "part_name": result.bass.part_name if result.bass else "Bass",
            "patterns": bass_patterns,
        },
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps(
            {"error": "Usage: cli.py <musicxml_path> [min_length]"}))
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
