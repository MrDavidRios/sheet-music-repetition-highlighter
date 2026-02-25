import { useEffect, useRef, useState, useCallback } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";

export interface NoteLocator {
  index: number;
  measure: number;
  beat: number;
  pitch: string;
}

export interface Pattern {
  id: number;
  length: number;
  count: number;
  positions: number[];
  notes: NoteLocator[];
}

interface Props {
  musicXml: string | null;
  patterns: Pattern[];
  highlightedPatternId: number | null;
  patternColors: Map<number, string>;
}

const COLORS = [
  "rgba(255, 107, 107, 0.3)",
  "rgba(78, 205, 196, 0.3)",
  "rgba(255, 230, 109, 0.3)",
  "rgba(170, 128, 255, 0.3)",
  "rgba(255, 166, 158, 0.3)",
  "rgba(128, 222, 234, 0.3)",
  "rgba(255, 183, 77, 0.3)",
  "rgba(149, 175, 192, 0.3)",
];

export function getPatternColor(patternId: number): string {
  return COLORS[patternId % COLORS.length];
}

export function SheetMusicViewer({
  musicXml,
  patterns,
  highlightedPatternId,
  patternColors,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize OpenSheetMusicDisplay when musicXml changes
  useEffect(() => {
    if (!containerRef.current || !musicXml) return;

    const osmd = new OpenSheetMusicDisplay(containerRef.current, {
      autoResize: true,
      drawTitle: true,
      drawComposer: true,
      autoBeam: true,
    });

    osmdRef.current = osmd;

    osmd
      .load(musicXml)
      .then(() => {
        osmd.render();
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load MusicXML:", err);
        setIsLoaded(false);
      });

    return () => {
      osmdRef.current = null;
      setIsLoaded(false);
    };
  }, [musicXml]);

  // Draw highlighting rectangles
  const drawHighlights = useCallback(() => {
    if (!isLoaded || !osmdRef.current || !containerRef.current) return;

    const container = containerRef.current;

    // Remove existing highlights
    const existingHighlights = container.querySelectorAll(".pattern-highlight");
    existingHighlights.forEach((el) => el.remove());

    const osmd = osmdRef.current;
    const graphic = osmd.GraphicSheet;
    if (!graphic) return;

    // Get all vertical containers (each represents a beat position)
    const containers = graphic.VerticalGraphicalStaffEntryContainers;

    // Filter patterns to highlight
    const patternsToHighlight =
      highlightedPatternId !== null
        ? patterns.filter((p) => p.id === highlightedPatternId)
        : patterns;

    // Find the SVG element
    const svgElement = container.querySelector("svg");
    if (!svgElement) return;

    const svgRect = svgElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    for (const pattern of patternsToHighlight) {
      const color =
        patternColors.get(pattern.id) || getPatternColor(pattern.id);

      // For each occurrence of this pattern
      for (const startPos of pattern.positions) {
        const endPos = startPos + pattern.length - 1;

        // Get bounding boxes for start and end positions
        if (startPos >= containers.length || endPos >= containers.length)
          continue;

        const startContainer = containers[startPos];
        const endContainer = containers[endPos];

        if (!startContainer || !endContainer) continue;

        // Get staff entries from containers
        const startEntries = startContainer.StaffEntries;
        const endEntries = endContainer.StaffEntries;

        if (!startEntries?.length || !endEntries?.length) continue;

        // Get bounding boxes
        const startEntry = startEntries[0];
        const endEntry = endEntries[0];

        if (!startEntry?.PositionAndShape || !endEntry?.PositionAndShape)
          continue;

        const startBox = startEntry.PositionAndShape;
        const endBox = endEntry.PositionAndShape;

        // Convert OSMD coordinates to screen coordinates
        // OSMD uses a unit system where 10 units = 1 staff line space
        const unitToPixel =
          svgRect.width / (svgElement.viewBox?.baseVal?.width || svgRect.width);

        const startX = startBox.AbsolutePosition.x * unitToPixel * 10;
        const endX =
          (endBox.AbsolutePosition.x + endBox.Size.width) * unitToPixel * 10;
        const y = startBox.AbsolutePosition.y * unitToPixel * 10;
        const height = startBox.Size.height * unitToPixel * 10;

        // Create highlight element
        const highlight = document.createElement("div");
        highlight.className = "pattern-highlight";
        highlight.style.cssText = `
          position: absolute;
          left: ${svgRect.left - containerRect.left + startX - 5}px;
          top: ${svgRect.top - containerRect.top + y - 5}px;
          width: ${endX - startX + 10}px;
          height: ${Math.max(height + 10, 40)}px;
          background-color: ${color};
          border-radius: 4px;
          pointer-events: none;
          z-index: 1;
        `;

        container.appendChild(highlight);
      }
    }
  }, [isLoaded, patterns, highlightedPatternId, patternColors]);

  useEffect(() => {
    drawHighlights();
  }, [drawHighlights]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "auto",
        backgroundColor: "white",
      }}
    >
      {!musicXml && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "#666",
          }}
        >
          Select a MusicXML file to view
        </div>
      )}
    </div>
  );
}
