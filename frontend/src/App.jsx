import { useState, useEffect } from 'react'
import axios from 'axios'
import './index.css'

const API = 'http://localhost:8000'

// ── Auth Helper ────────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('nivaran_token')
const getUser = () => JSON.parse(localStorage.getItem('nivaran_user') || 'null')
const setAuth = (token, user) => {
  localStorage.setItem('nivaran_token', token)
  localStorage.setItem('nivaran_user', JSON.stringify(user))
}
const clearAuth = () => {
  localStorage.removeItem('nivaran_token')
  localStorage.removeItem('nivaran_user')
}
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` })

// ── Navbar ─────────────────────────────────────────────────────────────────────
function Navbar({ user, onLogout, onShowAuth }) {
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <div className="navbar-icon">⚖️</div>
        <div>
          <div className="navbar-brand">Nivaran</div>
          <div className="navbar-subtitle">AI for Bureaucracy Simplification</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div className="navbar-badge">PS 02 · AI & LLMs</div>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              👤 {user.full_name}
            </span>
            <button onClick={onLogout} style={{
              background: 'transparent',
              border: '1.5px solid var(--cream-darker)',
              borderRadius: '8px',
              padding: '0.3rem 0.8rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontFamily: 'DM Sans, sans-serif'
            }}>Logout</button>
          </div>
        ) : (
          <button onClick={onShowAuth} style={{
            background: 'linear-gradient(135deg, var(--brown), var(--brown-dark))',
            border: 'none',
            borderRadius: '8px',
            padding: '0.4rem 1rem',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
            fontFamily: 'DM Sans, sans-serif'
          }}>Login / Register</button>
        )}
      </div>
    </nav>
  )
}

// ── Auth Modal ─────────────────────────────────────────────────────────────────
function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/login' : '/register'
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : { full_name: form.full_name, email: form.email, password: form.password }

      const res = await axios.post(`${API}${endpoint}`, payload)
      setAuth(res.data.token, { full_name: res.data.full_name, email: res.data.email })
      onSuccess({ full_name: res.data.full_name, email: res.data.email })
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(44, 31, 14, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '2rem',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(60,35,10,0.2)'
      }}>
        {/* Benefit Banner */}
        <div style={{
          background: 'var(--cream)',
          border: '1px solid var(--cream-darker)',
          borderRadius: '10px',
          padding: '0.85rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6
        }}>
          ✨ <strong>Why register?</strong> Save your details once — auto-fill any form instantly without uploading documents again.
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: '1.5rem', background: 'var(--cream)', borderRadius: '10px', padding: '4px' }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError('') }} style={{
              flex: 1,
              padding: '0.5rem',
              border: 'none',
              borderRadius: '8px',
              background: mode === m ? 'white' : 'transparent',
              color: mode === m ? 'var(--brown-dark)' : 'var(--text-muted)',
              fontWeight: mode === m ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontFamily: 'DM Sans, sans-serif',
              boxShadow: mode === m ? '0 1px 4px rgba(60,35,10,0.1)' : 'none',
              textTransform: 'capitalize'
            }}>{m}</button>
          ))}
        </div>

        {mode === 'register' && (
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Full Name</label>
            <input
              type="text"
              placeholder="Your full name"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            />
          </div>
        )}

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>Email</label>
          <input
            type="email"
            placeholder="your@email.com"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>Password</label>
          <input
            type="password"
            placeholder="Min. 6 characters"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {error && <div className="error-box" style={{ marginBottom: '1rem' }}>{error}</div>}

        <button className="btn btn-primary" style={{ marginTop: 0 }} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Login →' : 'Create Account →'}
        </button>
        <button onClick={onClose} style={{
          width: '100%', marginTop: '0.75rem', padding: '0.6rem',
          background: 'transparent', border: 'none',
          color: 'var(--text-muted)', cursor: 'pointer',
          fontSize: '0.85rem', fontFamily: 'DM Sans, sans-serif'
        }}>Continue without account</button>
      </div>
    </div>
  )
}

// ── Step Indicator ─────────────────────────────────────────────────────────────
function StepIndicator({ current, total }) {
  return (
    <div className="steps-nav">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`step-dot ${i < current ? 'done' : ''} ${i === current ? 'active' : ''}`} />
      ))}
    </div>
  )
}

// ── Upload Box ─────────────────────────────────────────────────────────────────
function UploadBox({ label, hint, onChange, accept, fileName }) {
  return (
    <label className="upload-box">
      <input type="file" accept={accept} onChange={onChange} />
      <span className="upload-icon">📄</span>
      <div className="upload-title">{label}</div>
      <div className="upload-text">{hint}</div>
      {fileName && <div className="upload-success">✓ {fileName}</div>}
    </label>
  )
}

// ── Mismatch Warning ───────────────────────────────────────────────────────────
function MismatchWarning({ mismatches }) {
  if (!mismatches || mismatches.length === 0) return null
  return (
    <div style={{
      background: 'rgba(176,130,50,0.08)',
      border: '1px solid rgba(176,130,50,0.3)',
      borderRadius: '10px',
      padding: '1rem',
      marginTop: '1rem'
    }}>
      <div style={{ fontWeight: 700, color: '#8a6020', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
        ⚠️ Data Mismatch Detected
      </div>
      {mismatches.map((m, i) => (
        <div key={i} style={{ fontSize: '0.83rem', color: '#7a5010', marginBottom: '0.4rem' }}>
          <strong>{m.field}</strong>: "{m.value1}" ({m.source1}) vs "{m.value2}" ({m.source2})
          <span style={{ color: 'var(--text-muted)', marginLeft: '0.3rem' }}>— please verify and correct below</span>
        </div>
      ))}
    </div>
  )
}

// ── Voice Input ────────────────────────────────────────────────────────────────
function VoiceInput({ onResult, language }) {
  const [listening, setListening] = useState(false)

  const langCodes = {
    'English': 'en-IN', 'Hindi': 'hi-IN', 'Gujarati': 'gu-IN',
    'Marathi': 'mr-IN', 'Tamil': 'ta-IN', 'Telugu': 'te-IN', 'Bengali': 'bn-IN'
  }

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Use Chrome for voice input!'); return }
    const recognition = new SR()
    recognition.lang = langCodes[language] || 'en-IN'
    recognition.start()
    setListening(true)
    recognition.onresult = (e) => { onResult(e.results[0][0].transcript); setListening(false) }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
  }

  return (
    <button onClick={startListening} title="Voice input" style={{
      background: listening ? '#b05252' : 'linear-gradient(135deg, var(--brown), var(--brown-dark))',
      color: 'white', border: 'none', borderRadius: '8px',
      padding: '0.6rem 0.9rem', cursor: 'pointer', fontSize: '1rem'
    }}>
      {listening ? '🔴' : '🎤'}
    </button>
  )
}

// ── Chat Box ───────────────────────────────────────────────────────────────────
function ChatBox({ analysis, language }) {
  const [messages, setMessages] = useState([
    { role: 'bot', text: '👋 Ask me anything about this document.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim()) return
    setMessages(prev => [...prev, { role: 'user', text: input }])
    const q = input
    setInput('')
    setLoading(true)
    try {
      const res = await axios.post(`${API}/chat`, {
        question: q,
        context: JSON.stringify(analysis),
        language
      })
      setMessages(prev => [...prev, { role: 'bot', text: res.data.answer }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: '❌ Error. Try again.' }])
    }
    setLoading(false)
  }

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div className="card-title">Chat with Document</div>
      <div style={{ height: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            background: m.role === 'user' ? 'linear-gradient(135deg, var(--brown), var(--brown-dark))' : 'var(--cream)',
            color: m.role === 'user' ? 'white' : 'var(--text-primary)',
            padding: '0.55rem 0.9rem', borderRadius: '10px',
            maxWidth: '80%', fontSize: '0.88rem', lineHeight: 1.5
          }}>{m.text}</div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', background: 'var(--cream)', padding: '0.55rem 0.9rem', borderRadius: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            ⏳ Thinking...
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask anything about this document..."
          style={{
            flex: 1, background: 'var(--cream)',
            border: '1.5px solid var(--cream-darker)', borderRadius: '8px',
            padding: '0.6rem 1rem', color: 'var(--text-primary)',
            fontSize: '0.9rem', fontFamily: 'DM Sans, sans-serif'
          }}
        />
        <VoiceInput onResult={setInput} language={language} />
        <button onClick={sendMessage} disabled={loading} style={{
          background: 'linear-gradient(135deg, var(--brown), var(--brown-dark))',
          color: 'white', border: 'none', borderRadius: '8px',
          padding: '0.6rem 1.1rem', cursor: 'pointer', fontWeight: 600,
          fontFamily: 'DM Sans, sans-serif'
        }}>Send</button>
      </div>
    </div>
  )
}

// ── Step 1: Upload Government Document ────────────────────────────────────────
function Step1({ onNext, user }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [language, setLanguage] = useState('English')

  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('language', language)
    try {
      const res = await axios.post(`${API}/analyze-document`, formData, { headers: authHeaders() })
      onNext(res.data.data, language)
    } catch {
      setError('Could not analyze document. Make sure the backend is running on port 8000.')
    }
    setLoading(false)
  }

  return (
    <div className="card">
      <div className="card-title">Upload Government Document</div>
      <div className="card-subtitle">
        Upload any government form, application, or notice — Nivaran will read and explain it for you.
        {!user && (
          <span style={{ display: 'block', marginTop: '0.4rem', color: 'var(--brown)', fontWeight: 500 }}>
            💡 Login to save your details and skip re-uploading next time.
          </span>
        )}
      </div>

      {/* Language Selector */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div className="upload-label" style={{ marginBottom: '0.4rem' }}>Output Language</div>
        <select
          value={language}
          onChange={e => setLanguage(e.target.value)}
          style={{
            width: '100%', background: 'var(--cream)',
            border: '1.5px solid var(--cream-darker)', borderRadius: '8px',
            padding: '0.65rem 1rem', color: 'var(--text-primary)',
            fontSize: '0.9rem', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer'
          }}
        >
          <option value="English">🇬🇧 English</option>
          <option value="Hindi">🇮🇳 Hindi</option>
          <option value="Gujarati">🇮🇳 Gujarati</option>
          <option value="Marathi">🇮🇳 Marathi</option>
          <option value="Tamil">🇮🇳 Tamil</option>
          <option value="Telugu">🇮🇳 Telugu</option>
          <option value="Bengali">🇮🇳 Bengali</option>
        </select>
      </div>

      <UploadBox
        label="Drop your document here"
        hint="Supports PDF, PNG, JPG"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={e => setFile(e.target.files[0])}
        fileName={file?.name}
      />

      {error && <div className="error-box">{error}</div>}

      <button className="btn btn-primary" onClick={handleAnalyze} disabled={!file || loading}>
        {loading ? 'Analyzing...' : 'Analyze Document →'}
      </button>

      {loading && (
        <div className="loading">
          <div className="spinner" />
          Extracting and analyzing with AI + RAG...
        </div>
      )}
    </div>
  )
}

// ── Step 2: Show Analysis + Chat ──────────────────────────────────────────────
function Step2({ analysis, language, onNext }) {
  const [showAutofill, setShowAutofill] = useState(false)

  return (
    <>
      <div className="card">
        <div className="success-badge">✓ Document analyzed</div>
        <div className="card-title">Document Summary</div>
        <div className="card-subtitle">Here's everything you need to know, in plain language.</div>

        <div className="result-section">
          <div className="result-label">Overview</div>
          <div className="result-value">{analysis.summary}</div>
        </div>

        {analysis.required_documents?.length > 0 && (
          <div className="result-section">
            <div className="result-label">Documents Required</div>
            <div>{analysis.required_documents.map((doc, i) => <span key={i} className="tag">{doc}</span>)}</div>
          </div>
        )}

        <div className="result-grid">
          <div className="result-section">
            <div className="result-label">Fees</div>
            <div className="result-value">{analysis.fees}</div>
          </div>
          <div className="result-section">
            <div className="result-label">Deadlines</div>
            <div className="result-value">{analysis.deadlines}</div>
          </div>
        </div>

        {analysis.eligibility?.length > 0 && (
          <div className="result-section">
            <div className="result-label">Eligibility</div>
            {analysis.eligibility.map((e, i) => (
              <div key={i} style={{ color: 'var(--text-secondary)', marginBottom: '0.3rem', fontSize: '0.9rem' }}>· {e}</div>
            ))}
          </div>
        )}

        {analysis.steps?.length > 0 && (
          <div className="result-section">
            <div className="result-label">Step-by-Step Process</div>
            {analysis.steps.map((step, i) => (
              <div key={i} className="step-item">
                <div className="step-num">{i + 1}</div>
                <div className="result-value">{step.replace(/^Step \d+:\s*/i, '')}</div>
              </div>
            ))}
          </div>
        )}

        {/* Autofill Toggle */}
        <div style={{
          background: 'var(--cream)', borderRadius: '10px',
          padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Auto-fill Application Form
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Upload your ID documents to fill the form automatically
            </div>
          </div>
          <button
            onClick={() => setShowAutofill(true)}
            style={{
              background: showAutofill
                ? 'var(--cream-darker)'
                : 'linear-gradient(135deg, var(--brown), var(--brown-dark))',
              color: showAutofill ? 'var(--text-secondary)' : 'white',
              border: 'none', borderRadius: '8px',
              padding: '0.5rem 1rem', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.85rem',
              fontFamily: 'DM Sans, sans-serif'
            }}
          >
            {showAutofill ? '✓ Enabled' : 'Enable →'}
          </button>
        </div>

        {showAutofill && (
          <button className="btn btn-primary" onClick={onNext}>
            Continue to Auto-fill →
          </button>
        )}
      </div>

      <ChatBox analysis={analysis} language={language} />
    </>
  )
}

// ── Step 3: Upload Personal Documents ────────────────────────────────────────
function Step3({ onNext, user }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleExtract = async () => {
    if (files.length === 0) return
    setLoading(true)
    setError('')
    const formData = new FormData()
    files.forEach(f => formData.append('files', f))
    try {
      const res = await axios.post(`${API}/extract-personal-info`, formData, { headers: authHeaders() })
      onNext(res.data.data, res.data.mismatches || [])
    } catch {
      setError('Could not extract info. Try again.')
    }
    setLoading(false)
  }

  const useProfile = async () => {
    try {
      const res = await axios.get(`${API}/profile`, { headers: authHeaders() })
      onNext(res.data.data, [])
    } catch {
      setError('Could not load profile.')
    }
  }

  return (
    <div className="card">
      <div className="card-title">Upload Your ID Documents</div>
      <div className="card-subtitle">
        Upload your Aadhaar, PAN, or any ID — we'll extract your details and fill the form automatically.
      </div>

      {user && (
        <div style={{
          background: 'var(--cream)', borderRadius: '10px',
          padding: '1rem', marginBottom: '1.25rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Use saved profile</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Fill from your registered details instantly</div>
          </div>
          <button onClick={useProfile} style={{
            background: 'linear-gradient(135deg, var(--brown), var(--brown-dark))',
            color: 'white', border: 'none', borderRadius: '8px',
            padding: '0.45rem 1rem', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.82rem', fontFamily: 'DM Sans, sans-serif'
          }}>Use Profile →</button>
        </div>
      )}

      <div className="upload-label" style={{ marginBottom: '0.5rem' }}>
        Upload Documents
      </div>

      <label className="upload-box">
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          multiple
          onChange={e => setFiles(Array.from(e.target.files))}
        />
        <span className="upload-icon">📄</span>
        <div className="upload-title">Upload Aadhaar, PAN, or any ID</div>
        <div className="upload-text">
          Hold <strong>Ctrl</strong> to select both Aadhaar and PAN together — PDF or image
        </div>
        {files.length > 0 && (
          <div className="upload-success">✓ {files.length} file(s) selected: {files.map(f => f.name).join(', ')}</div>
        )}
      </label>

      {error && <div className="error-box">{error}</div>}

      <button
        className="btn btn-primary"
        onClick={handleExtract}
        disabled={files.length === 0 || loading}
      >
        {loading ? 'Extracting...' : 'Extract & Auto-fill →'}
      </button>

      {loading && (
        <div className="loading">
          <div className="spinner" />
          Reading your documents with OCR + AI...
        </div>
      )}
    </div>
  )
}

// ── Step 4: Auto-filled Form ──────────────────────────────────────────────────
function Step4({ personalInfo, mismatches, user }) {
  const [form, setForm] = useState({
    name: personalInfo.name || '',
    dob: personalInfo.dob || '',
    phone: personalInfo.phone || '',
    email: personalInfo.email || '',
    aadhaar: personalInfo.aadhaar || '',
    pan: personalInfo.pan || '',
    address: personalInfo.address || '',
    gender: personalInfo.gender || '',
    father_name: personalInfo.father_name || '',
    pincode: personalInfo.pincode || '',
  })
  const [saved, setSaved] = useState(false)

  const fields = [
    { key: 'name',        label: 'Full Name',       placeholder: 'As per Aadhaar' },
    { key: 'dob',         label: 'Date of Birth',    placeholder: 'DD/MM/YYYY' },
    { key: 'phone',       label: 'Mobile Number',    placeholder: '10-digit number' },
    { key: 'email',       label: 'Email Address',    placeholder: 'your@email.com' },
    { key: 'aadhaar',     label: 'Aadhaar Number',   placeholder: '12-digit number' },
    { key: 'pan',         label: 'PAN Number',       placeholder: 'ABCDE1234F' },
    { key: 'gender',      label: 'Gender',           placeholder: 'Male / Female / Other' },
    { key: 'father_name', label: "Father's Name",    placeholder: 'As per records' },
    { key: 'pincode',     label: 'PIN Code',         placeholder: '6-digit PIN' },
    { key: 'address',     label: 'Address',          placeholder: 'Full address', full: true },
  ]

  const filledCount = Object.values(form).filter(v => v && v.trim()).length

  const downloadPDF = () => {
    const lines = [
      'NIVARAN - AUTO-FILLED APPLICATION FORM',
      `Generated: ${new Date().toLocaleDateString('en-IN')}`,
      '='.repeat(45),
      '',
      ...fields.map(({ key, label }) => `${label.padEnd(20)}: ${form[key] || 'Not provided'}`),
      '',
      '='.repeat(45),
      'Generated by Nivaran - AI for Bureaucracy Simplification'
    ]

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nivaran_form_${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const saveToProfile = async () => {
    try {
      await axios.post(`${API}/profile/save`, form, { headers: authHeaders() })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert('Could not save profile.')
    }
  }

  return (
    <div className="card">
      <div className="success-badge">✓ {filledCount} fields auto-filled</div>
      <div className="card-title">Your Application Form</div>
      <div className="card-subtitle">Review and edit any field. Highlighted fields were auto-filled from your documents.</div>

      <MismatchWarning mismatches={mismatches} />

      <div className="form-grid" style={{ marginTop: '1.25rem' }}>
        {fields.map(({ key, label, placeholder, full }) => (
          <div className="form-group" key={key} style={full ? { gridColumn: '1 / -1' } : {}}>
            <label>{label}</label>
            <input
              type="text"
              value={form[key]}
              placeholder={placeholder}
              className={form[key] ? 'filled' : ''}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <div className="divider" />

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button onClick={downloadPDF} style={{
          flex: 1, padding: '0.75rem', borderRadius: '8px',
          border: '1.5px solid var(--brown-light)', background: 'transparent',
          color: 'var(--brown-dark)', fontSize: '0.9rem', fontWeight: 600,
          cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', minWidth: '140px'
        }}>
          📥 Download Form
        </button>

        {user && (
          <button onClick={saveToProfile} style={{
            flex: 1, padding: '0.75rem', borderRadius: '8px',
            border: '1.5px solid var(--brown-light)', background: 'transparent',
            color: saved ? 'var(--success)' : 'var(--brown-dark)',
            fontSize: '0.9rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', minWidth: '140px'
          }}>
            {saved ? '✓ Saved!' : '💾 Save to Profile'}
          </button>
        )}

        <button className="btn btn-primary" style={{ flex: 1, marginTop: 0, minWidth: '140px' }}>
          Submit Application →
        </button>
      </div>
    </div>
  )
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
  // Check all required fields
    const required = ['name', 'dob', 'phone', 'aadhaar']
    const missing = required.filter(k => !form[k] || !form[k].trim())
  
    if (missing.length > 0) {
      alert(`Please fill these required fields: ${missing.join(', ')}`)
      return
    }

    if (mismatches && mismatches.length > 0) {
      alert('Please resolve the mismatched fields before submitting.')
      return
    }

    setSubmitted(true)
  }
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState(0)
  const [analysis, setAnalysis] = useState(null)
  const [language, setLanguage] = useState('English')
  const [personalInfo, setPersonalInfo] = useState(null)
  const [mismatches, setMismatches] = useState([])
  const [user, setUser] = useState(getUser())
  const [showAuth, setShowAuth] = useState(false)

  const handleLogout = () => { clearAuth(); setUser(null) }

  return (
    <>
      <Navbar user={user} onLogout={handleLogout} onShowAuth={() => setShowAuth(true)} />

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={(u) => { setUser(u); setShowAuth(false) }}
        />
      )}

      <div className="container">
        <StepIndicator current={step} total={4} />

        {step === 0 && (
          <Step1
            user={user}
            onNext={(data, lang) => { setAnalysis(data); setLanguage(lang); setStep(1) }}
          />
        )}
        {step === 1 && (
          <Step2
            analysis={analysis}
            language={language}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step3
            user={user}
            onNext={(info, mm) => { setPersonalInfo(info); setMismatches(mm); setStep(3) }}
          />
        )}
        {step === 3 && (
          <Step4
            personalInfo={personalInfo}
            mismatches={mismatches}
            user={user}
          />
        )}
      </div>
    </>
  )
}