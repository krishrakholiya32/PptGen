import { useState, type KeyboardEvent } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout>
  return (...args: A) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
}

interface Feature { icon: string; title: string; desc: string }
interface Stat { value: string; label: string }
interface Hint { text: string; ok: boolean }

interface AuthPageProps {
  onLogin: (token: string) => void
}

const FEATURES: Feature[] = [
  { icon: "✦", title: "AI-Powered Content", desc: "Gemini + Groq generate smart, structured slide content instantly" },
  { icon: "◈", title: "Live Web Research", desc: "Automatically pulls current facts and data into your slides" },
  { icon: "◉", title: "Beautiful Themes", desc: "8 professional themes with custom color controls" },
  { icon: "⬡", title: "Instant PPTX Export", desc: "Download fully editable PowerPoint files in seconds" },
]

const STATS: Stat[] = [
  { value: "10s", label: "Avg generation time" },
  { value: "8", label: "Themes" },
  { value: "10", label: "Languages supported" },
]

export function AuthPage({ onLogin }: AuthPageProps) {
  const [tab,     setTab]     = useState("login")
  const [error,   setError]   = useState("")
  const [loading, setLoading] = useState(false)

  const [loginEmail, setLoginEmail] = useState("")
  const [loginPw,    setLoginPw]    = useState("")

  const [regUser,   setRegUser]   = useState("")
  const [regEmail,  setRegEmail]  = useState("")
  const [regEmailC, setRegEmailC] = useState("")
  const [regPw,     setRegPw]     = useState("")
  const [regPwC,    setRegPwC]    = useState("")

  const [hintUser,   setHintUser]   = useState<Hint>({ text: "", ok: false })
  const [hintEmail,  setHintEmail]  = useState<Hint>({ text: "", ok: false })
  const [hintEmailC, setHintEmailC] = useState<Hint>({ text: "", ok: false })
  const [hintPwC,    setHintPwC]    = useState<Hint>({ text: "", ok: false })

  const checkUsername = debounce(async (raw: string) => {
    const val = raw.trim()
    if (!val) { setHintUser({ text: "", ok: false }); return }
    if (!/^[A-Za-z0-9_]{3,30}$/.test(val)) {
      setHintUser({ text: "3–30 chars, letters/numbers/underscores only", ok: false }); return
    }
    setHintUser({ text: "Checking…", ok: false })
    try {
      const d = await fetch(`${API}/auth/check?username=${encodeURIComponent(val)}`).then(r => r.json())
      d.username.taken
        ? setHintUser({ text: "Username already taken", ok: false })
        : setHintUser({ text: "Username available ✓", ok: true })
    } catch { setHintUser({ text: "", ok: false }) }
  }, 500)

  const checkEmail = debounce(async (raw: string) => {
    const val = raw.trim()
    if (!val) { setHintEmail({ text: "", ok: false }); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      setHintEmail({ text: "Enter a valid email", ok: false }); return
    }
    setHintEmail({ text: "Checking…", ok: false })
    try {
      const d = await fetch(`${API}/auth/check?email=${encodeURIComponent(val)}`).then(r => r.json())
      d.email.taken
        ? setHintEmail({ text: "Email already registered", ok: false })
        : setHintEmail({ text: "Email available ✓", ok: true })
    } catch { setHintEmail({ text: "", ok: false }) }
  }, 500)

  const handleLogin = async () => {
    if (!loginEmail || !loginPw) { setError("Please fill in all fields."); return }
    setLoading(true); setError("")
    try {
      const form = new URLSearchParams()
      form.append("username", loginEmail)
      form.append("password", loginPw)
      const res  = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || "Login failed."); return }
      localStorage.setItem("pptgen_token", data.access_token)
      onLogin(data.access_token)
    } catch { setError("Connection error. Try again.") }
    finally { setLoading(false) }
  }

  const handleRegister = async () => {
    if (!regUser || !regEmail || !regEmailC || !regPw || !regPwC) { setError("Please fill in all fields."); return }
    if (regEmail !== regEmailC) { setError("Emails do not match."); return }
    if (regPw    !== regPwC)    { setError("Passwords do not match."); return }
    setLoading(true); setError("")
    try {
      const res  = await fetch(`${API}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: regUser, email: regEmail, password: regPw }) })
      const data = await res.json()
      if (!res.ok) {
        const d = data.detail
        const msg = Array.isArray(d) ? d.map((e: { msg?: string }) => e.msg?.replace(/^Value error,\s*/i, "")).filter(Boolean).join(" ") : (typeof d === "string" ? d : "Registration failed.")
        setError(msg); return
      }
      localStorage.setItem("pptgen_token", data.access_token)
      onLogin(data.access_token)
    } catch { setError("Connection error. Try again.") }
    finally { setLoading(false) }
  }

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") tab === "login" ? handleLogin() : handleRegister()
  }

  return (
    <div className="landing-page" onKeyDown={handleKey}>
    <div className="landing">
      {/* ── Left panel ───────────────────────── */}
      <div className="landing-left">
        <div className="landing-left-inner">
          <div className="landing-logo">
            <div className="landing-logo-mark">P</div>
            <span className="landing-logo-text">PptGen</span>
          </div>

          <div className="landing-headline">
            <h1>Create stunning<br /><span className="landing-gradient-text">presentations</span><br />in seconds.</h1>
            <p className="landing-sub">Describe your topic. Our AI researches, writes, designs and exports a complete PowerPoint — ready to present.</p>
          </div>

          <div className="landing-features">
            {FEATURES.map(f => (
              <div className="landing-feature" key={f.title}>
                <div className="landing-feature-icon">{f.icon}</div>
                <div>
                  <div className="landing-feature-title">{f.title}</div>
                  <div className="landing-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="landing-stats">
            {STATS.map(s => (
              <div className="landing-stat" key={s.label}>
                <div className="landing-stat-value">{s.value}</div>
                <div className="landing-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel (auth form) ──────────── */}
      <div className="landing-right">
        <div className="landing-form-wrap">
          <div className="landing-form-header">
            <h2>{tab === "login" ? "Welcome back" : "Create your account"}</h2>
            <p>{tab === "login" ? "Sign in to continue generating presentations." : "Join thousands creating AI-powered presentations."}</p>
          </div>

          <div className="auth-tabs">
            <button className={`auth-tab ${tab === "login"    ? "active" : ""}`} onClick={() => { setTab("login");    setError("") }}>Sign In</button>
            <button className={`auth-tab ${tab === "register" ? "active" : ""}`} onClick={() => { setTab("register"); setError("") }}>Register</button>
          </div>

          {error && <div className="auth-error">{error}</div>}

          {tab === "login" && (
            <div className="auth-form">
              <div className="auth-field">
                <label>Email address</label>
                <input type="email" placeholder="you@example.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoComplete="email" autoFocus />
              </div>
              <div className="auth-field">
                <label>Password</label>
                <input type="password" placeholder="Enter your password" value={loginPw} onChange={e => setLoginPw(e.target.value)} autoComplete="current-password" />
              </div>
              <button className="auth-btn" onClick={handleLogin} disabled={loading}>
                {loading ? <span className="auth-btn-spinner" /> : null}
                {loading ? "Signing in…" : "Sign In →"}
              </button>
              <p className="auth-switch">Don't have an account? <button onClick={() => { setTab("register"); setError("") }}>Register free</button></p>
            </div>
          )}

          {tab === "register" && (
            <div className="auth-form">
              <div className="auth-field">
                <label>Username</label>
                <input type="text" placeholder="e.g. zrik" value={regUser}
                  onChange={e => { setRegUser(e.target.value); checkUsername(e.target.value) }}
                  autoComplete="username" autoFocus />
                {hintUser.text && <span className={`auth-hint ${hintUser.ok ? "ok" : "err"}`}>{hintUser.text}</span>}
              </div>
              <div className="auth-field">
                <label>Email address</label>
                <input type="email" placeholder="you@example.com" value={regEmail}
                  onChange={e => { setRegEmail(e.target.value); checkEmail(e.target.value) }}
                  autoComplete="email" />
                {hintEmail.text && <span className={`auth-hint ${hintEmail.ok ? "ok" : "err"}`}>{hintEmail.text}</span>}
              </div>
              <div className="auth-field">
                <label>Confirm email</label>
                <input type="email" placeholder="Re-enter your email" value={regEmailC}
                  onChange={e => {
                    setRegEmailC(e.target.value)
                    const v = e.target.value.trim()
                    if (!v) { setHintEmailC({ text: "", ok: false }); return }
                    v === regEmail.trim()
                      ? setHintEmailC({ text: "Emails match ✓", ok: true })
                      : setHintEmailC({ text: "Emails do not match", ok: false })
                  }} />
                {hintEmailC.text && <span className={`auth-hint ${hintEmailC.ok ? "ok" : "err"}`}>{hintEmailC.text}</span>}
              </div>
              <div className="auth-row-2">
                <div className="auth-field">
                  <label>Password</label>
                  <input type="password" placeholder="Min 8 chars" value={regPw} onChange={e => setRegPw(e.target.value)} autoComplete="new-password" />
                  <span className="auth-hint-plain">Uppercase, lowercase, number, special char</span>
                </div>
                <div className="auth-field">
                  <label>Confirm password</label>
                  <input type="password" placeholder="Re-enter password" value={regPwC}
                    onChange={e => {
                      setRegPwC(e.target.value)
                      const v = e.target.value
                      if (!v) { setHintPwC({ text: "", ok: false }); return }
                      v === regPw
                        ? setHintPwC({ text: "Match ✓", ok: true })
                        : setHintPwC({ text: "No match", ok: false })
                    }} />
                  {hintPwC.text && <span className={`auth-hint ${hintPwC.ok ? "ok" : "err"}`}>{hintPwC.text}</span>}
                </div>
              </div>
              <button className="auth-btn" onClick={handleRegister} disabled={loading}>
                {loading ? <span className="auth-btn-spinner" /> : null}
                {loading ? "Creating account…" : "Create Account →"}
              </button>
              <p className="auth-switch">Already have an account? <button onClick={() => { setTab("login"); setError("") }}>Sign in</button></p>
            </div>
          )}

        </div>
      </div>
    </div>
    </div>
  )
}
