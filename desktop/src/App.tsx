import { useState, useMemo, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { SheetMusicViewer, Pattern } from "./components/SheetMusicViewer";
import { PatternList } from "./components/pattern-list/PatternList";
import "./App.css";
import { ThemeToggle } from "./components/ThemeToggle";
import {
  TimeSignatureProvider,
  useTimeSignature,
} from "./context/TimeSignatureContext";

interface PartPatterns {
  part_index: number;
  part_name: string;
  patterns: Pattern[];
}

interface AnalysisResult {
  file: string;
  treble: PartPatterns;
  bass: PartPatterns;
  musicxml_content: string;
}

interface Progress {
  type: string;
  stage: string;
  current: number;
  total: number;
  message: string;
}

function AppContent() {
  const [musicXml, setMusicXml] = useState<string | null>(null);
  const [treblePatterns, setTreblePatterns] = useState<Pattern[]>([]);
  const [bassPatterns, setBassPatterns] = useState<Pattern[]>([]);
  const [enabledPatterns, setEnabledPatterns] = useState<Set<number>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [playingNotes, setPlayingNotes] = useState<Set<string> | null>(null);
  const [playingPatternId, setPlayingPatternId] = useState<number | null>(null);
  const { setTimeSignature } = useTimeSignature();

  // Wrapper to track playing pattern ID alongside playing notes
  const handlePlayingNotesChange = (keys: Set<string> | null) => {
    setPlayingNotes(keys);
    if (keys === null) {
      setPlayingPatternId(null);
    }
  };

  const patternColors = useMemo(() => new Map<number, string>(), []);

  useEffect(() => {
    const unlisten = listen<Progress>("analyze-progress", (event) => {
      setProgress(event.payload);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
    document.body.classList.toggle("light", !darkMode);
  }, [darkMode]);

  // Combine all patterns for the viewer
  const allPatterns = useMemo(
    () => [...treblePatterns, ...bassPatterns],
    [treblePatterns, bassPatterns]
  );

  const filteredPatterns = useMemo(
    () => allPatterns.filter((p) => enabledPatterns.has(p.id)),
    [allPatterns, enabledPatterns]
  );

  async function handleOpenFile() {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Music Document",
          extensions: ["pdf", "jpg", "png", "musicxml", "mxl"],
        },
      ],
    });

    if (!selected) return;

    const path = typeof selected === "string" ? selected : selected;
    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      // Read the MusicXML file
      const filename = path.split("/").pop() || path;
      const ext = path.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
      const isFileMusicXml = ext === "musicxml" || ext === "xml";

      // If we have a musicxml file, we can set the music xml instantly.
      if (isFileMusicXml) {
        const content = await invoke<string>("read_file", { path });
        setMusicXml(content);
      }

      setFileName(filename);

      // Analyze for patterns
      const result = await invoke<AnalysisResult>("analyze_music", { path });
      console.log("result:", result);

      setTreblePatterns(
        result.treble.patterns.map((pattern) => ({ ...pattern, partIndex: 0 }))
      );
      setBassPatterns(
        result.bass.patterns.map((pattern) => ({ ...pattern, partIndex: 1 }))
      );

      if (!isFileMusicXml) {
        setMusicXml(result.musicxml_content);
      }

      // Enable all patterns by default
      const allIds = [
        ...result.treble.patterns.map((p) => p.id),
        ...result.bass.patterns.map((p) => p.id),
      ];
      setEnabledPatterns(new Set(allIds));
    } catch (err) {
      setError(String(err));
      setMusicXml(null);
      setTreblePatterns([]);
      setBassPatterns([]);
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }

  function handleTogglePattern(patternId: number) {
    setEnabledPatterns((prev) => {
      const next = new Set(prev);
      if (next.has(patternId)) {
        next.delete(patternId);
      } else {
        next.add(patternId);
      }
      return next;
    });
  }

  function handleToggleAllPatternsOfType(partIndex: number) {
    setEnabledPatterns((prev) => {
      const next = new Set(prev);
      const patternsOfPart = allPatterns.filter(
        (p) => p.partIndex === partIndex
      );

      const anyVisible = patternsOfPart.some((p) => next.has(p.id));
      for (const pattern of patternsOfPart) {
        if (anyVisible) {
          next.delete(pattern.id);
        } else {
          next.add(pattern.id);
        }
      }

      return next;
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "12px 16px",
          backgroundColor: "#333",
          color: "white",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "18px" }}>
          Music Repetition Highlighter
        </h1>

        <button
          onClick={handleOpenFile}
          disabled={isLoading}
          style={{
            padding: "8px 16px",
            cursor: isLoading ? "wait" : "pointer",
          }}
        >
          {isLoading
            ? progress
              ? progress.message
              : "Loading..."
            : "Open File"}
        </button>

        {fileName && (
          <span style={{ fontSize: "14px", color: "#aaa" }}>{fileName}</span>
        )}

        {error && (
          <span style={{ fontSize: "14px", color: "#ff6b6b" }}>{error}</span>
        )}

        <div style={{ flex: 1 }} />

        <ThemeToggle
          darkMode={darkMode}
          onClick={() => setDarkMode(!darkMode)}
        />
      </header>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <aside
          className="sidebar"
          style={{
            width: "280px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Treble patterns - top half */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
            }}
          >
            <PatternList
              title="Treble"
              patterns={treblePatterns}
              enabledPatterns={enabledPatterns}
              onTogglePattern={handleTogglePattern}
              onToggleAllPatterns={handleToggleAllPatternsOfType}
              playingPatternId={playingPatternId}
              onPlayStart={setPlayingPatternId}
              onPlayingNotesChange={handlePlayingNotesChange}
            />
          </div>

          {/* Bass patterns - bottom half */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            <PatternList
              title="Bass"
              patterns={bassPatterns}
              enabledPatterns={enabledPatterns}
              onTogglePattern={handleTogglePattern}
              onToggleAllPatterns={handleToggleAllPatternsOfType}
              playingPatternId={playingPatternId}
              onPlayStart={setPlayingPatternId}
              onPlayingNotesChange={handlePlayingNotesChange}
            />
          </div>
        </aside>

        {/* Sheet music viewer */}
        <main style={{ flex: 1, overflow: "hidden" }}>
          <SheetMusicViewer
            musicXml={musicXml}
            patterns={filteredPatterns}
            patternColors={patternColors}
            onTimeSignatureChange={setTimeSignature}
            playingNotes={playingNotes}
          />
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <TimeSignatureProvider>
      <AppContent />
    </TimeSignatureProvider>
  );
}

export default App;
