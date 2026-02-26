import { Pattern } from "../SheetMusicViewer";
import { VisibilityToggle } from "../visibility-toggle/VisibilityToggle";
import { PatternItem } from "./PatternItem";

import "./pattern-list.css";

interface Props {
  title: string;
  patterns: Pattern[];
  enabledPatterns: Set<number>;
  onTogglePattern: (patternId: number) => void;
  onToggleAllPatterns: (partIndex: number) => void;
  playingPatternId: number | null;
  onPlayStart?: (patternId: number) => void;
  onPlayingNotesChange?: (keys: Set<string> | null) => void;
}

export function PatternList({
  title,
  patterns,
  enabledPatterns,
  onTogglePattern,
  onToggleAllPatterns,
  playingPatternId,
  onPlayStart,
  onPlayingNotesChange,
}: Props) {
  const anyVisible = patterns.some((p) => enabledPatterns.has(p.id));

  return (
    <div className="pattern-list-wrapper">
      <div className="header">
        <strong>
          {title} ({patterns.length})
        </strong>

        {patterns.length > 0 && (
          <VisibilityToggle
            isVisible={anyVisible}
            onToggle={() => onToggleAllPatterns(patterns[0].partIndex)}
            showTooltip={`Show all ${title.toLowerCase()} patterns`}
            hideTooltip={`Hide all ${title.toLowerCase()} patterns`}
          />
        )}
      </div>

      {patterns.length === 0 ? (
        <div className="no-results">No patterns found.</div>
      ) : (
        <div className="pattern-list">
          {patterns.map((pattern) => (
            <PatternItem
              key={pattern.id}
              pattern={pattern}
              isEnabled={enabledPatterns.has(pattern.id)}
              onToggle={() => onTogglePattern(pattern.id)}
              playingPatternId={playingPatternId}
              onPlayStart={onPlayStart}
              onPlayingNotesChange={onPlayingNotesChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
