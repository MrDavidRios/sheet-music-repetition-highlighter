import React from "react";
import { getPatternColor } from "../../utils/color";
import { playPattern } from "../../utils/audio";
import { Pattern } from "../SheetMusicViewer";
import { VisibilityToggle } from "../visibility-toggle/VisibilityToggle";
import { useTimeSignature } from "../../context/TimeSignatureContext";

interface PatternItemProps {
  pattern: Pattern;
  isEnabled: boolean;
  onToggle: () => void;
  onPlayingNotesChange?: (keys: Set<string> | null) => void;
}

export const PatternItem: React.FC<PatternItemProps> = ({
  pattern,
  isEnabled,
  onToggle,
  onPlayingNotesChange,
}) => {
  const { beatsPerMeasure, timeSigDenominator } = useTimeSignature();
  const color = getPatternColor(pattern.id);
  const displayNotes = pattern.notes.map((n) => n.pitch).join(" ");

  const handlePlay = () => {
    // Map note indices to "partIndex-noteIndex" keys for all occurrences
    const handleNotePlay = (noteIndices: number[]) => {
      if (!onPlayingNotesChange) return;
      const keys = new Set<string>();
      for (const startPos of pattern.positions) {
        for (const idx of noteIndices) {
          keys.add(`${pattern.partIndex}-${startPos + idx}`);
        }
      }
      onPlayingNotesChange(keys);
    };

    const handleEnd = () => {
      onPlayingNotesChange?.(null);
    };

    console.log("[PatternItem] pattern notes", pattern.notes);
    playPattern(pattern.notes, {
      beatsPerMeasure,
      timeSigDenominator,
      onNotePlay: handleNotePlay,
      onPlaybackEnd: handleEnd,
    });
  };

  return (
    <div className="pattern-item">
      <div
        className="color-indicator"
        style={{ backgroundColor: color.replace("0.3", "0.8") }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: "14px" }}>
          {pattern.length} notes × {pattern.count}
        </div>
        <div className="notes" title={displayNotes}>
          {displayNotes}
        </div>
      </div>

      <button
        className="play-button"
        onClick={handlePlay}
        title="Play pattern"
        aria-label="Play pattern"
      >
        ▶
      </button>

      <VisibilityToggle
        isVisible={isEnabled}
        onToggle={onToggle}
        showTooltip="Show pattern"
        hideTooltip="Hide pattern"
      />
    </div>
  );
};
