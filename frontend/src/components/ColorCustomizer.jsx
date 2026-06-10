export function ColorCustomizer({ colors, onChange }) {
  const fields = [
    { key: "bg", label: "Background" },
    { key: "accent", label: "Accent" },
    { key: "text", label: "Text" },
  ]

  return (
    <div className="color-customizer">
      {fields.map(({ key, label }) => (
        <div key={key} className="color-field">
          <label className="color-label">{label}</label>
          <div className="color-input-wrap">
            <input
              type="color"
              value={colors[key]}
              onChange={e => onChange({ ...colors, [key]: e.target.value })}
              className="color-swatch-input"
            />
            <input
              type="text"
              value={colors[key]}
              onChange={e => {
                const val = e.target.value
                if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) onChange({ ...colors, [key]: val })
              }}
              className="color-hex-input"
              maxLength={7}
              spellCheck={false}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
