import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { SheetMusicViewer, Pattern } from "./components/SheetMusicViewer";
import { PatternList } from "./components/PatternList";
import "./App.css";

interface AnalysisResult {
  file: string;
  patterns: Pattern[];
}

function App() {
  const [musicXml, setMusicXml] = useState<string | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [highlightedPatternId, setHighlightedPatternId] = useState<number | null>(null);
  const [enabledPatterns, setEnabledPatterns] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const patternColors = useMemo(() => new Map<number, string>(), []);

  const filteredPatterns = useMemo(
    () => patterns.filter((p) => enabledPatterns.has(p.id)),
    [patterns, enabledPatterns]
  );

  async function handleOpenFile() {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "MusicXML",
          extensions: ["musicxml", "xml", "mxl"],
        },
      ],
    });

    if (!selected) return;

    const path = typeof selected === "string" ? selected : selected;
    setIsLoading(true);
    setError(null);

    try {
      // Read the MusicXML file
      const content = await invoke<string>("read_file", { path });
      setMusicXml(content);
      setFileName(path.split("/").pop() || path);

      // Analyze for patterns
      const result = await invoke<AnalysisResult>("analyze_music", { path });
      setPatterns(result.patterns);

      // Enable all patterns by default
      setEnabledPatterns(new Set(result.patterns.map((p) => p.id)));
      setHighlightedPatternId(null);
    } catch (err) {
      setError(String(err));
      setMusicXml(null);
      setPatterns([]);
    } finally {
      setIsLoading(false);
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
        <h1 style={{ margin: 0, fontSize: "18px" }}>Music Repetition Highlighter</h1>

        <button
          onClick={handleOpenFile}
          disabled={isLoading}
          style={{
            padding: "8px 16px",
            cursor: isLoading ? "wait" : "pointer",
          }}
        >
          {isLoading ? "Loading..." : "Open File"}
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
            overflowY: "auto",
          }}
        >
          <PatternList
            patterns={patterns}
            highlightedPatternId={highlightedPatternId}
            onPatternClick={setHighlightedPatternId}
            enabledPatterns={enabledPatterns}
            onTogglePattern={handleTogglePattern}
          />
        </aside>

        {/* Sheet music viewer */}
        <main style={{ flex: 1, overflow: "hidden" }}>
          <SheetMusicViewer
            musicXml={musicXml}
            patterns={filteredPatterns}
            highlightedPatternId={highlightedPatternId}
            patternColors={patternColors}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
