import { usePlayback } from "../context/PlaybackContext";

export function TempoInput() {
  const { tempo, setTempo } = usePlayback();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <label htmlFor="tempo" style={{ fontSize: "14px", color: "#aaa" }}>
        BPM
      </label>
      <input
        id="tempo"
        type="number"
        min={1}
        max={300}
        value={tempo}
        onChange={(e) => setTempo(parseInt(e.target.value) || 120)}
        style={{
          width: "60px",
          padding: "4px 8px",
          fontSize: "14px",
          borderRadius: "4px",
          border: "1px solid #555",
          backgroundColor: "#444",
          color: "white",
        }}
      />
    </div>
  );
}
