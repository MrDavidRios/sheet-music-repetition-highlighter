import { useState, useMemo, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { SheetMusicViewer, Pattern } from "./components/SheetMusicViewer";
import { PatternList } from "./components/PatternList";
import "./App.css";

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

function App() {
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

  const patternColors = useMemo(() => new Map<number, string>(), []);

  useEffect(() => {
    const unlisten = listen<Progress>("analyze-progress", (event) => {
      setProgress(event.payload);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  // Combine all patterns for the viewer
  const allPatterns = useMemo(
    () => [
      ...treblePatterns.map((pattern) => ({ ...pattern, partIndex: 0 })),
      ...bassPatterns.map((pattern) => ({ ...pattern, partIndex: 1 })),
    ],
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

      setTreblePatterns(result.treble.patterns);
      setBassPatterns(result.bass.patterns);

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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "#f0f0f0",
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
      </header>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <aside
          style={{
            width: "280px",
            backgroundColor: "white",
            borderRight: "1px solid #ddd",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Treble patterns - top half */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              borderBottom: "1px solid #ddd",
            }}
          >
            <PatternList
              title="Treble"
              patterns={treblePatterns}
              enabledPatterns={enabledPatterns}
              onTogglePattern={handleTogglePattern}
            />
          </div>

          {/* Bass patterns - bottom half */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            <PatternList
              title="Bass"
              patterns={bassPatterns}
              enabledPatterns={enabledPatterns}
              onTogglePattern={handleTogglePattern}
            />
          </div>
        </aside>

        {/* Sheet music viewer */}
        <main style={{ flex: 1, overflow: "hidden" }}>
          <SheetMusicViewer
            musicXml={musicXml}
            patterns={filteredPatterns}
            patternColors={patternColors}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
