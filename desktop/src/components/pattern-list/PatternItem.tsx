import React from "react";
import { EyeIconClosed } from "../../assets/icons/EyeClosedIcon";
import { EyeIcon } from "../../assets/icons/EyeIcon";
import { getPatternColor } from "../../utils/color";
import { Pattern } from "../SheetMusicViewer";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip/Tooltip";

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

      <Tooltip>
        <TooltipTrigger className="visibility-toggle" onClick={onToggle}>
          {isEnabled ? <EyeIcon /> : <EyeIconClosed />}
        </TooltipTrigger>
        <TooltipContent>
          {isEnabled ? "Hide group" : "Show group"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
