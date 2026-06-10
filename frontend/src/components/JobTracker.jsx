import { useState, useEffect } from "react"
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

  useEffect(() => { setActiveJobId(jobId) }, [jobId])

  useEffect(() => {
    if (!activeJobId) return
    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`${API}/job/${activeJobId}`)
        const data = await res.json()
        setJob(data)
        if (data.status === "done") {
          clearInterval(interval)
          if (onHistoryRefresh) onHistoryRefresh()
        }
        if (data.status === "error") clearInterval(interval)
      } catch (e) { console.error("Polling error:", e) }
    }, 1500)
    return () => clearInterval(interval)
  }, [activeJobId])

  const handleRerender = (newJobId) => {
    setActiveJobId(newJobId)
    setJob({ status: "pending", progress: 0, message: "Re-rendering…" })
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
            <button className="btn-preview-toggle" onClick={() => setShowPreview(v => !v)}>
              {showPreview ? "▴ Hide slide preview" : "▾ View all slides"}
            </button>
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
          </>
        )}

        <div className="tracker-actions">
          <button className="btn-secondary" onClick={onReset}>← Generate another</button>
        </div>
      </div>

      {isDone && showPreview && (
        <div className="card preview-card">
          <SlidePreview jobId={activeJobId} onRerender={handleRerender} />
        </div>
      )}
    </div>
  )
}
