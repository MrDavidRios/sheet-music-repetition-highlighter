import { getPatternColor } from "../../utils/color";
import { Pattern } from "../SheetMusicViewer";

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
          {patterns.map((pattern) => {
            const color = getPatternColor(pattern.id);
            const isEnabled = enabledPatterns.has(pattern.id);

            return (
              <div key={pattern.id} className="pattern-item">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    onTogglePattern(pattern.id);
                  }}
                  style={{ cursor: "pointer" }}
                />

                <div
                  className="color-indicator"
                  style={{ backgroundColor: color.replace("0.3", "0.8") }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: "14px" }}>
                    {pattern.length} notes × {pattern.count}
                  </div>
                  <div
                    className="notes"
                    title={pattern.notes.map((n) => n.pitch).join(" ")}
                  >
                    {pattern.notes.map((n) => n.pitch).join(" ")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
