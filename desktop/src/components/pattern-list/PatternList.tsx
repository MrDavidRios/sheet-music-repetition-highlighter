import { Pattern } from "../SheetMusicViewer";
import { PatternItem } from "./PatternItem";

import "./pattern-list.css";

interface Props {
  title: string;
  patterns: Pattern[];
  enabledPatterns: Set<number>;
  onTogglePattern: (patternId: number) => void;
}

export function PatternList({
  title,
  patterns,
  enabledPatterns,
  onTogglePattern,
}: Props) {
  return (
    <div className="pattern-list-wrapper">
      <div className="header">
        <strong>
          {title} ({patterns.length})
        </strong>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
