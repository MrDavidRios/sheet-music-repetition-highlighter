import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useDebounceCallback, useResizeObserver } from "usehooks-ts";
import { getPatternColor, getPatternRectColor } from "../utils/color";
import { Tooltip, TooltipTrigger, TooltipContent } from "./tooltip/Tooltip";
import { usePlayback } from "../context/PlaybackContext";

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

// Rectangle overlay for pattern occurrence (per system segment)
interface PatternRectangle {
  patternId: number;
  occurrenceIndex: number;
  systemId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  isStart: boolean; // First segment of occurrence (left border-radius)
  isEnd: boolean; // Last segment of occurrence (right border-radius)
}

interface SheetMusicViewerProps {
  musicXml: string | null;
  patterns: Pattern[];
  patternColors: Map<number, string>;
  // Optional: render custom overlay at note positions
  renderOverlay?: (positions: NotePosition[]) => React.ReactNode;
  onTimeSignatureChange?: (numerator: number, denominator: number) => void;
}

export const SheetMusicViewer: React.FC<SheetMusicViewerProps> = ({
  musicXml,
  patterns,
  patternColors,
  renderOverlay,
  onTimeSignatureChange,
}) => {
  const { playingPatternId, playingBeatIndex } = usePlayback();
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdContainerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const noteElementsRef = useRef<Map<string, SVGElement>>(new Map());
  const [isLoaded, setIsLoaded] = useState(false);
  const [notePositions, setNotePositions] = useState<NotePosition[]>([]);
  const [patternRectangles, setPatternRectangles] = useState<
    PatternRectangle[]
  >([]);

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

        // Extract time signature
        if (onTimeSignatureChange) {
          const firstMeasure = osmd.Sheet?.SourceMeasures?.[0];
          const timeSig = firstMeasure?.ActiveTimeSignature;
          if (timeSig) {
            onTimeSignatureChange(timeSig.Numerator, timeSig.Denominator);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load MusicXML:", err);
        setIsLoaded(false);
      });

    return () => {
      osmdRef.current = null;
      noteElementsRef.current.clear();
      setIsLoaded(false);
    };
  }, [musicXml]);

  // Build set of note indices that belong to patterns
  // Keys are "partIndex-noteIndex" to support both staves
  const patternNoteIndices = useMemo(() => {
    const indexToPattern = new Map<
      string,
      {
        patternId: number;
        occurrenceIndex: number;
        positionInPattern: number;
        color: string;
        pitch: string;
      }
    >();

    for (const pattern of patterns) {
      const color =
        patternColors.get(pattern.id) || getPatternColor(pattern.id, true);
      const partIndex = pattern.partIndex;

      pattern.positions.forEach((startPos, occurrenceIndex) => {
        for (let i = 0; i < pattern.length; i++) {
          const key = `${partIndex}-${startPos + i}`;
          const pitch = pattern.notes[i]?.pitch || "";

          indexToPattern.set(key, {
            patternId: pattern.id,
            occurrenceIndex,
            positionInPattern: i,
            color,
            pitch,
          });
        }
      });
    }
    return indexToPattern;
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

  // Collected note info for rectangle computation
  interface CollectedNote {
    patternId: number;
    occurrenceIndex: number;
    systemId: number;
    x: number;
    width: number;
    staffTop: number;
    staffHeight: number;
  }

  // Extract note positions and compute rectangle overlays
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
    const collectedNotes: CollectedNote[] = [];
    const numStaves = graphic.MeasureList[0]?.length || 1;

    for (let staffIndex = 0; staffIndex < numStaves; staffIndex++) {
      let noteIndex = 0;

      for (const measureList of graphic.MeasureList) {
        const measure = measureList[staffIndex];
        if (!measure) continue;

        // Get system info from measure
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m = measure as any;
        const systemId = m.ParentMusicSystem?.Id ?? 0;
        const staffLine = m.ParentStaffLine;
        const staffHeightUnits = staffLine?.StaffHeight ?? 4;
        const staffTopUnits =
          staffLine?.PositionAndShape?.AbsolutePosition?.y ?? 0;

        // Convert to pixels
        const staffTop =
          svgRect.top -
          containerRect.top +
          container.scrollTop +
          staffTopUnits * 10 * unitToPixel;
        const staffHeight = staffHeightUnits * 10 * unitToPixel;

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

              const box = graphicalNote.PositionAndShape;
              if (!box) continue;

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const gn = graphicalNote as any;
              const vfnote = gn.vfnote?.[0];
              const noteHead = vfnote?.note_heads?.[0];

              // Fixed notehead size (consistent hitboxes)
              const noteheadSize = unitToPixel * 10 * 2;
              const width = noteheadSize;
              const height = noteheadSize;

              // Use VexFlow notehead coords if available, fallback to OSMD
              const noteX = noteHead?.x ?? box.AbsolutePosition.x * 10;
              const noteY = noteHead?.y ?? box.AbsolutePosition.y * 10;

              // Add scroll offset to convert viewport-relative to content-relative
              const x =
                svgRect.left -
                containerRect.left +
                container.scrollLeft +
                noteX * unitToPixel;
              const y =
                svgRect.top -
                containerRect.top +
                container.scrollTop +
                noteY * unitToPixel;

              // Add/remove highlighted class on SVG element
              const svgEl = vfnote?.attrs?.el as SVGElement | undefined;
              if (svgEl) {
                svgEl.classList.toggle("highlighted", !!patternInfo);
                // Store element for playback highlighting
                noteElementsRef.current.set(key, svgEl);
              }

              if (patternInfo) {
                positions.push({
                  index: noteIndex,
                  x,
                  y,
                  width,
                  height,
                  patternId: patternInfo.patternId,
                  color: patternInfo.color,
                  pitch: patternInfo.pitch,
                });

                // Collect for rectangle computation
                collectedNotes.push({
                  patternId: patternInfo.patternId,
                  occurrenceIndex: patternInfo.occurrenceIndex,
                  systemId,
                  x,
                  width,
                  staffTop,
                  staffHeight,
                });
              }
            }

            noteIndex++;
          }
        }
      }
    }

    // Group notes by (patternId, occurrenceIndex, systemId) and compute bounding rectangles
    const rectGroups = new Map<string, CollectedNote[]>();
    for (const note of collectedNotes) {
      const groupKey = `${note.patternId}-${note.occurrenceIndex}-${note.systemId}`;
      if (!rectGroups.has(groupKey)) {
        rectGroups.set(groupKey, []);
      }
      rectGroups.get(groupKey)!.push(note);
    }

    const newRectangles: PatternRectangle[] = [];
    const padding = 5;

    for (const [, notes] of rectGroups) {
      if (notes.length === 0) continue;

      const minX = Math.min(...notes.map((n) => n.x)) - padding;
      const maxX = Math.max(...notes.map((n) => n.x + n.width)) + padding;
      const { patternId, occurrenceIndex, systemId, staffTop, staffHeight } =
        notes[0];

      newRectangles.push({
        patternId,
        occurrenceIndex,
        systemId,
        x: minX,
        y: staffTop,
        width: maxX - minX,
        height: staffHeight,
        color: getPatternRectColor(patternId),
        isStart: true, // Will be updated below
        isEnd: true,
      });
    }

    // Determine isStart/isEnd for multi-system patterns
    // Group rectangles by (patternId, occurrenceIndex), sort by systemId
    const occurrenceGroups = new Map<string, PatternRectangle[]>();
    for (const rect of newRectangles) {
      const key = `${rect.patternId}-${rect.occurrenceIndex}`;
      if (!occurrenceGroups.has(key)) {
        occurrenceGroups.set(key, []);
      }
      occurrenceGroups.get(key)!.push(rect);
    }

    for (const [, rects] of occurrenceGroups) {
      if (rects.length <= 1) continue; // Single segment, keep both true
      rects.sort((a, b) => a.systemId - b.systemId);
      for (let i = 0; i < rects.length; i++) {
        rects[i].isStart = i === 0;
        rects[i].isEnd = i === rects.length - 1;
      }
    }

    setNotePositions(positions);
    setPatternRectangles(newRectangles);
  }, [isLoaded, patternNoteIndices]);

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

  // Toggle "playing" class on notes during audio playback
  useEffect(() => {
    noteElementsRef.current.forEach((el, key) => {
      const patternInfo = patternNoteIndices.get(key);

      const isPlaying =
        patternInfo !== undefined &&
        patternInfo.patternId === playingPatternId &&
        patternInfo.positionInPattern === playingBeatIndex;
      el.classList.toggle("playing", isPlaying);
    });
  }, [playingPatternId, playingBeatIndex, patternNoteIndices]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "auto",
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
      {/* Render pattern rectangle overlays */}
      {patternRectangles.map((rect, i) => {
        const radius = 6;
        return (
          <div
            key={`rect-${rect.patternId}-${rect.occurrenceIndex}-${i}`}
            style={{
              position: "absolute",
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              backgroundColor: rect.color,
              borderRadius: `${rect.isStart ? radius : 0}px ${
                rect.isEnd ? radius : 0
              }px ${rect.isEnd ? radius : 0}px ${rect.isStart ? radius : 0}px`,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        );
      })}
      {/* Render note tooltips for highlighted notes */}
      {notePositions.map((pos, i) => (
        <Tooltip key={`note-tooltip-${i}`}>
          <TooltipTrigger asChild>
            <div
              style={{
                position: "absolute",
                left: pos.x - pos.width * 0.2,
                top: pos.y - pos.height / 2,
                width: pos.width,
                height: pos.height,
                cursor: "default",
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
