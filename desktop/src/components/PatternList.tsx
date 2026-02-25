import { getPatternColor } from "../utils/color";
import { Pattern } from "./SheetMusicViewer";

interface Props {
  title: string;
  patterns: Pattern[];
  enabledPatterns: Set<number>;
  onTogglePattern: (patternId: number) => void;
}

export function PatternList({
  title,
  patterns,
  enabledPatterns,
  onTogglePattern,
}: Props) {
  return (
    <div style={{ padding: "8px" }}>
      <div
        style={{
          marginBottom: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong>
          {title} ({patterns.length})
        </strong>
      </div>

      {patterns.length === 0 ? (
        <div style={{ padding: "8px", color: "#999", fontSize: "13px" }}>
          No patterns found
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {patterns.map((pattern) => {
            const color = getPatternColor(pattern.id);
            const isEnabled = enabledPatterns.has(pattern.id);

            return (
              <div
                key={pattern.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px",
                  borderRadius: "4px",
                  backgroundColor: "#f5f5f5",
                }}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    onTogglePattern(pattern.id);
                  }}
                  style={{ cursor: "pointer" }}
                />

                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "3px",
                    backgroundColor: color.replace("0.3", "0.8"),
                    flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: "14px" }}>
                    {pattern.length} notes × {pattern.count}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {pattern.notes
                      .slice(0, 6)
                      .map((n) => n.pitch)
                      .join(" ")}
                    {pattern.notes.length > 6 && "..."}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
