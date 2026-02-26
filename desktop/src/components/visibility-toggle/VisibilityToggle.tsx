import React from "react";
import { EyeIconClosed } from "../../assets/icons/EyeClosedIcon";
import { EyeIcon } from "../../assets/icons/EyeIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip/Tooltip";

import "./visibility-toggle.css";

interface VisibilityToggleProps {
  isVisible: boolean;
  onToggle: () => void;
}

export const VisibilityToggle: React.FC<VisibilityToggleProps> = ({
  isVisible,
  onToggle,
}) => {
  return (
    <Tooltip>
      <TooltipTrigger
        className="visibility-toggle icon-button"
        onClick={onToggle}
      >
        {isVisible ? <EyeIcon /> : <EyeIconClosed />}
      </TooltipTrigger>
      <TooltipContent>
        {isVisible ? "Hide pattern" : "Show pattern"}
      </TooltipContent>
    </Tooltip>
  );
};
