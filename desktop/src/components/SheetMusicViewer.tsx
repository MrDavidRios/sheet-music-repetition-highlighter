import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useDebounceCallback, useResizeObserver } from "usehooks-ts";
import { getPatternColor } from "../utils/color";
import { Tooltip, TooltipTrigger, TooltipContent } from "./tooltip/Tooltip";

export interface NoteLocator {
  index: number;
  measure: number;
  beat: number | null;
  pitch: string;
}

export interface Pattern {
  id: number;
  partIndex: number; // 0 = treble, 1 = bass
  length: number;
  count: number;
  positions: number[];
  notes: NoteLocator[];
}

// Position data for rendering React overlays
export interface NotePosition {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  patternId: number;
  color: string;
  pitch: string;
}

// Marker for pattern start/end
interface PatternMarker {
  type: "start" | "end";
  x: number;
  y: number;
  patternId: number;
  occurrenceIndex: number;
  color: string;
}

interface SheetMusicViewerProps {
  musicXml: string | null;
  patterns: Pattern[];
  patternColors: Map<number, string>;
  // Optional: render custom overlay at note positions
  renderOverlay?: (positions: NotePosition[]) => React.ReactNode;
}

export const SheetMusicViewer: React.FC<SheetMusicViewerProps> = ({
  musicXml,
  patterns,
  patternColors,
  renderOverlay,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdContainerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [notePositions, setNotePositions] = useState<NotePosition[]>([]);
  const [markers, setMarkers] = useState<PatternMarker[]>([]);

  // Initialize OpenSheetMusicDisplay when musicXml changes
  useEffect(() => {
    if (!osmdContainerRef.current || !musicXml) return;

    const osmd = new OpenSheetMusicDisplay(osmdContainerRef.current, {
      autoResize: false, // Handle resize manually to preserve scroll
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

  // Build set of note indices that belong to patterns + start/end markers
  // Keys are "partIndex-noteIndex" to support both staves
  const { patternNoteIndices, patternBoundaries } = useMemo(() => {
    const indexToPattern = new Map<
      string,
      { patternId: number; color: string; pitch: string }
    >();
    // Map of "partIndex-noteIndex" -> marker info for start/end positions
    const boundaries = new Map<
      string,
      {
        type: "start" | "end";
        patternId: number;
        occurrenceIndex: number;
        color: string;
      }
    >();

    for (const pattern of patterns) {
      const color =
        patternColors.get(pattern.id) || getPatternColor(pattern.id, true);
      const partIndex = pattern.partIndex;

      pattern.positions.forEach((startPos, occurrenceIndex) => {
        const endPos = startPos + pattern.length - 1;

        // Mark start and end positions with composite key
        const startKey = `${partIndex}-${startPos}`;
        const endKey = `${partIndex}-${endPos}`;
        boundaries.set(startKey, {
          type: "start",
          patternId: pattern.id,
          occurrenceIndex,
          color,
        });
        boundaries.set(endKey, {
          type: "end",
          patternId: pattern.id,
          occurrenceIndex,
          color,
        });

        for (let i = 0; i < pattern.length; i++) {
          const key = `${partIndex}-${startPos + i}`;
          const pitch = pattern.notes[i]?.pitch || "";
          indexToPattern.set(key, { patternId: pattern.id, color, pitch });
        }
      });
    }
    return {
      patternNoteIndices: indexToPattern,
      patternBoundaries: boundaries,
    };
  }, [patterns, patternColors]);

  // Color notes via OSMD API
  const applyColors = useCallback(() => {
    if (!isLoaded || !osmdRef.current || !containerRef.current) return;

    const osmd = osmdRef.current;
    const graphic = osmd.GraphicSheet;
    if (!graphic) return;

    const numStaves = graphic.MeasureList[0]?.length || 1;

    for (let staffIndex = 0; staffIndex < numStaves; staffIndex++) {
      let noteIndex = 0;

      for (const measureList of graphic.MeasureList) {
        const measure = measureList[staffIndex];
        if (!measure) continue;

        for (const staffEntry of measure.staffEntries) {
          if (!staffEntry) continue;

          for (const voiceEntry of staffEntry.graphicalVoiceEntries) {
            const hasNotes = voiceEntry.notes.some(
              (n) => !n.sourceNote.isRest()
            );
            if (!hasNotes) continue;

            const key = `${staffIndex}-${noteIndex}`;
            const patternInfo = patternNoteIndices.get(key);

            for (const graphicalNote of voiceEntry.notes) {
              if (graphicalNote.sourceNote.isRest()) continue;

              if (patternInfo) {
                graphicalNote.sourceNote.NoteheadColor = patternInfo.color;
              } else {
                graphicalNote.sourceNote.NoteheadColor = "black";
              }
            }

            noteIndex++;
          }
        }
      }
    }

    // Save scroll position before render (OSMD rebuilds SVG)
    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;

    osmd.render();

    // Restore scroll position after render
    container.scrollTop = scrollTop;
    container.scrollLeft = scrollLeft;
  }, [isLoaded, patternNoteIndices]);

  // Extract marker positions (called after render)
  const updateMarkerPositions = useCallback(() => {
    if (
      !isLoaded ||
      !osmdRef.current ||
      !containerRef.current ||
      !osmdContainerRef.current
    )
      return;

    const osmd = osmdRef.current;
    const graphic = osmd.GraphicSheet;
    if (!graphic) return;

    const container = containerRef.current;
    const osmdContainer = osmdContainerRef.current;
    const svgElement = osmdContainer.querySelector("svg");
    if (!svgElement) return;

    const svgRect = svgElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const unitToPixel =
      svgRect.width / (svgElement.viewBox?.baseVal?.width || svgRect.width);

    const positions: NotePosition[] = [];
    const newMarkers: PatternMarker[] = [];
    const numStaves = graphic.MeasureList[0]?.length || 1;

    for (let staffIndex = 0; staffIndex < numStaves; staffIndex++) {
      let noteIndex = 0;

      for (const measureList of graphic.MeasureList) {
        const measure = measureList[staffIndex];
        if (!measure) continue;

        for (const staffEntry of measure.staffEntries) {
          if (!staffEntry) continue;

          for (const voiceEntry of staffEntry.graphicalVoiceEntries) {
            const hasNotes = voiceEntry.notes.some(
              (n) => !n.sourceNote.isRest()
            );
            if (!hasNotes) continue;

            const key = `${staffIndex}-${noteIndex}`;
            const patternInfo = patternNoteIndices.get(key);
            const boundaryInfo = patternBoundaries.get(key);

            if (staffEntry.PositionAndShape) {
              const box = staffEntry.PositionAndShape;
              // Add scroll offset to convert viewport-relative to content-relative
              const x =
                svgRect.left -
                containerRect.left +
                container.scrollLeft +
                box.AbsolutePosition.x * unitToPixel * 10;
              const y =
                svgRect.top -
                containerRect.top +
                container.scrollTop +
                box.AbsolutePosition.y * unitToPixel * 10;

              if (patternInfo) {
                positions.push({
                  index: noteIndex,
                  x,
                  y,
                  width: box.Size.width * unitToPixel * 10,
                  height: box.Size.height * unitToPixel * 10,
                  patternId: patternInfo.patternId,
                  color: patternInfo.color,
                  pitch: patternInfo.pitch,
                });
              }

              if (boundaryInfo) {
                newMarkers.push({
                  type: boundaryInfo.type,
                  x,
                  y,
                  patternId: boundaryInfo.patternId,
                  occurrenceIndex: boundaryInfo.occurrenceIndex,
                  color: boundaryInfo.color,
                });
              }
            }

            noteIndex++;
          }
        }
      }
    }

    setNotePositions(positions);
    setMarkers(newMarkers);
  }, [isLoaded, patternNoteIndices, patternBoundaries]);

  // Handle resize manually to preserve scroll position
  const onResize = useDebounceCallback(() => {
    if (!isLoaded || !osmdRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;

    osmdRef.current.render();

    container.scrollTop = scrollTop;
    container.scrollLeft = scrollLeft;

    requestAnimationFrame(() => {
      updateMarkerPositions();
    });
  }, 300);

  useResizeObserver({
    ref: containerRef as React.RefObject<HTMLElement>,
    onResize,
  });

  // Apply colors first, then update positions after render completes
  useEffect(() => {
    applyColors();
    requestAnimationFrame(() => {
      updateMarkerPositions();
    });
  }, [applyColors, updateMarkerPositions]);

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
      {/* OSMD renders into this div - separate from React-managed markers */}
      <div ref={osmdContainerRef} />
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
          Select an image, a PDF, or a MusicXML file to view
        </div>
      )}
      {/* Render start/end markers for pattern groups */}
      {markers.map((marker, i) => (
        <div
          key={`marker-${i}`}
          style={{
            position: "absolute",
            left: marker.x - 6,
            top: marker.type === "start" ? marker.y - 20 : marker.y + 35,
            width: 0,
            height: 0,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            ...(marker.type === "start"
              ? { borderTop: `12px solid ${marker.color}` }
              : { borderBottom: `12px solid ${marker.color}` }),
            pointerEvents: "none",
          }}
          title={`${marker.type === "start" ? "Start" : "End"} of pattern ${
            marker.patternId + 1
          }, occurrence ${marker.occurrenceIndex + 1}`}
        />
      ))}
      {/* Render note tooltips for highlighted notes */}
      {notePositions.map((pos, i) => (
        <Tooltip key={`note-tooltip-${i}`}>
          <TooltipTrigger asChild>
            <div
              style={{
                position: "absolute",
                left: pos.x - pos.width / 2,
                top: pos.y,
                width: pos.width,
                height: pos.height,
                background: "transparent",
                cursor: "default",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
              }}
            />
          </TooltipTrigger>
          <TooltipContent>{pos.pitch.replace(/[0-9]$/, "")}</TooltipContent>
        </Tooltip>
      ))}
      {/* Render custom React overlays at note positions */}
      {renderOverlay &&
        notePositions.length > 0 &&
        renderOverlay(notePositions)}
    </div>
  );
};
