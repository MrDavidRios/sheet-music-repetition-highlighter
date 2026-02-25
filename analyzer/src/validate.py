"""Validate detected patterns via playback, visualization, or highlighting."""

import sys
from music21 import stream, environment

from patterns import find_repeats

# Give music21 the path to MuseScore 4
env = environment.UserSettings()
env['musicxmlPath'] = '/Applications/MuseScore 4.app/Contents/MacOS/mscore'
env['musescoreDirectPNGPath'] = '/Applications/MuseScore 4.app/Contents/MacOS/mscore'


def get_pitch_names(notes) -> str:
    """Get pitch names from notes."""
    names = []
    for n in notes:
        if hasattr(n, 'pitches'):  # chord
            names.append(n.pitches[-1].nameWithOctave)
        else:
            names.append(n.pitch.nameWithOctave)
    return ' '.join(names)


def show_pattern(repeat, index: int = 0):
    """Show pattern in notation software."""
    s = stream.Stream()
    for n in repeat.notes:
        s.append(n.__deepcopy__())
    pitches = get_pitch_names(repeat.notes)
    print(f"Showing pattern {index + 1}: {pitches}")
    s.show()


def main():
    usage = """Usage: python validate.py <musicxml_path> [options]

Options:
  --min-length N   Minimum pattern length (default: 4)
  --top N          Only process top N patterns (default: 5)
"""
    if len(sys.argv) < 2:
        print(usage)
        sys.exit(1)

    musicxml_path = sys.argv[1]

    # Parse options
    min_len = 4
    top_n = 5

    args = sys.argv[2:]
    i = 0
    while i < len(args):
        if args[i] == '--min-length':
            min_len = int(args[i + 1])
            i += 2
        elif args[i] == '--top':
            top_n = int(args[i + 1])
            i += 2
        else:
            i += 1

    print(f"Analyzing {musicxml_path}...")
    repeats = find_repeats(musicxml_path, min_len)[:top_n]
    print(f"Found {len(repeats)} patterns\n")

    for i, r in enumerate(repeats):
        show_pattern(r, i)
        input("Press Enter for next pattern...")


if __name__ == "__main__":
    main()
