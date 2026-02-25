"""Find exact repeated note sequences in MusicXML files."""

from dataclasses import dataclass
from music21 import converter, chord


@dataclass
class Repeat:
    length: int
    count: int
    positions: list[int]
    notes: list


def extract_note_signature(n) -> tuple:
    """Extract (pitch_midi, duration) from note or chord."""
    if isinstance(n, chord.Chord):
        return (n.pitches[-1].midi, n.quarterLength)
    return (n.pitch.midi, n.quarterLength)


def find_repeats(
    musicxml_path: str,
    min_length: int = 4,
    part_index: int = 0,
) -> list[Repeat]:
    """Find maximal exact repeated note sequences.

    Finds the longest patterns that repeat, without arbitrary max length.
    Patterns are maximal - they can't be extended further while still repeating.

    Args:
        musicxml_path: Path to MusicXML file
        min_length: Minimum pattern length in notes
        part_index: Which part to analyze (0 = first part)

    Returns:
        List of Repeat objects sorted by significance (length * count)
    """
    score = converter.parse(musicxml_path)
    part = score.parts[part_index]

    # Extract notes with signatures
    notes = []
    for n in part.recurse().notes:
        sig = extract_note_signature(n)
        notes.append((sig, n))

    sigs = [n[0] for n in notes]
    n_notes = len(notes)

    # Build index: signature -> positions
    sig_positions: dict[tuple, list[int]] = {}
    for i, sig in enumerate(sigs):
        if sig in sig_positions:
            sig_positions[sig].append(i)
        else:
            sig_positions[sig] = [i]

    # For each position, find maximal match length with later positions
    # matches[i] = {j: length} where j > i and notes[i:i+length] == notes[j:j+length]
    matches: dict[int, dict[int, int]] = {}

    for i in range(n_notes):
        sig = sigs[i]
        for j in sig_positions[sig]:
            if j <= i:
                continue
            # Extend match as far as possible
            length = 1
            while (i + length < n_notes and j + length < n_notes
                   and sigs[i + length] == sigs[j + length]):
                length += 1

            if length >= min_length:
                if i not in matches:
                    matches[i] = {}
                matches[i][j] = length

    # Group matches by pattern content
    pattern_groups: dict[tuple, list[int]] = {}
    for i, match_dict in matches.items():
        for j, length in match_dict.items():
            pattern = tuple(sigs[i:i + length])
            if pattern in pattern_groups:
                if i not in pattern_groups[pattern]:
                    pattern_groups[pattern].append(i)
                if j not in pattern_groups[pattern]:
                    pattern_groups[pattern].append(j)
            else:
                pattern_groups[pattern] = [i, j]

    # Filter to maximal patterns only
    # A pattern is maximal if no superpattern contains all its occurrences
    patterns = sorted(pattern_groups.keys(), key=len, reverse=True)
    maximal: dict[tuple, list[int]] = {}

    for pattern in patterns:
        positions = sorted(pattern_groups[pattern])
        # Check if all positions are covered by a longer pattern
        dominated = False
        for longer in maximal:
            if len(longer) > len(pattern):
                longer_positions = maximal[longer]
                # Check if pattern is substring of longer at all its positions
                if all(
                    any(lp <= p < lp + len(longer) - len(pattern) + 1
                        and longer[p - lp:p - lp + len(pattern)] == pattern
                        for lp in longer_positions)
                    for p in positions
                ):
                    dominated = True
                    break
        if not dominated:
            maximal[pattern] = positions

    # Build Repeat objects
    repeats = []
    for pattern, positions in maximal.items():
        repeats.append(Repeat(
            length=len(pattern),
            count=len(positions),
            positions=sorted(positions),
            notes=[notes[positions[0] + j][1] for j in range(len(pattern))],
        ))

    # Sort by significance
    repeats.sort(key=lambda r: r.length * r.count, reverse=True)
    return repeats


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python patterns.py <musicxml_path> [min_length]")
        sys.exit(1)

    path = sys.argv[1]
    min_len = int(sys.argv[2]) if len(sys.argv) > 2 else 4

    repeats = find_repeats(path, min_len)

    print(f"Found {len(repeats)} maximal repeated patterns\n")
    for r in repeats[:15]:
        pitches = []
        for n in r.notes:
            if isinstance(n, chord.Chord):
                pitches.append(n.pitches[-1].nameWithOctave)
            else:
                pitches.append(n.pitch.nameWithOctave)
        print(f"[{r.length} notes, {r.count}x] {' '.join(pitches)}")
