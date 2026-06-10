import { useState, useRef, useEffect } from "react"
import { PromptForm } from "./components/PromptForm"
import { JobTracker } from "./components/JobTracker"
import { PresentationHistory } from "./components/PresentationHistory"
import "./App.css"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

const STEPS = ["Configure", "Generate"]

export default function App() {
  const [sessionId, setSessionId]         = useState(() => crypto.randomUUID())
  const [uploadedFiles, setUploadedFiles] = useState({ images: [], templates: [] })
  const [jobId, setJobId]                 = useState(null)
  const [step, setStep]                   = useState(1)
  const historyRef                        = useRef()

  // Keep Render free-tier backend warm so it doesn't cold-start mid-session.
  useEffect(() => {
    const ping = () => fetch(`${API.replace(/\/api$/, "")}/health`).catch(() => {})
    ping()
    const id = setInterval(ping, 10 * 60 * 1000) // every 10 minutes
    return () => clearInterval(id)
  }, [])

  const handleGenerate = (id) => { setJobId(id); setStep(2) }

  const handleReset = () => {
    setSessionId(crypto.randomUUID())
    setUploadedFiles({ images: [], templates: [] })
    setJobId(null)
    setStep(1)
  }

  const handleHistoryRefresh = () => {
    if (historyRef.current) historyRef.current.refresh()
  }

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
        <div className="header-badge">
          <div className="header-badge-dot" />
          AI Ready
        </div>
      </header>

      <main className="app-main">
        <div className="steps-bar">
          {STEPS.map((label, i) => (
            <div
              key={i}
              className={`step ${step === i + 1 ? "active" : ""} ${step > i + 1 ? "done" : ""}`}
            >
              <div className="step-dot">{step > i + 1 ? "✓" : i + 1}</div>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {step === 1 && (
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
        {step === 2 && (
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
