import React from "react";
import { getPatternColor } from "../../utils/color";
import { Pattern } from "../SheetMusicViewer";
import { VisibilityToggle } from "../visibility-toggle/VisibilityToggle";

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
  const color = getPatternColor(pattern.id);
  const displayNotes = pattern.notes.map((n) => n.pitch).join(" ");

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

      <VisibilityToggle
        isVisible={isEnabled}
        onToggle={onToggle}
        showTooltip="Show pattern"
        hideTooltip="Hide pattern"
      />
    </div>
  );
};
