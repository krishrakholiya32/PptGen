import { useState, useRef, useEffect } from "react"
import { PromptForm } from "./components/PromptForm"
import { JobTracker } from "./components/JobTracker"
import { PresentationHistory } from "./components/PresentationHistory"
import { AuthPage } from "./components/AuthPage"
import "./App.css"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

const STEPS = ["Account", "Configure", "Generate"]

export default function App() {
  const [token,          setToken]          = useState(() => localStorage.getItem("pptgen_token") || null)
  const [user,           setUser]           = useState(null)
  const [sessionId,      setSessionId]      = useState(() => crypto.randomUUID())
  const [uploadedFiles,  setUploadedFiles]  = useState({ images: [], templates: [] })
  const [jobId,          setJobId]          = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get("job") || null
  })
  const [step, setStep] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get("job") ? 3 : 2
  })
  const historyRef = useRef()

  // Validate token and load user on mount
  useEffect(() => {
    if (!token) return
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setUser(d); else handleLogout() })
      .catch(() => {})
  }, [token])

  // Keep backend warm
  useEffect(() => {
    const ping = () => fetch(`${API.replace(/\/api$/, "")}/health`).catch(() => {})
    ping()
    const id = setInterval(ping, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const handleLogin = (newToken) => {
    setToken(newToken)
    setStep(2)
  }

  const handleLogout = () => {
    localStorage.removeItem("pptgen_token")
    setToken(null)
    setUser(null)
  }

  const handleGenerate = (id) => { setJobId(id); setStep(3) }

  const handleReset = () => {
    setSessionId(crypto.randomUUID())
    setUploadedFiles({ images: [], templates: [] })
    setJobId(null)
    setStep(2)
  }

  const handleHistoryRefresh = () => {
    if (historyRef.current) historyRef.current.refresh()
  }

  if (!token) return <AuthPage onLogin={handleLogin} />

  return (
    <div className="app">
      <header className="app-header">
        <div style={{ display: "flex", alignItems: "center" }}>
          <div className="logo">
            <div className="logo-mark">P</div>
            <span className="logo-text">PptGen</span>
          </div>
          <span className="logo-sub">AI Presentation Generator</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {user && <span className="header-username">👤 {user.username}</span>}
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
          <div className="header-badge">
            <div className="header-badge-dot" />
            AI Ready
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="steps-bar">
          {STEPS.map((label, i) => (
            <div key={i} className={`step ${step === i + 1 ? "active" : ""} ${step > i + 1 ? "done" : ""}`}>
              <div className="step-dot">{step > i + 1 ? "✓" : i + 1}</div>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {step === 2 && (
          <>
            <PromptForm
              sessionId={sessionId}
              setSessionId={setSessionId}
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
              onGenerate={handleGenerate}
              onBack={handleReset}
            />
            <PresentationHistory ref={historyRef} />
          </>
        )}
        {step === 3 && (
          <JobTracker
            jobId={jobId}
            onReset={handleReset}
            onHistoryRefresh={handleHistoryRefresh}
          />
        )}
      </main>
    </div>
  )
}
