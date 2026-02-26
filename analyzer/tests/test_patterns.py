"""Tests for pattern detection and deduplication."""

import pytest
from pathlib import Path

from src.patterns import (
    _find_lcp_length,
    _extract_common_prefixes,
    find_repeats_all_parts,
    extract_note_signature,
)
from music21 import chord


# Path to test file
FUR_ELISE_PATH = Path(__file__).parent.parent / "test-images/Fur Elise (pdf)_pdf/musicxml/merged.musicxml"


class TestFindLcpLength:
    """Tests for _find_lcp_length helper."""

    def test_identical_tuples(self):
        sig = ((60, 1.0), (62, 1.0), (64, 1.0))
        assert _find_lcp_length(sig, sig) == 3

    def test_no_common_prefix(self):
        sig1 = ((60, 1.0), (62, 1.0))
        sig2 = ((65, 1.0), (67, 1.0))
        assert _find_lcp_length(sig1, sig2) == 0

    def test_partial_prefix(self):
        sig1 = ((60, 1.0), (62, 1.0), (64, 1.0))
        sig2 = ((60, 1.0), (62, 1.0), (65, 1.0))
        assert _find_lcp_length(sig1, sig2) == 2

    def test_one_is_prefix_of_other(self):
        sig1 = ((60, 1.0), (62, 1.0))
        sig2 = ((60, 1.0), (62, 1.0), (64, 1.0), (65, 1.0))
        assert _find_lcp_length(sig1, sig2) == 2

    def test_empty_tuples(self):
        assert _find_lcp_length((), ()) == 0
        assert _find_lcp_length(((60, 1.0),), ()) == 0


class TestExtractCommonPrefixes:
    """Tests for _extract_common_prefixes function."""

    def test_empty_patterns(self):
        result = _extract_common_prefixes({}, min_length=4)
        assert result == {}

    def test_no_common_prefixes(self):
        # Two completely different patterns
        patterns = {
            ((60, 1.0), (62, 1.0), (64, 1.0), (65, 1.0)): [0, 10],
            ((70, 1.0), (72, 1.0), (74, 1.0), (75, 1.0)): [5, 15],
        }
        result = _extract_common_prefixes(patterns, min_length=4)
        # No common prefix, so patterns unchanged
        assert len(result) == 2

    def test_extracts_common_prefix(self):
        # Two patterns sharing a 4-note prefix
        prefix = ((60, 1.0), (62, 1.0), (64, 1.0), (65, 1.0))
        pattern1 = prefix + ((67, 1.0), (69, 1.0))
        pattern2 = prefix + ((70, 1.0), (72, 1.0))

        patterns = {
            pattern1: [0, 20],
            pattern2: [10, 30],
        }
        result = _extract_common_prefixes(patterns, min_length=4)

        # Should have extracted the common prefix
        assert prefix in result
        # Positions from both patterns should be merged
        assert set(result[prefix]) == {0, 10, 20, 30}

    def test_removes_subsumed_patterns(self):
        # Pattern that shares prefix with another
        prefix = ((60, 1.0), (62, 1.0), (64, 1.0), (65, 1.0))
        pattern1 = prefix + ((67, 1.0),)
        pattern2 = prefix + ((70, 1.0), (72, 1.0))

        patterns = {
            pattern1: [0, 20],
            pattern2: [10, 30],
        }
        result = _extract_common_prefixes(patterns, min_length=4)

        # Original patterns should be removed (subsumed by prefix)
        assert pattern1 not in result
        assert pattern2 not in result
        # Prefix should be present
        assert prefix in result

    def test_min_length_respected(self):
        # 3-note common prefix, but min_length=4
        prefix = ((60, 1.0), (62, 1.0), (64, 1.0))
        pattern1 = prefix + ((67, 1.0), (69, 1.0))
        pattern2 = prefix + ((70, 1.0), (72, 1.0))

        patterns = {
            pattern1: [0, 20],
            pattern2: [10, 30],
        }
        result = _extract_common_prefixes(patterns, min_length=4)

        # Prefix too short, patterns should remain unchanged
        assert pattern1 in result
        assert pattern2 in result
        assert prefix not in result


class TestFurElisePatterns:
    """Integration tests using Für Elise merged.musicxml."""

    @pytest.fixture
    def fur_elise_result(self):
        """Load patterns from Für Elise."""
        if not FUR_ELISE_PATH.exists():
            pytest.skip(f"Test file not found: {FUR_ELISE_PATH}")
        return find_repeats_all_parts(str(FUR_ELISE_PATH), min_length=4)

    def test_finds_treble_patterns(self, fur_elise_result):
        """Should find patterns in treble part."""
        assert fur_elise_result.treble is not None
        assert len(fur_elise_result.treble.repeats) > 0

    def test_finds_bass_patterns(self, fur_elise_result):
        """Should find patterns in bass part."""
        assert fur_elise_result.bass is not None
        assert len(fur_elise_result.bass.repeats) > 0

    def test_main_motif_detected(self, fur_elise_result):
        """The iconic E5-D#5-E5-B4-D5-C5-A4 motif should be detected."""
        treble = fur_elise_result.treble.repeats

        # Find pattern starting with E5-D#5-E5
        motif_pattern = None
        for r in treble:
            pitches = self._get_pitch_names(r.notes[:7])
            if pitches[:3] == ["E5", "D#5", "E5"]:
                motif_pattern = r
                break

        assert motif_pattern is not None, "Main Für Elise motif not found"
        # Should have the full opening: E5-D#5-E5-B4-D5-C5-A4
        pitches = self._get_pitch_names(motif_pattern.notes[:7])
        assert pitches == ["E5", "D#5", "E5", "B4", "D5", "C5", "A4"]

    def test_bass_arpeggio_detected(self, fur_elise_result):
        """Bass A-E-A arpeggio pattern should be detected."""
        bass = fur_elise_result.bass.repeats

        # Find pattern starting with A2-E3-A3
        arpeggio = None
        for r in bass:
            pitches = self._get_pitch_names(r.notes[:3])
            if pitches == ["A2", "E3", "A3"]:
                arpeggio = r
                break

        assert arpeggio is not None, "Bass arpeggio pattern not found"
        assert arpeggio.count >= 2, "Arpeggio should repeat at least twice"

    def test_patterns_have_valid_positions(self, fur_elise_result):
        """All patterns should have valid position data."""
        for r in fur_elise_result.treble.repeats:
            assert len(r.positions) == r.count
            assert all(p >= 0 for p in r.positions)
            assert r.positions == sorted(r.positions)

        for r in fur_elise_result.bass.repeats:
            assert len(r.positions) == r.count
            assert all(p >= 0 for p in r.positions)
            assert r.positions == sorted(r.positions)

    def test_no_duplicate_patterns(self, fur_elise_result):
        """No two patterns should have identical note signatures."""
        treble = fur_elise_result.treble.repeats

        seen_sigs = set()
        for r in treble:
            sig = tuple(extract_note_signature(n) for n in r.notes)
            assert sig not in seen_sigs, f"Duplicate pattern found: {sig[:4]}..."
            seen_sigs.add(sig)

    def test_deduplication_reduces_overlap(self, fur_elise_result):
        """Patterns with common prefixes should be deduplicated.

        After deduplication, we should not have patterns where one is
        a prefix of another.
        """
        treble = fur_elise_result.treble.repeats

        sigs = [tuple(extract_note_signature(n) for n in r.notes) for r in treble]

        for i, sig_i in enumerate(sigs):
            for j, sig_j in enumerate(sigs):
                if i >= j:
                    continue
                # Neither should be a prefix of the other
                min_len = min(len(sig_i), len(sig_j))
                if min_len >= 4:  # Only check if both meet min_length
                    prefix_match = sig_i[:min_len] == sig_j[:min_len]
                    if prefix_match and len(sig_i) != len(sig_j):
                        pytest.fail(
                            f"Pattern {i} ({len(sig_i)} notes) is prefix of "
                            f"pattern {j} ({len(sig_j)} notes)"
                        )

    def _get_pitch_names(self, notes) -> list[str]:
        """Extract pitch names from notes."""
        pitches = []
        for n in notes:
            if isinstance(n, chord.Chord):
                pitches.append(n.pitches[-1].nameWithOctave)
            else:
                pitches.append(n.pitch.nameWithOctave)
        return pitches
