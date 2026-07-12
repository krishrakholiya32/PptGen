import { useState, useRef, useEffect } from "react"
import { PromptForm } from "./components/PromptForm"
import { JobTracker } from "./components/JobTracker"
import { PresentationHistory, type PresentationHistoryHandle } from "./components/PresentationHistory"
import { AuthPage } from "./components/AuthPage"
import type { UploadedFiles, User } from "./types"
import "./App.css"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

const STEPS = ["Account", "Configure", "Generate"]

export default function App() {
  const [token,          setToken]          = useState<string | null>(() => localStorage.getItem("pptgen_token") || null)
  const [user,           setUser]           = useState<User | null>(null)
  const [sessionId,      setSessionId]      = useState<string>(() => crypto.randomUUID())
  const [uploadedFiles,  setUploadedFiles]  = useState<UploadedFiles>({ images: [], templates: [], documents: [] })
  const [jobId,          setJobId]          = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get("job") || null
  })
  const [step, setStep] = useState<number>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get("job") ? 3 : 2
  })
  const historyRef = useRef<PresentationHistoryHandle | null>(null)

  const handleLogout = () => {
    localStorage.removeItem("pptgen_token")
    setToken(null)
    setUser(null)
  }

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

  const handleLogin = (newToken: string) => {
    setToken(newToken)
    setStep(2)
  }

  const handleGenerate = (id: string) => { setJobId(id); setStep(3) }

  const handleReset = () => {
    setSessionId(crypto.randomUUID())
    setUploadedFiles({ images: [], templates: [], documents: [] })
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
              token={token}
            />
            <PresentationHistory ref={historyRef} token={token} />
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
