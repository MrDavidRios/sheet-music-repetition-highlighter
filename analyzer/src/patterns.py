"""Find exact repeated note sequences in MusicXML files."""

from dataclasses import dataclass
from music21 import converter, chord, stream


@dataclass
class Repeat:
    length: int
    count: int
    positions: list[int]
    notes: list


@dataclass
class PartRepeats:
    """Patterns found in a single part/staff."""
    part_index: int
    part_name: str
    repeats: list[Repeat]


@dataclass
class AllPartsRepeats:
    """Patterns found in all parts of a score."""
    treble: PartRepeats | None  # First part (usually treble/right hand)
    bass: PartRepeats | None    # Second part (usually bass/left hand)


def extract_note_signature(n) -> tuple:
    """Extract (pitch_midi, duration) from note or chord."""
    if isinstance(n, chord.Chord):
        return (n.pitches[-1].midi, n.quarterLength)
    return (n.pitch.midi, n.quarterLength)


def _find_lcp_length(sig1: tuple, sig2: tuple) -> int:
    """Find longest common prefix length between two signatures."""
    lcp_len = 0
    min_len = min(len(sig1), len(sig2))
    while lcp_len < min_len and sig1[lcp_len] == sig2[lcp_len]:
        lcp_len += 1
    return lcp_len


def _extract_common_prefixes(
    patterns: dict[tuple, list[int]],
    min_length: int
) -> dict[tuple, list[int]]:
    """Extract common prefixes as separate patterns, deduplicating overlaps.

    When patterns share a common prefix >= min_length, extract the prefix
    as its own pattern and remove patterns subsumed by it.
    """
    if not patterns:
        return {}

    pattern_list = list(patterns.keys())
    n = len(pattern_list)

    # Collect all common prefixes and their positions
    prefix_positions: dict[tuple, set[int]] = {}

    for i in range(n):
        for j in range(i + 1, n):
            lcp_len = _find_lcp_length(pattern_list[i], pattern_list[j])
            if lcp_len >= min_length:
                prefix = pattern_list[i][:lcp_len]
                if prefix not in prefix_positions:
                    prefix_positions[prefix] = set()
                # Add all positions where this prefix occurs
                prefix_positions[prefix].update(patterns[pattern_list[i]])
                prefix_positions[prefix].update(patterns[pattern_list[j]])

    if not prefix_positions:
        return patterns

    # Filter prefixes: keep only maximal ones (not subsumed by longer)
    prefixes_sorted = sorted(prefix_positions.keys(), key=len, reverse=True)
    maximal_prefixes: dict[tuple, set[int]] = {}

    for prefix in prefixes_sorted:
        # Check if this prefix is a prefix of any longer maximal prefix
        is_subsumed = False
        for longer in maximal_prefixes:
            if len(longer) > len(prefix) and longer[:len(prefix)] == prefix:
                is_subsumed = True
                break
        if not is_subsumed:
            maximal_prefixes[prefix] = prefix_positions[prefix]

    # Build result: start with maximal prefixes
    result: dict[tuple, list[int]] = {
        p: sorted(pos) for p, pos in maximal_prefixes.items()
    }

    # Add original patterns not subsumed by any prefix
    for pattern, positions in patterns.items():
        # Pattern subsumed if it starts with any maximal prefix
        subsumed = any(
            len(prefix) <= len(pattern) and pattern[:len(prefix)] == prefix
            for prefix in maximal_prefixes
        )
        if not subsumed:
            result[pattern] = positions

    return result


def _find_repeats_in_part(part: stream.Part, min_length: int = 4) -> list[Repeat]:
    """Find maximal exact repeated note sequences in a single part.

    Args:
        part: music21 Part object to analyze
        min_length: Minimum pattern length in notes

    Returns:
        List of Repeat objects sorted by significance (length * count)
    """
    # Extract notes with signatures
    notes = []
    for n in part.recurse().notes:
        sig = extract_note_signature(n)
        notes.append((sig, n))

    sigs = [n[0] for n in notes]
    n_notes = len(notes)

    if n_notes == 0:
        return []

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
    # A pattern is maximal if it's not a substring of any longer repeating pattern
    patterns = sorted(pattern_groups.keys(), key=len, reverse=True)
    maximal: dict[tuple, list[int]] = {}

    def is_substring(short: tuple, long: tuple) -> bool:
        """Check if short appears anywhere in long."""
        for i in range(len(long) - len(short) + 1):
            if long[i:i + len(short)] == short:
                return True
        return False

    for pattern in patterns:
        positions = sorted(pattern_groups[pattern])
        # Check if pattern is substring of any longer pattern
        dominated = any(
            is_substring(pattern, longer)
            for longer in maximal
            if len(longer) > len(pattern)
        )
        if not dominated:
            maximal[pattern] = positions

    # Extract common prefixes to deduplicate overlapping patterns
    maximal = _extract_common_prefixes(maximal, min_length)

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


def find_repeats(
    musicxml_path: str,
    min_length: int = 4,
    part_index: int = 0,
) -> list[Repeat]:
    """Find maximal exact repeated note sequences in a single part.

    Args:
        musicxml_path: Path to MusicXML file
        min_length: Minimum pattern length in notes
        part_index: Which part to analyze (0 = first part)

    Returns:
        List of Repeat objects sorted by significance (length * count)
    """
    score = converter.parse(musicxml_path)
    if part_index >= len(score.parts):
        return []
    return _find_repeats_in_part(score.parts[part_index], min_length)


def find_repeats_all_parts(
    musicxml_path: str,
    min_length: int = 4,
) -> AllPartsRepeats:
    """Find patterns in both treble and bass clef separately.

    Args:
        musicxml_path: Path to MusicXML file
        min_length: Minimum pattern length in notes

    Returns:
        AllPartsRepeats with separate pattern arrays for treble and bass
    """
    score = converter.parse(musicxml_path)
    num_parts = len(score.parts)

    treble = None
    bass = None

    if num_parts >= 1:
        part = score.parts[0]
        part_name = part.partName or "Treble"
        repeats = _find_repeats_in_part(part, min_length)
        treble = PartRepeats(part_index=0, part_name=part_name, repeats=repeats)

    if num_parts >= 2:
        part = score.parts[1]
        part_name = part.partName or "Bass"
        repeats = _find_repeats_in_part(part, min_length)
        bass = PartRepeats(part_index=1, part_name=part_name, repeats=repeats)

    return AllPartsRepeats(treble=treble, bass=bass)


def _print_repeats(repeats: list[Repeat], limit: int = 10) -> None:
    """Print repeat patterns."""
    for r in repeats[:limit]:
        pitches = []
        for n in r.notes:
            if isinstance(n, chord.Chord):
                pitches.append(n.pitches[-1].nameWithOctave)
            else:
                pitches.append(n.pitch.nameWithOctave)
        print(f"  [{r.length} notes, {r.count}x] {' '.join(pitches)}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python patterns.py <musicxml_path> [min_length]")
        sys.exit(1)

    path = sys.argv[1]
    min_len = int(sys.argv[2]) if len(sys.argv) > 2 else 4

    result = find_repeats_all_parts(path, min_len)

    if result.treble:
        print(f"=== {result.treble.part_name} (Part {result.treble.part_index}) ===")
        print(f"Found {len(result.treble.repeats)} patterns\n")
        _print_repeats(result.treble.repeats)

    if result.bass:
        print(f"\n=== {result.bass.part_name} (Part {result.bass.part_index}) ===")
        print(f"Found {len(result.bass.repeats)} patterns\n")
        _print_repeats(result.bass.repeats)
