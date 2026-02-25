import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useDebounceCallback, useResizeObserver } from "usehooks-ts";

export interface NoteLocator {
  index: number;
  measure: number;
  beat: number;
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

interface Props {
  musicXml: string | null;
  patterns: Pattern[];
  highlightedPatternId: number | null;
  patternColors: Map<number, string>;
  // Optional: render custom overlay at note positions
  renderOverlay?: (positions: NotePosition[]) => React.ReactNode;
}

// Solid colors for SVG coloring
const COLORS_SOLID = [
  "#FF6B6B",
  "#4ECDC4",
  "#FFE66D",
  "#AA80FF",
  "#FFA69E",
  "#80DEEA",
  "#FFB74D",
  "#95AFC0",
];

// Transparent colors for div overlays
const COLORS_ALPHA = [
  "rgba(255, 107, 107, 0.3)",
  "rgba(78, 205, 196, 0.3)",
  "rgba(255, 230, 109, 0.3)",
  "rgba(170, 128, 255, 0.3)",
  "rgba(255, 166, 158, 0.3)",
  "rgba(128, 222, 234, 0.3)",
  "rgba(255, 183, 77, 0.3)",
  "rgba(149, 175, 192, 0.3)",
];

export function getPatternColor(patternId: number, solid = false): string {
  const colors = solid ? COLORS_SOLID : COLORS_ALPHA;
  return colors[patternId % colors.length];
}

export function SheetMusicViewer({
  musicXml,
  patterns,
  highlightedPatternId,
  patternColors,
  renderOverlay,
}: Props) {
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

  // Build set of note indices that belong to patterns + start/end markers
  // Keys are "partIndex-noteIndex" to support both staves
  const { patternNoteIndices, patternBoundaries } = useMemo(() => {
    const indexToPattern = new Map<
      string,
      { patternId: number; color: string }
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

    const patternsToUse =
      highlightedPatternId !== null
        ? patterns.filter((p) => p.id === highlightedPatternId)
        : patterns;

    for (const pattern of patternsToUse) {
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
          indexToPattern.set(key, { patternId: pattern.id, color });
        }
      });
    }
    return {
      patternNoteIndices: indexToPattern,
      patternBoundaries: boundaries,
    };
  }, [patterns, highlightedPatternId, patternColors]);

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

    osmd.render();
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
              const x =
                svgRect.left -
                containerRect.left +
                box.AbsolutePosition.x * unitToPixel * 10;
              const y =
                svgRect.top -
                containerRect.top +
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

  // Only update marker positions on resize - OSMD handles its own resize via autoResize
  const onResize = useDebounceCallback(() => {
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
          Select a MusicXML file to view
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
            zIndex: 12,
          }}
          title={`${marker.type === "start" ? "Start" : "End"} of pattern ${
            marker.patternId + 1
          }, occurrence ${marker.occurrenceIndex + 1}`}
        />
      ))}
      {/* Render custom React overlays at note positions */}
      {renderOverlay &&
        notePositions.length > 0 &&
        renderOverlay(notePositions)}
    </div>
  );
}
