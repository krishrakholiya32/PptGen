import { useState, useEffect, useRef } from "react"

const API  = import.meta.env.VITE_API_URL || "http://localhost:8000/api"
const BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:8000"

// ── Mini slide (thumbnail + full editor view) ─────────────────────────────────

function MiniSlide({ slide, style, large = false }) {
  const bg     = style?.bg     || "#1A1A2E"
  const accent = style?.accent || "#E94560"
  const text   = style?.text   || "#EAEAEA"
  const layout = slide.layout_type || "title_content"

  const isDark  = (() => { const h = bg.replace("#",""); const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16); return (0.299*r+0.587*g+0.114*b)<128 })()
  const muted   = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)"
  const surface = isDark ? "rgba(255,255,255,0.08)"  : "rgba(0,0,0,0.06)"

  const fs = large ? { title:"22px", bullet:"13px", sub:"11px", footer:"9px", tag:"10px" }
                   : { title:"10px", bullet:"7px",  sub:"6px",  footer:"5px",  tag:"6px"  }

  const base = { width:"100%", aspectRatio:"16/9", background:bg, borderRadius: large?"10px":"6px",
    overflow:"hidden", position:"relative", fontFamily:"inherit", boxSizing:"border-box", fontSize:0 }

  const bullets = (slide.bullets||[]).slice(0,4)
  const imgUrl  = slide.image_url ? `${BASE}${slide.image_url}` : null

  const Img = ({ style:s }) => {
    const [err,setErr] = useState(false)
    if (imgUrl && !err) return <img src={imgUrl} onError={()=>setErr(true)} style={{objectFit:"cover",display:"block",...s}} alt="" />
    return <div style={{background:`linear-gradient(135deg,${accent}28,${accent}0a)`,border:`1px solid ${accent}33`,display:"flex",alignItems:"center",justifyContent:"center",...s}}><span style={{fontSize:"24px",opacity:0.3}}>🖼</span></div>
  }

  const BulletList = ({ maxW="100%", items=bullets }) => (
    <div style={{width:maxW,display:"flex",flexDirection:"column",gap: large?"6px":"2.5px"}}>
      {items.map((b,i)=>(
        <div key={i} style={{display:"flex",gap:"4px",alignItems:"flex-start"}}>
          <span style={{color:accent,fontSize:fs.bullet,flexShrink:0,lineHeight:1.4,marginTop:"1px"}}>●</span>
          <span style={{color:text,fontSize:fs.bullet,lineHeight:1.45,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:large?3:2,WebkitBoxOrient:"vertical"}}>{b}</span>
        </div>
      ))}
    </div>
  )

  const Title = ({ size=fs.title, color=text, align="left" }) => (
    <div style={{fontSize:size,fontWeight:700,color,lineHeight:1.25,marginBottom:"3px",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",textAlign:align}}>{slide.title}</div>
  )

  const AccentBar = ({ vertical=false }) => vertical
    ? <div style={{position:"absolute",left:0,top:0,width:large?"5px":"3px",height:"100%",background:accent}} />
    : <div style={{position:"absolute",top:0,left:0,right:0,height:large?"5px":"3px",background:accent}} />

  const Underline = () => <div style={{width:"30%",height:"1.5px",background:accent,marginTop:"3px",marginBottom:large?"8px":"5px"}} />

  const Footer = () => (
    <div style={{position:"absolute",bottom:0,left:0,right:0,height:large?"18px":"10px",background:surface,
      borderTop:`1px solid ${accent}33`,display:"flex",alignItems:"center",padding:"0 8px",justifyContent:"space-between"}}>
      <span style={{fontSize:fs.footer,color:muted,overflow:"hidden",whiteSpace:"nowrap",maxWidth:"80%"}}>{slide.title}</span>
      <span style={{fontSize:fs.footer,color:accent,fontWeight:700}}>{slide.slide_number}</span>
    </div>
  )

  if (layout==="title_slide") return (
    <div style={base}>
      <AccentBar vertical />
      <div style={{position:"absolute",left:"3%",bottom:"12%",right:"4%",height:"48%",background:surface,borderRadius:"4px"}} />
      <div style={{position:"absolute",left:"3%",bottom:"60%",right:"4%",height:"2px",background:accent}} />
      <div style={{position:"absolute",left:"5%",bottom:"28%",right:"5%",padding:"0 4px"}}>
        <Title size={large?"28px":fs.title} />
        {slide.subtitle && <div style={{fontSize:fs.sub,color:accent,marginTop:"4px",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>{slide.subtitle}</div>}
      </div>
      <div style={{position:"absolute",bottom:"14%",left:"5%",width:"20%",height:"2px",background:accent}} />
      <Footer />
    </div>
  )

  if (layout==="image_right") return (
    <div style={base}>
      <AccentBar />
      <Img style={{position:"absolute",right:"2%",top:"14%",width:"44%",bottom:"12%"}} />
      <div style={{position:"absolute",left:"3%",top:"14%",width:"50%",padding:"4px 4px 0 0"}}>
        <Title /><Underline /><BulletList maxW="95%" />
      </div>
      <Footer />
    </div>
  )

  if (layout==="image_left") return (
    <div style={base}>
      <AccentBar />
      <Img style={{position:"absolute",left:"2%",top:"14%",width:"44%",bottom:"12%"}} />
      <div style={{position:"absolute",right:"2%",top:"14%",width:"50%",padding:"4px 0 0 4px"}}>
        <Title /><Underline /><BulletList maxW="95%" />
      </div>
      <Footer />
    </div>
  )

  if (layout==="image_top") return (
    <div style={base}>
      <Img style={{position:"absolute",top:0,left:0,right:0,height:"41%"}} />
      <div style={{position:"absolute",top:"33%",left:0,right:0,height:"9%",background:"rgba(0,0,0,0.72)",display:"flex",alignItems:"center",padding:"0 5px"}}>
        <span style={{fontSize:large?"14px":fs.tag,fontWeight:700,color:"#fff",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{slide.title}</span>
      </div>
      <div style={{position:"absolute",top:"41%",left:0,right:0,height:"2px",background:accent}} />
      <div style={{position:"absolute",top:"44%",left:"3%",right:"3%",bottom:"10%"}}><BulletList /></div>
      <Footer />
    </div>
  )

  if (layout==="image_bottom") return (
    <div style={base}>
      <AccentBar />
      <div style={{position:"absolute",left:"3%",top:"12%",right:"3%",height:"43%"}}>
        <Title /><Underline /><BulletList />
      </div>
      <div style={{position:"absolute",left:0,right:0,top:"58%",height:"2px",background:accent}} />
      <Img style={{position:"absolute",left:0,right:0,top:"60%",bottom:0}} />
    </div>
  )

  if (layout==="full_image") return (
    <div style={base}>
      <Img style={{position:"absolute",inset:0}} />
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:"45%",background:"rgba(0,0,0,0.82)",padding:"5px 8px"}}>
        <div style={{width:"100%",height:"1.5px",background:accent,marginBottom:"4px"}} />
        <Title size={large?"16px":fs.title} color="#fff" />
        <BulletList />
      </div>
    </div>
  )

  if (layout==="two_column") {
    const half = Math.ceil(bullets.length / 2)
    return (
      <div style={base}>
        <AccentBar />
        <div style={{position:"absolute",left:"3%",top:"12%",right:"3%",bottom:"10%"}}>
          <Title /><Underline />
          <div style={{display:"flex",gap:"2%",marginTop:"2px"}}>
            <div style={{flex:1,background:surface,borderRadius:"3px",padding:"4px",overflow:"hidden"}}>
              <div style={{fontSize:fs.sub,fontWeight:700,color:text,textAlign:"center",marginBottom:"3px"}}>Key Points</div>
              <BulletList items={bullets.slice(0, half)} />
            </div>
            <div style={{flex:1,background:surface,borderRadius:"3px",padding:"4px",overflow:"hidden"}}>
              <div style={{fontSize:fs.sub,fontWeight:700,color:text,textAlign:"center",marginBottom:"3px"}}>Details</div>
              <BulletList items={bullets.slice(half)} />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (layout==="section_break") return (
    <div style={base}>
      <AccentBar vertical />
      <div style={{position:"absolute",left:"6%",top:"22%",right:"5%"}}>
        <div style={{fontSize:large?"32px":"14px",fontWeight:800,color:accent,lineHeight:1.2,marginBottom:"5px",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{slide.title}</div>
        {slide.subtitle && <div style={{fontSize:fs.sub,color:muted,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{slide.subtitle}</div>}
      </div>
      <Footer />
    </div>
  )

  // title_content / accent_block / default
  return (
    <div style={base}>
      <AccentBar />
      {layout==="accent_block" && <div style={{position:"absolute",right:0,top:"13%",bottom:"10%",width:"9%",background:surface,borderLeft:`2px solid ${accent}`}} />}
      <div style={{position:"absolute",left:"3%",top:"12%",right:layout==="accent_block"?"12%":"3%",bottom:"10%",padding:"4px 0"}}>
        <Title /><Underline /><BulletList />
      </div>
      <Footer />
    </div>
  )
}


// ── Slide editor modal (PowerPoint-style) ────────────────────────────────────

function SlideEditorModal({ slide, index, style, onSave, onClose, onRegenerate }) {
  const [title,    setTitle]    = useState(slide.title || "")
  const [bullets,  setBullets]  = useState(slide.bullets || [])
  const [notes,    setNotes]    = useState(slide.speaker_notes || "")
  const [regenInst, setRegenInst] = useState("")
  const [tab, setTab]           = useState("edit") // "edit" | "regen" | "notes"

  const addBullet    = ()      => setBullets(b => [...b, ""])
  const removeBullet = (i)     => setBullets(b => b.filter((_,j) => j!==i))
  const updateBullet = (i, v)  => setBullets(b => b.map((x,j) => j===i ? v : x))

  const handleSave = () => onSave(index, { title, bullets: bullets.filter(b=>b.trim()), speaker_notes: notes })

  return (
    <div className="slide-editor-overlay" onClick={onClose}>
      <div className="slide-editor-modal" onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="sem-header">
          <span className="sem-title">Slide {index+1} — {slide.layout_type?.replace(/_/g," ")}</span>
          <button className="sem-close" onClick={onClose}>✕</button>
        </div>

        {/* Body: preview left, editor right */}
        <div className="sem-body">

          {/* Left: live preview */}
          <div className="sem-preview">
            <MiniSlide slide={{...slide, title, bullets, speaker_notes:notes}} style={style} large={true} />
            <p className="sem-preview-hint">Live preview updates as you type</p>
          </div>

          {/* Right: editor */}
          <div className="sem-editor">
            <div className="sem-tabs">
              {[["edit","✏️ Edit"],["regen","🔄 Regenerate"],["notes","📝 Notes"]].map(([id,label])=>(
                <button key={id} className={`sem-tab ${tab===id?"active":""}`} onClick={()=>setTab(id)}>{label}</button>
              ))}
            </div>

            {tab==="edit" && (
              <div className="sem-fields">
                <div className="sem-field">
                  <label className="sem-label">Title</label>
                  <input className="sem-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Slide title" />
                </div>
                <div className="sem-field">
                  <label className="sem-label">Bullet points</label>
                  <div className="sem-bullets">
                    {bullets.map((b,i)=>(
                      <div key={i} className="sem-bullet-row">
                        <span className="sem-bullet-dot">●</span>
                        <input
                          className="sem-bullet-input"
                          value={b}
                          onChange={e=>updateBullet(i,e.target.value)}
                          placeholder={`Bullet point ${i+1}`}
                        />
                        <button className="sem-bullet-del" onClick={()=>removeBullet(i)}>✕</button>
                      </div>
                    ))}
                    <button className="sem-bullet-add" onClick={addBullet}>+ Add bullet point</button>
                  </div>
                </div>
              </div>
            )}

            {tab==="regen" && (
              <div className="sem-fields">
                <div className="sem-field">
                  <label className="sem-label">Regenerate this slide with AI</label>
                  <p className="sem-hint">Optionally give a direction, then click Regenerate.</p>
                  <textarea
                    className="sem-textarea"
                    rows={3}
                    placeholder="e.g. 'make it more concise', 'add statistics', 'focus on benefits'"
                    value={regenInst}
                    onChange={e=>setRegenInst(e.target.value)}
                  />
                </div>
                <button className="sem-regen-btn" onClick={()=>{ onRegenerate(index,regenInst); onClose() }}>
                  🔄 Regenerate slide
                </button>
              </div>
            )}

            {tab==="notes" && (
              <div className="sem-fields">
                <div className="sem-field">
                  <label className="sem-label">Speaker notes</label>
                  <textarea
                    className="sem-textarea"
                    rows={6}
                    placeholder="Notes for the presenter..."
                    value={notes}
                    onChange={e=>setNotes(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sem-footer">
          <button className="sem-cancel" onClick={onClose}>Cancel</button>
          {tab !== "regen" && (
            <button className="sem-save" onClick={handleSave}>Save & Re-render →</button>
          )}
        </div>
      </div>
    </div>
  )
}


// ── Slide thumbnail card ───────────────────────────────────────────────────────

function SlideCard({ slide, index, total, isSelected, onClick, onEdit, onMoveUp, onMoveDown, style, readOnly }) {
  return (
    <div
      className={`slide-card ${isSelected ? "selected" : ""}`}
      onClick={() => onClick(index)}
      title={readOnly ? undefined : "Click to open editor"}
    >
      <div className="slide-card-num">#{index + 1}</div>
      <div className="slide-mini-preview">
        <MiniSlide slide={slide} style={style} />
      </div>
      <div className="slide-card-label">{slide.title || "Untitled"}</div>
      {!readOnly && (
        <div className="slide-card-actions">
          <button className="slide-card-move-btn" disabled={index === 0}
            onClick={e => { e.stopPropagation(); onMoveUp(index) }} title="Move up">↑</button>
          <button className="slide-card-move-btn" disabled={index === total - 1}
            onClick={e => { e.stopPropagation(); onMoveDown(index) }} title="Move down">↓</button>
          <button className="slide-card-edit-btn" onClick={e => { e.stopPropagation(); onEdit(index) }}>
            ✏️
          </button>
        </div>
      )}
    </div>
  )
}


// ── Inline slide editor (PowerPoint-style, no modal) ─────────────────────────

function InlineSlideEditor({ slide, index, style, onSave, onClose, onRegenerate }) {
  const [title,     setTitle]     = useState(slide.title || "")
  const [bullets,   setBullets]   = useState(slide.bullets || [])
  const [notes,     setNotes]     = useState(slide.speaker_notes || "")
  const [regenInst, setRegenInst] = useState("")
  const [tab,       setTab]       = useState("edit")

  const addBullet    = ()     => setBullets(b => [...b, ""])
  const removeBullet = (i)    => setBullets(b => b.filter((_, j) => j !== i))
  const updateBullet = (i, v) => setBullets(b => b.map((x, j) => j === i ? v : x))
  const handleSave   = ()     => onSave(index, { title, bullets: bullets.filter(b => b.trim()), speaker_notes: notes })

  const liveSlide = { ...slide, title, bullets, speaker_notes: notes }

  return (
    <div className="inline-editor">
      <div className="inline-editor-header">
        <span className="inline-editor-title">Slide {index + 1} — Edit</span>
        <button className="inline-editor-close" onClick={onClose}>✕ Close</button>
      </div>

      <div className="inline-editor-body">
        {/* Left: large live preview */}
        <div className="inline-editor-preview">
          <MiniSlide slide={liveSlide} style={style} large={true} />
          <p className="inline-editor-hint">Preview updates as you type</p>
        </div>

        {/* Right: editable fields */}
        <div className="inline-editor-fields">
          <div className="inline-editor-tabs">
            {[["edit","✏️ Content"], ["notes","📝 Notes"], ["regen","🔄 AI Rewrite"]].map(([id, label]) => (
              <button key={id} className={`inline-tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          {tab === "edit" && (
            <>
              <div className="inline-field">
                <label className="inline-label">Title</label>
                <input className="inline-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Slide title" />
              </div>
              <div className="inline-field">
                <label className="inline-label">Bullet points</label>
                <div className="inline-bullets">
                  {bullets.map((b, i) => (
                    <div key={i} className="inline-bullet-row">
                      <span className="inline-bullet-dot">●</span>
                      <input
                        className="inline-bullet-input"
                        value={b}
                        onChange={e => updateBullet(i, e.target.value)}
                        placeholder={`Bullet ${i + 1}`}
                      />
                      <button className="inline-bullet-del" onClick={() => removeBullet(i)}>✕</button>
                    </div>
                  ))}
                  <button className="inline-bullet-add" onClick={addBullet}>+ Add bullet</button>
                </div>
              </div>
              <div className="inline-footer">
                <button className="inline-cancel" onClick={onClose}>Cancel</button>
                <button className="inline-save" onClick={handleSave}>Save & Re-render →</button>
              </div>
            </>
          )}

          {tab === "notes" && (
            <>
              <div className="inline-field" style={{ flex: 1 }}>
                <label className="inline-label">Speaker notes</label>
                <textarea
                  className="inline-textarea"
                  rows={8}
                  placeholder="Notes for the presenter…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
              <div className="inline-footer">
                <button className="inline-cancel" onClick={onClose}>Cancel</button>
                <button className="inline-save" onClick={handleSave}>Save & Re-render →</button>
              </div>
            </>
          )}

          {tab === "regen" && (
            <>
              <div className="inline-field">
                <label className="inline-label">Direction (optional)</label>
                <textarea
                  className="inline-textarea"
                  rows={4}
                  placeholder="e.g. 'make it more concise', 'add statistics', 'focus on benefits'"
                  value={regenInst}
                  onChange={e => setRegenInst(e.target.value)}
                />
              </div>
              <div className="inline-footer">
                <button className="inline-cancel" onClick={onClose}>Cancel</button>
                <button className="inline-save" onClick={() => { onRegenerate(index, regenInst); onClose() }}>
                  🔄 Regenerate with AI →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}


// ── Main export ───────────────────────────────────────────────────────────────

export function SlidePreview({ jobId, onRerender, prefetchedPlan = null, readOnly = false }) {
  const [plan,         setPlan]         = useState(prefetchedPlan)
  const [loading,      setLoading]      = useState(!prefetchedPlan)
  const [selected,     setSelected]     = useState(0)
  const [editingIndex, setEditingIndex] = useState(null)
  const [regenStatus,  setRegenStatus]  = useState("")
  const [localSlides,  setLocalSlides]  = useState(null)

  useEffect(() => {
    if (prefetchedPlan) { setPlan(prefetchedPlan); setLoading(false); return }
    if (!jobId) return
    fetch(`${API}/slide-plan/${jobId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPlan(d) })
      .finally(() => setLoading(false))
  }, [jobId, prefetchedPlan])

  const pollJob = (newJobId) => {
    setRegenStatus("Regenerating…")
    const interval = setInterval(async () => {
      try {
        const data = await fetch(`${API}/job/${newJobId}`).then(r=>r.json())
        setRegenStatus(data.message)
        if (data.status === "done") {
          clearInterval(interval)
          setRegenStatus("")
          onRerender(newJobId)
          const d2 = await fetch(`${API}/slide-plan/${newJobId}`).then(r=>r.ok?r.json():null)
          if (d2) setPlan(d2)
        }
        if (data.status === "error") { clearInterval(interval); setRegenStatus("Error: " + data.message) }
      } catch {}
    }, 3000)
    setTimeout(() => clearInterval(interval), 180000)
  }

  const handleEdit = async (slideIndex, changes) => {
    try {
      const data = await fetch(`${API}/edit-slide`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ job_id: jobId, slide_index: slideIndex, ...changes }),
      }).then(r=>r.json())
      pollJob(data.job_id)
    } catch (e) { setRegenStatus("Error: " + e.message) }
  }

  const handleRegenerate = async (slideIndex, instruction) => {
    try {
      const data = await fetch(`${API}/regenerate-slide`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ job_id: jobId, slide_index: slideIndex, instruction }),
      }).then(r=>r.json())
      pollJob(data.job_id)
    } catch (e) { setRegenStatus("Error: " + e.message) }
  }

  const handleMoveUp = async (index) => {
    if (index === 0) return
    const newOrder = slides.map((_, i) => i)
    ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    try {
      const data = await fetch(`${API}/reorder-slides`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ job_id: jobId, slide_order: newOrder }),
      }).then(r=>r.json())
      pollJob(data.job_id)
      // Optimistically reorder local view
      const reordered = [...slides]
      ;[reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]]
      setLocalSlides(reordered)
    } catch (e) { setRegenStatus("Error: " + e.message) }
  }

  const handleMoveDown = async (index) => {
    if (index === slides.length - 1) return
    const newOrder = slides.map((_, i) => i)
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    try {
      const data = await fetch(`${API}/reorder-slides`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ job_id: jobId, slide_order: newOrder }),
      }).then(r=>r.json())
      pollJob(data.job_id)
      const reordered = [...slides]
      ;[reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]]
      setLocalSlides(reordered)
    } catch (e) { setRegenStatus("Error: " + e.message) }
  }

  if (loading) return <div className="preview-loading">Loading slide preview…</div>
  if (!plan)   return null

  const slideStyle   = plan.style || {}
  const slides       = localSlides || plan.slides || []
  const editSlide    = editingIndex !== null ? slides[editingIndex] : null

  return (
    <div className="slide-preview-wrap">
      <div className="preview-header">
        <h3 className="preview-title">📑 {plan.title}</h3>
        <span className="preview-count">{slides.length} slides</span>
      </div>

      {regenStatus && <div className="regen-status">{regenStatus}</div>}

      <div className="slides-grid">
        {slides.map((slide, i) => (
          <SlideCard
            key={i} slide={slide} index={i} total={slides.length}
            isSelected={selected === i}
            onClick={i => { setSelected(i); if (!readOnly) setEditingIndex(editingIndex === i ? null : i) }}
            onEdit={i => setEditingIndex(editingIndex === i ? null : i)}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            style={slideStyle}
            readOnly={readOnly}
          />
        ))}
      </div>

      {/* Inline PowerPoint-style editor — no modal */}
      {!readOnly && editSlide && (
        <InlineSlideEditor
          slide={editSlide}
          index={editingIndex}
          style={slideStyle}
          onSave={(idx, changes) => { handleEdit(idx, changes); setEditingIndex(null) }}
          onClose={() => setEditingIndex(null)}
          onRegenerate={(idx, inst) => { handleRegenerate(idx, inst); setEditingIndex(null) }}
        />
      )}
    </div>
  )
}
