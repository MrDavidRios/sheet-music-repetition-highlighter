import { Tooltip, TooltipTrigger, TooltipContent } from "../tooltip/Tooltip";

interface PlayButtonProps {
  isPlaying: boolean;
  onClick: () => void;
}

export const PlayButton: React.FC<PlayButtonProps> = ({
  isPlaying,
  onClick,
}) => {
  const stopTooltipContent = "Stop pattern";
  const playTooltipContent = "Play pattern";

  return (
    <Tooltip>
      <TooltipTrigger
        className="play-button icon-button"
        onClick={onClick}
        title={isPlaying ? stopTooltipContent : playTooltipContent}
        aria-label={isPlaying ? stopTooltipContent : playTooltipContent}
      >
        {isPlaying ? "■" : "▶"}
      </TooltipTrigger>
      <TooltipContent>
        {isPlaying ? stopTooltipContent : playTooltipContent}
      </TooltipContent>
    </Tooltip>
  );
};
