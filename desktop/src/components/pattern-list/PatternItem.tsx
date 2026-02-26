import React from "react";
import { getPatternColor } from "../../utils/color";
import {
  playPattern,
  stopPlayback as stopAudioPlayback,
} from "../../utils/audio";
import { Pattern } from "../SheetMusicViewer";
import { VisibilityToggle } from "../visibility-toggle/VisibilityToggle";
import { useTimeSignature } from "../../context/TimeSignatureContext";
import { usePlayback } from "../../context/PlaybackContext";
import { PlayButton } from "./PlayButton";

interface PatternItemProps {
  pattern: Pattern;
  isEnabled: boolean;
  onToggle: () => void;
}

export const PatternItem: React.FC<PatternItemProps> = ({
  pattern,
  isEnabled,
  onToggle,
}) => {
  const { beatsPerMeasure, timeSigDenominator } = useTimeSignature();
  const {
    playingPatternId,
    tempo,
    startPlayback,
    stopPlayback,
    setPlayingBeatIndex,
  } = usePlayback();

  const color = getPatternColor(pattern.id);
  const displayNotes = pattern.notes.map((n) => n.pitch).join(" ");
  const isPlaying = playingPatternId === pattern.id;

  const handlePlayStop = () => {
    if (isPlaying) {
      stopAudioPlayback();
      stopPlayback();
      return;
    }

    const handleNotePlay = (noteIndices: number[]) => {
      // Use first index as the beat position in the pattern
      setPlayingBeatIndex(noteIndices[0] ?? null);
    };

    const handleEnd = () => {
      setPlayingBeatIndex(null);
    };

    // playPattern calls stopPlayback() synchronously first, which clears old state
    playPattern(pattern.notes, {
      patternId: pattern.id,
      tempo,
      beatsPerMeasure,
      timeSigDenominator,
      onNotePlay: handleNotePlay,
      onPlaybackEnd: handleEnd,
    });

    // Notify after playPattern starts (old callback already cleared)
    startPlayback(pattern.id);
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

      <PlayButton isPlaying={isPlaying} onClick={handlePlayStop} />
      <VisibilityToggle isVisible={isEnabled} onToggle={onToggle} />
    </div>
  );
};
