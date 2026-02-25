"""CLI wrapper for pattern detection with JSON output."""

import json
import os
import sys
from contextlib import redirect_stdout
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
        "musicxml_content": Path(musicxml_path).read_text(),
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

    # Convert non-musicxml files first
    valid_extensions = {'.pdf', '.jpg', '.jpeg', '.png', '.musicxml'}
    ext = Path(path).suffix.lower()
    if ext not in valid_extensions:
        print(
            f"Error: Unsupported file type '{ext}'. Supported: pdf, jpg, png, musicxml")
        sys.exit(1)

    # Redirect stdout to stderr during processing to avoid corrupting JSON output
    with redirect_stdout(sys.stderr):
        if ext == '.pdf':
            from convert import convert_pdf
            musicxml_path = convert_pdf(path)
        elif ext in {'.jpg', '.jpeg', '.png'}:
            from convert import convert
            musicxml_path = convert(path)
        elif ext == '.musicxml':
            musicxml_path = path

        try:
            result = analyze(musicxml_path, min_len)
        except Exception as e:
            print(json.dumps({"error": str(e)}), file=sys.__stdout__)
            sys.exit(1)

    # Output JSON to actual stdout
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
