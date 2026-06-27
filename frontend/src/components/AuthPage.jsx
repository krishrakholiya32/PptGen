import { useState } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

function debounce(fn, ms) {
  let t
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
}

export function AuthPage({ onLogin }) {
  const [tab,      setTab]      = useState("login")
  const [error,    setError]    = useState("")
  const [loading,  setLoading]  = useState(false)

  // Login fields
  const [loginEmail, setLoginEmail]   = useState("")
  const [loginPw,    setLoginPw]      = useState("")

  // Register fields
  const [regUser,    setRegUser]      = useState("")
  const [regEmail,   setRegEmail]     = useState("")
  const [regEmailC,  setRegEmailC]    = useState("")
  const [regPw,      setRegPw]        = useState("")
  const [regPwC,     setRegPwC]       = useState("")

  // Hints
  const [hintUser,   setHintUser]     = useState({ text: "", ok: false })
  const [hintEmail,  setHintEmail]    = useState({ text: "", ok: false })
  const [hintEmailC, setHintEmailC]   = useState({ text: "", ok: false })
  const [hintPwC,    setHintPwC]      = useState({ text: "", ok: false })

  const checkUsername = debounce(async (val) => {
    val = val.trim()
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

  const checkEmail = debounce(async (val) => {
    val = val.trim()
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
        const msg = Array.isArray(d) ? d.map(e => e.msg?.replace(/^Value error,\s*/i, "")).filter(Boolean).join(" ") : (typeof d === "string" ? d : "Registration failed.")
        setError(msg); return
      }
      localStorage.setItem("pptgen_token", data.access_token)
      onLogin(data.access_token)
    } catch { setError("Connection error. Try again.") }
    finally { setLoading(false) }
  }

  const handleKey = (e) => {
    if (e.key === "Enter") tab === "login" ? handleLogin() : handleRegister()
  }

  return (
    <div className="auth-page" onKeyDown={handleKey}>
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">P</div>
          <h1 className="auth-logo-text">PptGen</h1>
          <p className="auth-logo-sub">AI Presentation Generator</p>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab === "login" ? "active" : ""}`} onClick={() => { setTab("login"); setError("") }}>Login</button>
          <button className={`auth-tab ${tab === "register" ? "active" : ""}`} onClick={() => { setTab("register"); setError("") }}>Register</button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {tab === "login" && (
          <div className="auth-form">
            <div className="auth-field">
              <label>Email</label>
              <input type="email" placeholder="Enter your email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="auth-field">
              <label>Password</label>
              <input type="password" placeholder="Enter your password" value={loginPw} onChange={e => setLoginPw(e.target.value)} autoComplete="current-password" />
            </div>
            <button className="auth-btn" onClick={handleLogin} disabled={loading}>
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </div>
        )}

        {tab === "register" && (
          <div className="auth-form">
            <div className="auth-field">
              <label>Username</label>
              <input type="text" placeholder="Choose a username" value={regUser}
                onChange={e => { setRegUser(e.target.value); checkUsername(e.target.value) }}
                autoComplete="username" />
              {hintUser.text && <span className={`auth-hint ${hintUser.ok ? "ok" : "err"}`}>{hintUser.text}</span>}
            </div>
            <div className="auth-field">
              <label>Email</label>
              <input type="email" placeholder="Your email address" value={regEmail}
                onChange={e => { setRegEmail(e.target.value); checkEmail(e.target.value) }}
                autoComplete="email" />
              {hintEmail.text && <span className={`auth-hint ${hintEmail.ok ? "ok" : "err"}`}>{hintEmail.text}</span>}
            </div>
            <div className="auth-field">
              <label>Confirm Email</label>
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
            <div className="auth-field">
              <label>Password</label>
              <input type="password" placeholder="Choose a password" value={regPw} onChange={e => setRegPw(e.target.value)} autoComplete="new-password" />
              <span className="auth-hint-plain">Min 8 chars, uppercase, lowercase, number, special character</span>
            </div>
            <div className="auth-field">
              <label>Confirm Password</label>
              <input type="password" placeholder="Re-enter your password" value={regPwC}
                onChange={e => {
                  setRegPwC(e.target.value)
                  const v = e.target.value
                  if (!v) { setHintPwC({ text: "", ok: false }); return }
                  v === regPw
                    ? setHintPwC({ text: "Passwords match ✓", ok: true })
                    : setHintPwC({ text: "Passwords do not match", ok: false })
                }} />
              {hintPwC.text && <span className={`auth-hint ${hintPwC.ok ? "ok" : "err"}`}>{hintPwC.text}</span>}
            </div>
            <button className="auth-btn" onClick={handleRegister} disabled={loading}>
              {loading ? "Creating account…" : "Create Account →"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
