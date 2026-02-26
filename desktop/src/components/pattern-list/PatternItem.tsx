import React from "react";
import { getPatternColor } from "../../utils/color";
import { playPattern, stopPlayback } from "../../utils/audio";
import { Pattern } from "../SheetMusicViewer";
import { VisibilityToggle } from "../visibility-toggle/VisibilityToggle";
import { useTimeSignature } from "../../context/TimeSignatureContext";

interface PatternItemProps {
  pattern: Pattern;
  isEnabled: boolean;
  onToggle: () => void;
  playingPatternId: number | null;
  onPlayStart?: (patternId: number) => void;
  onPlayingNotesChange?: (keys: Set<string> | null) => void;
}

export const PatternItem: React.FC<PatternItemProps> = ({
  pattern,
  isEnabled,
  onToggle,
  playingPatternId,
  onPlayStart,
  onPlayingNotesChange,
}) => {
  const { beatsPerMeasure, timeSigDenominator } = useTimeSignature();
  const color = getPatternColor(pattern.id);
  const displayNotes = pattern.notes.map((n) => n.pitch).join(" ");
  const isPlaying = playingPatternId === pattern.id;

  const handlePlayStop = () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

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

    // playPattern calls stopPlayback() synchronously first, which clears old state
    playPattern(pattern.notes, {
      patternId: pattern.id,
      beatsPerMeasure,
      timeSigDenominator,
      onNotePlay: handleNotePlay,
      onPlaybackEnd: handleEnd,
    });

    // Notify after playPattern starts (old callback already cleared)
    onPlayStart?.(pattern.id);
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
        onClick={handlePlayStop}
        title={isPlaying ? "Stop" : "Play pattern"}
        aria-label={isPlaying ? "Stop" : "Play pattern"}
      >
        {isPlaying ? "■" : "▶"}
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
