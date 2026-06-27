import { useState, useEffect, useRef } from "react"
import { SlidePreview } from "./SlidePreview"

const API  = import.meta.env.VITE_API_URL || "http://localhost:8000/api"
const BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:8000"

const STEPS = [
  { at: 5,   label: "Job queued" },
  { at: 10,  label: "Extracting style…" },
  { at: 28,  label: "Planning slide structure with AI…" },
  { at: 55,  label: "Fetching images for slides…" },
  { at: 70,  label: "Rendering presentation…" },
  { at: 90,  label: "Finalizing…" },
  { at: 100, label: "Presentation ready!" },
]

export function JobTracker({ jobId, onReset, onHistoryRefresh }) {
  const [job, setJob]                 = useState({ status: "pending", progress: 0, message: "Starting…" })
  const [activeJobId, setActiveJobId] = useState(jobId)
  const [showPreview, setShowPreview] = useState(false)
  const [liveSlides, setLiveSlides]   = useState(null)
  const [copied, setCopied]           = useState(false)
  const esRef   = useRef(null)
  const pollRef = useRef(null)
  const planRef = useRef(null)

  useEffect(() => { setActiveJobId(jobId) }, [jobId])

  // Update URL param so the job can be restored on reload
  useEffect(() => {
    if (!activeJobId) return
    const url = new URL(window.location.href)
    url.searchParams.set("job", activeJobId)
    window.history.replaceState({}, "", url.toString())
  }, [activeJobId])

  // SSE with polling fallback
  useEffect(() => {
    if (!activeJobId) return

    let sse = null
    let fallback = null
    let sseOk = false

    const applyData = (data) => {
      setJob(data)
      if (data.status === "done") {
        if (onHistoryRefresh) onHistoryRefresh()
        stopAll()
      }
      if (data.status === "error") stopAll()
    }

    const stopAll = () => {
      if (sse) { try { sse.close() } catch {} }
      if (fallback) clearInterval(fallback)
      if (planRef.current) clearInterval(planRef.current)
    }

    // Try SSE first
    try {
      sse = new EventSource(`${API}/stream/${activeJobId}`)
      esRef.current = sse
      sse.onmessage = (e) => {
        sseOk = true
        if (fallback) { clearInterval(fallback); fallback = null }
        try { applyData(JSON.parse(e.data)) } catch {}
      }
      sse.onerror = () => {
        if (!sseOk) {
          // SSE failed, fall back to polling
          try { sse.close() } catch {}
          fallback = setInterval(async () => {
            try {
              const data = await fetch(`${API}/job/${activeJobId}`).then(r => r.json())
              applyData(data)
            } catch {}
          }, 3000)
        }
      }
    } catch {
      fallback = setInterval(async () => {
        try {
          const data = await fetch(`${API}/job/${activeJobId}`).then(r => r.json())
          applyData(data)
        } catch {}
      }, 3000)
    }

    return () => stopAll()
  }, [activeJobId])

  // Live slide preview — poll slide-plan once progress >= 55
  useEffect(() => {
    if (job.progress < 55 || job.status === "error") return
    if (liveSlides) return  // already loaded

    const tryFetch = async () => {
      try {
        const d = await fetch(`${API}/slide-plan/${activeJobId}`).then(r => r.ok ? r.json() : null)
        if (d) {
          setLiveSlides(d)
          if (planRef.current) clearInterval(planRef.current)
        }
      } catch {}
    }

    tryFetch()
    planRef.current = setInterval(tryFetch, 4000)
    return () => clearInterval(planRef.current)
  }, [job.progress, activeJobId])

  const handleRerender = (newJobId) => {
    setActiveJobId(newJobId)
    setJob({ status: "pending", progress: 0, message: "Re-rendering…" })
    setLiveSlides(null)
  }

  const handleShare = () => {
    const url = new URL(window.location.href)
    url.searchParams.set("job", activeJobId)
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const isDone  = job.status === "done"
  const isError = job.status === "error"

  return (
    <div className="tracker-outer">
      <div className="card tracker-card">
        {isDone ? (
          <div className="done-hero">
            <div className="done-icon-wrap">📊</div>
            <p className="done-title">Your presentation is ready!</p>
            <p className="done-sub">Download and open in PowerPoint or Google Slides</p>
            <a href={`${BASE}${job.download_url}`} download className="btn-download">
              ⬇ Download PowerPoint
            </a>
            <div className="done-secondary-actions">
              <button className="btn-action-sm" onClick={handleShare}>
                {copied ? "✓ Copied!" : "🔗 Share link"}
              </button>
              <button className="btn-action-sm" onClick={handlePrint}>
                🖨 Export PDF
              </button>
              <button className="btn-preview-toggle" onClick={() => setShowPreview(v => !v)}>
                {showPreview ? "▴ Hide slides" : "▾ View all slides"}
              </button>
            </div>
          </div>
        ) : isError ? (
          <>
            <div className="card-header">
              <h2 className="card-title">Something went wrong</h2>
            </div>
            <div className="error-box">
              <p>{job.message}</p>
              <p className="error-hint">Check your API key in the .env file and try again.</p>
            </div>
          </>
        ) : (
          <>
            <div className="card-header">
              <h2 className="card-title">Generating your presentation…</h2>
              <p className="card-sub">This usually takes 20–60 seconds.</p>
            </div>
            <div className="progress-wrap">
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${job.progress}%` }} />
              </div>
              <p className="progress-pct">{job.progress}%</p>
              <p className="progress-label">{job.message}</p>
            </div>
            <div className="timeline">
              {STEPS.map((s, i) => (
                <div
                  key={i}
                  className={`timeline-step ${job.progress >= s.at ? "active" : ""} ${
                    job.progress < s.at && (i === 0 || job.progress >= STEPS[i-1]?.at) ? "current" : ""
                  }`}
                >
                  <div className="timeline-dot">{job.progress > s.at ? "✓" : "○"}</div>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>

            {/* Live slide preview while generating */}
            {liveSlides && (
              <div className="live-preview-wrap">
                <p className="live-preview-label">📑 Slides ready — rendering PPTX…</p>
                <div className="card preview-card" style={{ marginTop: "12px" }}>
                  <SlidePreview jobId={activeJobId} onRerender={handleRerender} prefetchedPlan={liveSlides} readOnly />
                </div>
              </div>
            )}
          </>
        )}

        <div className="tracker-actions">
          <button className="btn-secondary" onClick={onReset}>← Generate another</button>
        </div>
      </div>

      {isDone && showPreview && (
        <div className="card preview-card print-target">
          <SlidePreview jobId={activeJobId} onRerender={handleRerender} />
        </div>
      )}
    </div>
  )
}
