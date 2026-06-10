import { useState, useEffect, useRef } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

export function SlideCountRecommender({ prompt, onRecommend }) {
  const [rec, setRec]         = useState(null)
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)
  const loadingRef = useRef(null)

  useEffect(() => {
    if (!prompt || prompt.length < 20) {
      setVisible(false)
      setLoading(false)
      clearTimeout(timerRef.current)
      clearTimeout(loadingRef.current)
      return
    }

    // Show loading dot after 400ms
    clearTimeout(loadingRef.current)
    loadingRef.current = setTimeout(() => setLoading(true), 400)

    // Fetch recommendation after 900ms
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`${API}/recommend-slides`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        })
        const data = await res.json()
        setRec(data)
        setVisible(true)
      } catch {}
      finally {
        setLoading(false)
      }
    }, 900)

    return () => {
      clearTimeout(timerRef.current)
      clearTimeout(loadingRef.current)
    }
  }, [prompt])

  if (loading && !visible) return (
    <div className="slide-rec-banner slide-rec-loading">
      <span className="slide-rec-dot" />
      <span className="slide-rec-text" style={{ opacity: 0.6 }}>Analyzing prompt…</span>
    </div>
  )

  if (!visible || !rec) return null

  return (
    <div className="slide-rec-banner">
      <span className="slide-rec-icon">💡</span>
      <span className="slide-rec-text">
        AI suggests <strong>{rec.recommended} slides</strong> for this topic
      </span>
      <button className="slide-rec-apply" onClick={() => { onRecommend(rec.recommended); setVisible(false) }}>
        Apply
      </button>
      <button className="slide-rec-dismiss" onClick={() => setVisible(false)}>✕</button>
    </div>
  )
}
