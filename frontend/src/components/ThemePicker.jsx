export const THEMES = [
  {
    id: "classic",
    name: "Classic",
    bg: "#FFFFFF",
    accent: "#0070C0",
    text: "#1A1A1A",
    preview: ["#FFFFFF", "#0070C0", "#1A1A1A"],
  },
  {
    id: "dark",
    name: "Dark",
    bg: "#1E1E2E",
    accent: "#CBA6F7",
    text: "#CDD6F4",
    preview: ["#1E1E2E", "#CBA6F7", "#CDD6F4"],
  },
  {
    id: "corporate",
    name: "Corporate",
    bg: "#F4F6F9",
    accent: "#003366",
    text: "#222222",
    preview: ["#F4F6F9", "#003366", "#222222"],
  },
  {
    id: "creative",
    name: "Creative",
    bg: "#FFF8F0",
    accent: "#FF6B35",
    text: "#2D2D2D",
    preview: ["#FFF8F0", "#FF6B35", "#2D2D2D"],
  },
  {
    id: "nature",
    name: "Nature",
    bg: "#F0F7F4",
    accent: "#2D7D46",
    text: "#1A2E1A",
    preview: ["#F0F7F4", "#2D7D46", "#1A2E1A"],
  },
  {
    id: "midnight",
    name: "Midnight",
    bg: "#0F172A",
    accent: "#38BDF8",
    text: "#E2E8F0",
    preview: ["#0F172A", "#38BDF8", "#E2E8F0"],
  },
  {
    id: "sunset",
    name: "Sunset",
    bg: "#1A0A0F",
    accent: "#F4A261",
    text: "#FAF0E6",
    preview: ["#1A0A0F", "#F4A261", "#FAF0E6"],
  },
  {
    id: "rose",
    name: "Rose",
    bg: "#FFF0F6",
    accent: "#E91E8C",
    text: "#1A0010",
    preview: ["#FFF0F6", "#E91E8C", "#1A0010"],
  },
]

export function ThemePicker({ selectedId, onSelect }) {
  return (
    <div className="theme-picker">
      {THEMES.map(theme => (
        <button
          key={theme.id}
          className={`theme-card ${selectedId === theme.id ? "selected" : ""}`}
          onClick={() => onSelect(theme)}
          title={theme.name}
        >
          <div className="theme-swatches">
            {theme.preview.map((color, i) => (
              <div key={i} className="theme-swatch" style={{ background: color }} />
            ))}
          </div>
          <span className="theme-name">{theme.name}</span>
          {selectedId === theme.id && <span className="theme-check">✓</span>}
        </button>
      ))}
    </div>
  )
}
