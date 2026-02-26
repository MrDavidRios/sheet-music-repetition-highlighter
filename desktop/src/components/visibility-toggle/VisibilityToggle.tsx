import React from "react";
import { EyeIconClosed } from "../../assets/icons/EyeClosedIcon";
import { EyeIcon } from "../../assets/icons/EyeIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip/Tooltip";

import "./visibility-toggle.css";

interface VisibilityToggleProps {
  isVisible: boolean;
  onToggle: () => void;
  showTooltip?: string;
  hideTooltip?: string;
}

export const VisibilityToggle: React.FC<VisibilityToggleProps> = ({
  isVisible,
  onToggle,
  showTooltip = "Show",
  hideTooltip = "Hide",
}) => {
  return (
    <Tooltip>
      <TooltipTrigger
        className="visibility-toggle icon-button"
        onClick={onToggle}
      >
        {isVisible ? <EyeIcon /> : <EyeIconClosed />}
      </TooltipTrigger>
      <TooltipContent>{isVisible ? hideTooltip : showTooltip}</TooltipContent>
    </Tooltip>
  );
};
