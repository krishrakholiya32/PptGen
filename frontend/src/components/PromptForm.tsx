import { useState, useRef, type Dispatch, type SetStateAction } from "react"
import { ThemePicker, THEMES } from "./ThemePicker"
import { PromptTemplates } from "./PromptTemplates"
import { ColorCustomizer } from "./ColorCustomizer"
import { SlideCountRecommender } from "./SlideCountRecommender"
import type { Colors, Theme, UploadedFiles } from "../types"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

interface Language { code: string; label: string }
interface ToneOption { value: string; label: string }

const LANGUAGES: Language[] = [
  { code: "en", label: "English 🇬🇧" },
  { code: "hi", label: "Hindi 🇮🇳" },
  { code: "es", label: "Spanish 🇪🇸" },
  { code: "fr", label: "French 🇫🇷" },
  { code: "de", label: "German 🇩🇪" },
  { code: "zh", label: "Chinese 🇨🇳" },
  { code: "ar", label: "Arabic 🇸🇦" },
  { code: "pt", label: "Portuguese 🇧🇷" },
  { code: "ja", label: "Japanese 🇯🇵" },
  { code: "ru", label: "Russian 🇷🇺" },
]

const TONES: ToneOption[] = [
  { value: "general",   label: "General" },
  { value: "executive", label: "Executive" },
  { value: "technical", label: "Technical" },
  { value: "students",  label: "Students" },
  { value: "sales",     label: "Sales" },
]

interface PromptFormProps {
  sessionId: string
  setSessionId: Dispatch<SetStateAction<string>>
  uploadedFiles: UploadedFiles
  setUploadedFiles: Dispatch<SetStateAction<UploadedFiles>>
  onGenerate: (jobId: string) => void
  onBack: () => void
  token: string
}

export function PromptForm({ sessionId, setSessionId, uploadedFiles, setUploadedFiles, onGenerate, onBack, token }: PromptFormProps) {
  const [prompt, setPrompt]             = useState("")
  const [slideCount, setSlideCount]     = useState(10)
  const [templateFile, setTemplateFile] = useState("")
  const [language, setLanguage]         = useState("en")
  const [contentDensity, setContentDensity] = useState("medium")
  const [tone, setTone]                 = useState("general")
  const [extraContext, setExtraContext]  = useState("")
  const [showContext, setShowContext]    = useState(false)
  const [useWebSearch, setUseWebSearch]  = useState(true)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState("")

  const [selectedTheme, setSelectedTheme]         = useState<Theme>(THEMES[0])
  const [customColors, setCustomColors]           = useState<Colors>({ bg: THEMES[0].bg, accent: THEMES[0].accent, text: THEMES[0].text })
  const [useCustomColors, setUseCustomColors]     = useState(false)
  const [showColorCustomizer, setShowColorCustomizer] = useState(false)

  // Upload panel state
  const [showUpload, setShowUpload]     = useState(false)
  const [dragging, setDragging]         = useState(false)
  const [uploadFiles, setUploadFiles]   = useState<File[]>([])
  const [uploading, setUploading]       = useState(false)
  const [uploadError, setUploadError]   = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleThemeSelect = (theme: Theme) => {
    setSelectedTheme(theme)
    setCustomColors({ bg: theme.bg, accent: theme.accent, text: theme.text })
    setUseCustomColors(false)
  }

  const activeColors: Colors = useCustomColors
    ? customColors
    : { bg: selectedTheme.bg, accent: selectedTheme.accent, text: selectedTheme.text }

  // ── Upload helpers ────────────────────────────────────────────────────────

  const ACCEPTED = ".jpg,.jpeg,.png,.webp,.gif,.pptx,.pdf,.docx,.txt,.md"

  const addFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles)
    setUploadFiles(prev => {
      const names = new Set(prev.map(f => f.name))
      return [...prev, ...arr.filter(f => !names.has(f.name))]
    })
  }

  const removeFile = (name: string) => setUploadFiles(prev => prev.filter(f => f.name !== name))

  const getFileType = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() ?? ""
    if (["jpg","jpeg","png","webp","gif"].includes(ext)) return "image"
    if (ext === "pptx") return "template"
    if (["pdf","docx","txt","md"].includes(ext)) return "document"
    return "unknown"
  }

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return
    setUploading(true)
    setUploadError("")
    try {
      const form = new FormData()
      uploadFiles.forEach(f => form.append("files", f))
      if (sessionId) form.append("session_id", sessionId)
      const res = await fetch(`${API}/upload`, { method: "POST", body: form })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSessionId(data.session_id)
      setUploadedFiles({ images: data.images || [], templates: data.templates || [], documents: data.documents || [] })
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!prompt.trim()) { setError("Please enter a prompt."); return }
    setLoading(true); setError("")
    try {
      const langLabel = LANGUAGES.find(l => l.code === language)?.label.split(" ")[0] || "English"
      let finalPrompt = language === "en"
        ? prompt
        : `${prompt}\n\nIMPORTANT: Generate ALL slide content in ${langLabel} language.`

      if (extraContext.trim()) {
        finalPrompt += `\n\n[ADDITIONAL CONTEXT PROVIDED BY USER]\n${extraContext.trim()}\nUse the above context to enrich the slide content with relevant facts and details.`
      }

      const res = await fetch(`${API}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          prompt: finalPrompt,
          slide_count: slideCount,
          session_id: sessionId,
          template_file: templateFile || null,
          image_files: uploadedFiles.images,
          document_files: uploadedFiles.documents,
          theme_colors: activeColors,
          use_web_search: useWebSearch,
          content_density: contentDensity,
          tone,
        })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      onGenerate(data.job_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card prompt-card">
      <div className="card-header">
        <h2 className="card-title">Configure your presentation</h2>
        <p className="card-sub">Describe what you need and tune the settings below.</p>
      </div>

      <PromptTemplates onSelect={p => { setPrompt(p); setError("") }} />

      <div className="form-group">
        <label className="form-label">Prompt</label>
        <textarea
          className="form-textarea"
          rows={4}
          placeholder="Describe your presentation, or pick a template above…"
          value={prompt}
          onChange={e => { setPrompt(e.target.value); setError("") }}
        />
        <SlideCountRecommender prompt={prompt} onRecommend={setSlideCount} />
      </div>

      {/* Context paste field */}
      <div className="form-group">
        <button className="btn-toggle" onClick={() => setShowContext(v => !v)}>
          <span style={{ fontSize: "10px" }}>{showContext ? "▾" : "▸"}</span>
          Paste your own context or data
          <span className="toggle-hint">optional — stats, notes, facts to include</span>
        </button>
        {showContext && (
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="Paste any notes, statistics, company info, or data you want the AI to use…"
            value={extraContext}
            onChange={e => setExtraContext(e.target.value)}
            style={{ marginTop: "8px" }}
          />
        )}
      </div>

      {/* Web search toggle */}
      <div className="form-group">
        <label className="form-label toggle-row">
          <span>🌐 Search web for current facts</span>
          <span className="toggle-hint">adds live data to your slides</span>
          <input
            type="checkbox"
            className="toggle-checkbox"
            checked={useWebSearch}
            onChange={e => setUseWebSearch(e.target.checked)}
          />
        </label>
      </div>

      <div className="section-divider" />

      {/* Slide count + language */}
      <div className="form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Slide count — {slideCount}</label>
          <input
            type="range" min={5} max={30} value={slideCount}
            onChange={e => setSlideCount(Number(e.target.value))}
            className="form-range"
          />
          <div className="range-labels"><span>5</span><span>30</span></div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Language</label>
          <select className="form-select" value={language} onChange={e => setLanguage(e.target.value)}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      </div>

      {/* Content density + tone */}
      <div className="form-row" style={{ marginTop: "20px" }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Content density</label>
          <div className="density-tabs">
            {["short", "medium", "long"].map(d => (
              <button
                key={d}
                className={`density-tab ${contentDensity === d ? "active" : ""}`}
                onClick={() => setContentDensity(d)}
              >
                {d === "short" ? "🗒 Short" : d === "medium" ? "📄 Medium" : "📚 Long"}
              </button>
            ))}
          </div>
          <p className="form-hint">
            {contentDensity === "short" ? "2-3 concise bullets — great for executives"
              : contentDensity === "medium" ? "4-5 informative bullets — standard"
              : "7-8 detailed bullets — great for training"}
          </p>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Audience tone</label>
          <select className="form-select" value={tone} onChange={e => setTone(e.target.value)}>
            {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <div className="section-divider" />

      {/* Theme picker */}
      <div className="form-group">
        <label className="form-label">Slide theme</label>
        <ThemePicker selectedId={selectedTheme.id} onSelect={handleThemeSelect} />
      </div>

      {/* Color customizer */}
      <div className="form-group">
        <button className="btn-toggle" onClick={() => setShowColorCustomizer(v => !v)}>
          <span style={{ fontSize: "10px" }}>{showColorCustomizer ? "▾" : "▸"}</span>
          Customize colors
          {useCustomColors && <span className="custom-badge">custom</span>}
        </button>
        {showColorCustomizer && (
          <div className="customizer-panel">
            <ColorCustomizer colors={customColors} onChange={c => { setCustomColors(c); setUseCustomColors(true) }} />
            <div className="color-preview" style={{ background: activeColors.bg, borderColor: activeColors.accent }}>
              <span className="color-preview-title" style={{ color: activeColors.accent }}>Slide Title</span>
              <span className="color-preview-body" style={{ color: activeColors.text }}>• Bullet point content</span>
            </div>
            {useCustomColors && (
              <button className="btn-reset-colors" onClick={() => {
                setCustomColors({ bg: selectedTheme.bg, accent: selectedTheme.accent, text: selectedTheme.text })
                setUseCustomColors(false)
              }}>↺ Reset to theme colors</button>
            )}
          </div>
        )}
      </div>

      <div className="section-divider" />

      {/* Upload section — collapsible */}
      <div className="form-group">
        <button className="btn-toggle upload-toggle" onClick={() => setShowUpload(v => !v)}>
          <span style={{ fontSize: "10px" }}>{showUpload ? "▾" : "▸"}</span>
          📎 Add images, style template, or source document
          <span className="optional-label">optional</span>
        </button>

        {showUpload && (
          <div className="upload-panel">
            <div
              className={`dropzone-inline ${dragging ? "dragover" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
              onClick={() => inputRef.current?.click()}
            >
              <input ref={inputRef} type="file" multiple accept={ACCEPTED}
                style={{ display: "none" }} onChange={e => e.target.files && addFiles(e.target.files)} />
              <span className="dropzone-icon-sm">⬆️</span>
              <span className="dropzone-text-sm">Drop files or click to browse</span>
              <span className="dropzone-hint-sm">Images: JPG PNG WebP · Templates: PPTX · Documents: PDF DOCX TXT MD</span>
            </div>

            {uploadFiles.length > 0 && (
              <>
                <div className="file-list" style={{ marginTop: "10px" }}>
                  {uploadFiles.map(f => (
                    <div key={f.name} className="file-item">
                      <span className="file-icon">
                        {getFileType(f.name) === "image" ? "🖼️" : getFileType(f.name) === "document" ? "📄" : "📊"}
                      </span>
                      <span className="file-name">{f.name}</span>
                      <span className="file-badge">{getFileType(f.name)}</span>
                      <button className="file-remove" onClick={() => removeFile(f.name)}>✕</button>
                    </div>
                  ))}
                </div>
                <button className="btn-upload-files" onClick={handleUpload} disabled={uploading}>
                  {uploading ? "Uploading..." : `Upload ${uploadFiles.length} file${uploadFiles.length > 1 ? "s" : ""}`}
                </button>
              </>
            )}

            {uploadError && <p className="error-msg" style={{ marginTop: "8px" }}>{uploadError}</p>}

            {(uploadedFiles.images.length > 0 || uploadedFiles.templates.length > 0 || uploadedFiles.documents.length > 0) && (
              <div className="uploaded-summary">
                {uploadedFiles.images.length > 0 && (
                  <p className="form-hint">✓ {uploadedFiles.images.length} image{uploadedFiles.images.length > 1 ? "s" : ""} ready for placement</p>
                )}
                {uploadedFiles.documents.length > 0 && (
                  <p className="form-hint">✓ {uploadedFiles.documents.length} document{uploadedFiles.documents.length > 1 ? "s" : ""} ready — their content will be used to generate your slides</p>
                )}
                {uploadedFiles.templates.length > 0 && (
                  <>
                    <p className="form-hint">✓ Style template uploaded</p>
                    <select className="form-select" style={{ marginTop: "8px" }} value={templateFile} onChange={e => setTemplateFile(e.target.value)}>
                      <option value="">— Use selected theme —</option>
                      {uploadedFiles.templates.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="error-msg">{error}</p>}

      <div className="form-actions">
        {onBack && <button className="btn-secondary" onClick={onBack}>↺ Reset</button>}
        <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "Sending to AI…" : "Generate presentation →"}
        </button>
      </div>
    </div>
  )
}
