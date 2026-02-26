import { HalfMoonIcon } from "../assets/icons/HalfMoon";
import { SeaAndSunIcon } from "../assets/icons/SeaAndSun";
import { Tooltip, TooltipTrigger, TooltipContent } from "./tooltip/Tooltip";

interface ThemeToggleProps {
  darkMode: boolean;
  onClick: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  darkMode,
  onClick,
}) => {
  return (
    <Tooltip>
      <TooltipTrigger className="theme-toggle icon-button" onClick={onClick}>
        {darkMode ? <HalfMoonIcon /> : <SeaAndSunIcon />}
      </TooltipTrigger>
      <TooltipContent>
        {darkMode ? "Change to Light Mode" : "Change to Dark Mode"}
      </TooltipContent>
    </Tooltip>
  );
};
