import { useState, useEffect } from "react"
import type { Slide, SlidePlan } from "../types"

const API  = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

const LAYOUT_ICON: Record<string, string> = {
  title_slide:   "🎯",
  title_content: "📋",
  image_right:   "🖼",
  image_left:    "🖼",
  image_top:     "🖼",
  image_bottom:  "🖼",
  full_image:    "🌅",
  two_column:    "⬛",
  section_break: "📌",
  accent_block:  "🟦",
}

interface SlideChanges {
  title: string
  bullets: string[]
  speaker_notes: string
}

// ── Slide editor panel ────────────────────────────────────────────────────────

interface SlideEditorProps {
  slide: Slide
  index: number
  total: number
  onSave: (index: number, changes: SlideChanges) => void
  onRegenerate: (index: number, instruction: string) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
}

function SlideEditor({ slide, index, total, onSave, onRegenerate, onMoveUp, onMoveDown }: SlideEditorProps) {
  const [title,     setTitle]     = useState(slide.title || "")
  const [bullets,   setBullets]   = useState<string[]>(slide.bullets || [])
  const [notes,     setNotes]     = useState(slide.speaker_notes || "")
  const [regenInst, setRegenInst] = useState("")
  const [tab,       setTab]       = useState("edit")
  const [dirty,     setDirty]     = useState(false)

  // Reset when slide changes
  useEffect(() => {
    setTitle(slide.title || "")
    setBullets(slide.bullets || [])
    setNotes(slide.speaker_notes || "")
    setRegenInst("")
    setDirty(false)
    setTab("edit")
  }, [slide])

  const addBullet    = ()               => { setBullets(b => [...b, ""]); setDirty(true) }
  const removeBullet = (i: number)      => { setBullets(b => b.filter((_, j) => j !== i)); setDirty(true) }
  const updateBullet = (i: number, v: string) => { setBullets(b => b.map((x, j) => j === i ? v : x)); setDirty(true) }

  const handleSave = () => onSave(index, { title, bullets: bullets.filter(b => b.trim()), speaker_notes: notes })

  return (
    <div className="sed-panel">
      <div className="sed-header">
        <div className="sed-slide-info">
          <span className="sed-slide-num">Slide {index + 1} of {total}</span>
          <span className="sed-layout-badge">{LAYOUT_ICON[slide.layout_type || ""] || "📋"} {(slide.layout_type || "").replace(/_/g, " ")}</span>
        </div>
        <div className="sed-move-btns">
          <button className="sed-move-btn" disabled={index === 0}            onClick={() => onMoveUp(index)}   title="Move slide up">↑ Move up</button>
          <button className="sed-move-btn" disabled={index === total - 1}    onClick={() => onMoveDown(index)} title="Move slide down">↓ Move down</button>
        </div>
      </div>

      <div className="sed-tabs">
        {[["edit","✏️ Edit Content"],["notes","📝 Speaker Notes"],["regen","🔄 AI Rewrite"]].map(([id, label]) => (
          <button key={id} className={`sed-tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "edit" && (
        <div className="sed-fields">
          <div className="sed-field">
            <label>Slide title</label>
            <input
              className="sed-input"
              value={title}
              onChange={e => { setTitle(e.target.value); setDirty(true) }}
              placeholder="Enter slide title…"
            />
          </div>

          <div className="sed-field">
            <label>Bullet points <span className="sed-label-hint">({bullets.length})</span></label>
            <div className="sed-bullets">
              {bullets.map((b, i) => (
                <div key={i} className="sed-bullet-row">
                  <span className="sed-bullet-num">{i + 1}</span>
                  <input
                    className="sed-bullet-input"
                    value={b}
                    onChange={e => updateBullet(i, e.target.value)}
                    placeholder={`Bullet point ${i + 1}…`}
                  />
                  <button className="sed-bullet-del" onClick={() => removeBullet(i)} title="Remove">✕</button>
                </div>
              ))}
              <button className="sed-add-btn" onClick={addBullet}>+ Add bullet point</button>
            </div>
          </div>

          <div className="sed-footer">
            {dirty && <span className="sed-unsaved">Unsaved changes</span>}
            <button className="sed-save-btn" onClick={handleSave} disabled={!dirty}>
              Save & Re-render →
            </button>
          </div>
        </div>
      )}

      {tab === "notes" && (
        <div className="sed-fields">
          <div className="sed-field" style={{ flex: 1 }}>
            <label>Speaker notes</label>
            <p className="sed-field-hint">These appear below each slide in presenter view.</p>
            <textarea
              className="sed-textarea"
              rows={10}
              placeholder="Add your speaker notes here…"
              value={notes}
              onChange={e => { setNotes(e.target.value); setDirty(true) }}
            />
          </div>
          <div className="sed-footer">
            {dirty && <span className="sed-unsaved">Unsaved changes</span>}
            <button className="sed-save-btn" onClick={handleSave} disabled={!dirty}>Save & Re-render →</button>
          </div>
        </div>
      )}

      {tab === "regen" && (
        <div className="sed-fields">
          <div className="sed-field">
            <label>Regenerate with AI</label>
            <p className="sed-field-hint">Optionally describe how to change this slide, then click Regenerate.</p>
            <textarea
              className="sed-textarea"
              rows={5}
              placeholder="e.g. 'Make it more concise', 'Add real statistics', 'Focus on ROI', 'Use simpler language'…"
              value={regenInst}
              onChange={e => setRegenInst(e.target.value)}
            />
          </div>
          <div className="sed-footer">
            <button className="sed-regen-btn" onClick={() => onRegenerate(index, regenInst)}>
              🔄 Regenerate slide with AI
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


// ── Main export ───────────────────────────────────────────────────────────────

interface SlidePreviewProps {
  jobId: string | null
  onRerender: (jobId: string) => void
  prefetchedPlan?: SlidePlan | null
  readOnly?: boolean
}

export function SlidePreview({ jobId, onRerender, prefetchedPlan = null, readOnly = false }: SlidePreviewProps) {
  const [plan,        setPlan]        = useState<SlidePlan | null>(prefetchedPlan)
  const [loading,     setLoading]     = useState(!prefetchedPlan)
  const [selected,    setSelected]    = useState(0)
  const [regenStatus, setRegenStatus] = useState("")
  const [localSlides, setLocalSlides] = useState<Slide[] | null>(null)

  useEffect(() => {
    if (prefetchedPlan) { setPlan(prefetchedPlan); setLoading(false); return }
    if (!jobId) return
    fetch(`${API}/slide-plan/${jobId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPlan(d) })
      .finally(() => setLoading(false))
  }, [jobId, prefetchedPlan])

  const pollJob = (newJobId: string) => {
    setRegenStatus("Re-rendering…")
    const interval = setInterval(async () => {
      try {
        const data = await fetch(`${API}/job/${newJobId}`).then(r => r.json())
        setRegenStatus(data.message)
        if (data.status === "done") {
          clearInterval(interval)
          setRegenStatus("")
          onRerender(newJobId)
          const d2 = await fetch(`${API}/slide-plan/${newJobId}`).then(r => r.ok ? r.json() : null)
          if (d2) { setPlan(d2); setLocalSlides(null) }
        }
        if (data.status === "error") { clearInterval(interval); setRegenStatus("Error: " + data.message) }
      } catch {}
    }, 3000)
    setTimeout(() => clearInterval(interval), 180000)
  }

  const handleEdit = async (slideIndex: number, changes: SlideChanges) => {
    try {
      const data = await fetch(`${API}/edit-slide`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, slide_index: slideIndex, ...changes }),
      }).then(r => r.json())
      pollJob(data.job_id)
    } catch (e) { setRegenStatus("Error: " + (e instanceof Error ? e.message : String(e))) }
  }

  const handleRegenerate = async (slideIndex: number, instruction: string) => {
    try {
      const data = await fetch(`${API}/regenerate-slide`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, slide_index: slideIndex, instruction }),
      }).then(r => r.json())
      pollJob(data.job_id)
    } catch (e) { setRegenStatus("Error: " + (e instanceof Error ? e.message : String(e))) }
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return
    const newOrder = slides.map((_, i) => i)
    ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    const reordered = [...slides]
    ;[reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]]
    setLocalSlides(reordered)
    setSelected(index - 1)
    try {
      const data = await fetch(`${API}/reorder-slides`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, slide_order: newOrder }),
      }).then(r => r.json())
      pollJob(data.job_id)
    } catch (e) { setRegenStatus("Error: " + (e instanceof Error ? e.message : String(e))) }
  }

  const handleMoveDown = async (index: number) => {
    if (!slides || index === slides.length - 1) return
    const newOrder = slides.map((_, i) => i)
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    const reordered = [...slides]
    ;[reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]]
    setLocalSlides(reordered)
    setSelected(index + 1)
    try {
      const data = await fetch(`${API}/reorder-slides`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, slide_order: newOrder }),
      }).then(r => r.json())
      pollJob(data.job_id)
    } catch (e) { setRegenStatus("Error: " + (e instanceof Error ? e.message : String(e))) }
  }

  if (loading) return <div className="preview-loading">Loading slides…</div>
  if (!plan)   return null

  const slides: Slide[] = localSlides || plan.slides || []

  return (
    <div className="sed-wrap">
      {/* Regen status banner */}
      {regenStatus && (
        <div className="sed-status-banner">
          <span className="sed-status-spinner" />
          {regenStatus}
        </div>
      )}

      <div className="sed-layout">
        {/* ── Left: slide list ── */}
        <div className="sed-sidebar">
          <div className="sed-sidebar-header">
            <span>{slides.length} slides</span>
            <span className="sed-sidebar-title">{plan.title}</span>
          </div>
          <div className="sed-slide-list">
            {slides.map((slide, i) => (
              <button
                key={i}
                className={`sed-slide-item ${selected === i ? "active" : ""}`}
                onClick={() => setSelected(i)}
              >
                <span className="sed-slide-item-num">{i + 1}</span>
                <div className="sed-slide-item-info">
                  <span className="sed-slide-item-title">{slide.title || "Untitled"}</span>
                  <span className="sed-slide-item-meta">
                    {LAYOUT_ICON[slide.layout_type || ""] || "📋"} {(slide.layout_type || "").replace(/_/g, " ")}
                    {slide.bullets?.length ? ` · ${slide.bullets.length} bullets` : ""}
                  </span>
                </div>
                {selected === i && <span className="sed-slide-item-arrow">›</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ── Right: editor ── */}
        <div className="sed-editor-area">
          {readOnly ? (
            <div className="sed-readonly-msg">
              <span>📑</span>
              <p>Generating PPTX… You can edit slides after download.</p>
            </div>
          ) : slides[selected] ? (
            <SlideEditor
              key={selected}
              slide={slides[selected]}
              index={selected}
              total={slides.length}
              onSave={handleEdit}
              onRegenerate={(idx, inst) => handleRegenerate(idx, inst)}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          ) : (
            <div className="sed-readonly-msg"><span>👈</span><p>Select a slide to edit</p></div>
          )}
        </div>
      </div>
    </div>
  )
}
