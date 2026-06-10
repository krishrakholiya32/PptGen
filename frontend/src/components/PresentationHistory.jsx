import { useState, useEffect, useImperativeHandle, forwardRef } from "react"

const API  = import.meta.env.VITE_API_URL || "http://localhost:8000/api"
const BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:8000"

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export const PresentationHistory = forwardRef(function PresentationHistory({ onLoad }, ref) {
  const [history, setHistory] = useState([])
  const [open, setOpen]       = useState(false)

  const load = async () => {
    try {
      const res  = await fetch(`${API}/history`)
      const data = await res.json()
      setHistory(data.history || [])
    } catch {}
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (open) load() }, [open])

  // Expose refresh to parent
  useImperativeHandle(ref, () => ({ refresh: load }))

  const handleDelete = async (job_id, e) => {
    e.stopPropagation()
    await fetch(`${API}/history/${job_id}`, { method: "DELETE" })
    setHistory(h => h.filter(e => e.job_id !== job_id))
  }

  if (history.length === 0) return null

  return (
    <div className="history-wrap">
      <button className="history-toggle" onClick={() => setOpen(o => !o)}>
        🕑 Recent presentations
        {history.length > 0 && <span className="history-badge">{history.length}</span>}
        <span style={{ marginLeft: "auto" }}>{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="history-list">
          {history.length === 0 ? (
            <p className="history-empty">No presentations yet.</p>
          ) : history.map(entry => (
            <div key={entry.job_id} className={`history-item${entry.expired?" expired":""}`}>
              <div className="history-icon">{entry.expired?"🗑️":"📊"}</div>
              <div className="history-info">
                <p className="history-prompt">{entry.prompt}</p>
                <p className="history-meta">
                  {entry.slide_count} slides · {timeAgo(entry.created_at)}
                  {entry.expired && <span className="history-expired-tag"> · expired</span>}
                </p>
              </div>
              <div className="history-actions">
                {!entry.expired && (
                  <a href={`${BASE}${entry.download_url}`} download className="btn-history-dl"
                    onClick={e => e.stopPropagation()}>⬇</a>
                )}
                <button className="btn-history-del" onClick={e => handleDelete(entry.job_id, e)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
