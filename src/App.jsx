import { useEffect, useMemo, useState } from 'react'
import { removeBackground } from '@imgly/background-removal'
import './App.css'

const DPI = 300
const SHEET_WIDTH = 1800
const SHEET_HEIGHT = 1200

const mmToPxAt300 = (mm) => Math.round((mm * DPI) / 25.4)

const COUNTRY_SPECS = {
  india: {
    label: 'India',
    widthMm: 35,
    heightMm: 45,
    backgroundColor: '#ffffff',
    note: 'Common standard for Indian visa/passport applications.',
  },
  usa: {
    label: 'United States',
    widthMm: 51,
    heightMm: 51,
    backgroundColor: '#ffffff',
    note: 'US passport/visa photos are 2x2 inch (51x51 mm).',
  },
  uk: {
    label: 'United Kingdom',
    widthMm: 35,
    heightMm: 45,
    backgroundColor: '#ffffff',
    note: 'UK passport photos are 35x45 mm.',
  },
  schengen: {
    label: 'Schengen / EU',
    widthMm: 35,
    heightMm: 45,
    backgroundColor: '#ffffff',
    note: 'Most Schengen visa photos use 35x45 mm.',
  },
  canada: {
    label: 'Canada',
    widthMm: 50,
    heightMm: 70,
    backgroundColor: '#ffffff',
    note: 'Canada passport photos are usually 50x70 mm.',
  },
}

const COPYRIGHT_OWNER = 'Furqan Naikwadi'
const MAX_GENERATION_CREDITS = 5
const AUTH_USERS_KEY = 'photomaker_auth_users'
const AUTH_SESSION_KEY = 'photomaker_auth_session'
const GENERATION_USED_KEY = 'photomaker_generation_used'

const blockedEmailDomains = [
  'example.com',
  'test.com',
  'mailinator.com',
  'yopmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'fakeinbox.com',
]

const defaultStyle = {
  zoom: 1.08,
  yOffset: -12,
  brightness: 1.02,
  contrast: 1.07,
  saturation: 1.04,
  backgroundColor: '#ffffff',
  borderColor: '#202020',
  borderWidth: 3,
}

const getPasswordStrength = (password) => {
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (score <= 2) return { score, label: 'Weak', className: 'weak' }
  if (score <= 4) return { score, label: 'Medium', className: 'medium' }
  return { score, label: 'Strong', className: 'strong' }
}

const isDummyEmail = (email) => {
  const normalized = email.trim().toLowerCase()
  const [localPart = '', domain = ''] = normalized.split('@')

  if (!domain || !localPart) return true

  if (blockedEmailDomains.includes(domain)) return true

  if (/^(test|dummy|fake|sample|user|admin)[\d._-]*$/i.test(localPart)) {
    return true
  }

  return false
}

const readStoredUsers = () => {
  try {
    const raw = localStorage.getItem(AUTH_USERS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const readGenerationUsed = () => {
  const raw = localStorage.getItem(GENERATION_USED_KEY)
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

const toObjectUrl = (blob) => URL.createObjectURL(blob)

const blobFromCanvas = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not export canvas'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })

const loadImageFromUrl = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Unable to load processed image'))
    img.src = url
  })

const renderPassportPhoto = (sourceImage, style, countrySpec) => {
  const passportWidth = mmToPxAt300(countrySpec.widthMm)
  const passportHeight = mmToPxAt300(countrySpec.heightMm)

  const canvas = document.createElement('canvas')
  canvas.width = passportWidth
  canvas.height = passportHeight

  const ctx = canvas.getContext('2d')
  ctx.fillStyle = style.backgroundColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.save()
  ctx.filter = `brightness(${style.brightness}) contrast(${style.contrast}) saturate(${style.saturation})`

  const scale =
    Math.max(
      passportWidth / sourceImage.width,
      passportHeight / sourceImage.height,
    ) * style.zoom

  const drawWidth = sourceImage.width * scale
  const drawHeight = sourceImage.height * scale
  const drawX = (passportWidth - drawWidth) / 2
  const drawY = (passportHeight - drawHeight) / 2 + style.yOffset

  ctx.drawImage(sourceImage, drawX, drawY, drawWidth, drawHeight)
  ctx.restore()

  return canvas
}

const render4x6Sheet = (passportCanvas, style) => {
  const canvas = document.createElement('canvas')
  canvas.width = SHEET_WIDTH
  canvas.height = SHEET_HEIGHT

  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const photoWidth = passportCanvas.width
  const photoHeight = passportCanvas.height
  const minGap = 22

  let cols = 1
  let rows = 1

  for (let c = 1; c <= 10; c += 1) {
    if (c * photoWidth + (c + 1) * minGap <= SHEET_WIDTH) cols = c
  }

  for (let r = 1; r <= 10; r += 1) {
    if (r * photoHeight + (r + 1) * minGap <= SHEET_HEIGHT) rows = r
  }

  const gapX = (SHEET_WIDTH - cols * photoWidth) / (cols + 1)
  const gapY = (SHEET_HEIGHT - rows * photoHeight) / (rows + 1)

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = gapX + col * (photoWidth + gapX)
      const y = gapY + row * (photoHeight + gapY)
      ctx.drawImage(passportCanvas, x, y)

      // Add a clear trim guide around each copy for easier manual cutting.
      if (style.borderWidth > 0) {
        ctx.save()
        ctx.lineWidth = style.borderWidth
        ctx.strokeStyle = style.borderColor
        ctx.strokeRect(
          x + style.borderWidth / 2,
          y + style.borderWidth / 2,
          photoWidth - style.borderWidth,
          photoHeight - style.borderWidth,
        )
        ctx.restore()
      }
    }
  }

  ctx.save()
  ctx.fillStyle = '#334155'
  ctx.font = 'bold 18px "Segoe UI", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(
    `Copyright ${new Date().getFullYear()} ${COPYRIGHT_OWNER}. &copy; All rights reserved.`,
    SHEET_WIDTH - 22,
    SHEET_HEIGHT - 18,
  )
  ctx.restore()

  return {
    canvas,
    layout: {
      rows,
      cols,
      copies: rows * cols,
    },
  }
}

function App() {
  const [selectedCountry, setSelectedCountry] = useState('india')
  const [sourceFile, setSourceFile] = useState(null)
  const [sourcePreview, setSourcePreview] = useState('')
  const [subjectBlob, setSubjectBlob] = useState(null)
  const [subjectPreview, setSubjectPreview] = useState('')
  const [sheetPreview, setSheetPreview] = useState('')
  const [layoutInfo, setLayoutInfo] = useState({ rows: 2, cols: 4, copies: 8 })
  const [style, setStyle] = useState(defaultStyle)
  const [status, setStatus] = useState('Upload a portrait to begin.')
  const [isWorking, setIsWorking] = useState(false)
  const [toasts, setToasts] = useState([])
  const [authMode, setAuthMode] = useState('signup')
  const [authOpen, setAuthOpen] = useState(false)
  const [authError, setAuthError] = useState('')
  const [pendingFiles, setPendingFiles] = useState([])
  const [account, setAccount] = useState(null)
  const [generationUsed, setGenerationUsed] = useState(0)
  const [signupForm, setSignupForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [loginForm, setLoginForm] = useState({
    identifier: '',
    password: '',
  })

  const controlsDisabled = !subjectBlob || isWorking
  const currentYear = new Date().getFullYear()
  const remainingCredits = Math.max(MAX_GENERATION_CREDITS - generationUsed, 0)
  const isAuthenticated = Boolean(account?.isLoggedIn && account?.email)

  const signupPasswordStrength = useMemo(
    () => getPasswordStrength(signupForm.password),
    [signupForm.password],
  )

  const pushToast = (message) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 2800)
  }

  const applySelectedFiles = (files) => {
    const file = files[0]
    if (!file) return

    if (sourcePreview) URL.revokeObjectURL(sourcePreview)
    if (subjectPreview) URL.revokeObjectURL(subjectPreview)
    if (sheetPreview) URL.revokeObjectURL(sheetPreview)

    setSourceFile(file)
    setSubjectBlob(null)
    setSubjectPreview('')
    setSheetPreview('')
    setLayoutInfo({ rows: 2, cols: 4, copies: 8 })
    setSourcePreview(toObjectUrl(file))

    if (files.length > 1) {
      setStatus(
        `${files.length} photos selected. Using the first photo for generation.`,
      )
    } else {
      setStatus('Photo selected. Click "Generate Passport Sheet".')
    }
  }

  const activeCountrySpec = useMemo(
    () => COUNTRY_SPECS[selectedCountry] || COUNTRY_SPECS.india,
    [selectedCountry],
  )

  const passportWidthPx = useMemo(
    () => mmToPxAt300(activeCountrySpec.widthMm),
    [activeCountrySpec.widthMm],
  )

  const passportHeightPx = useMemo(
    () => mmToPxAt300(activeCountrySpec.heightMm),
    [activeCountrySpec.heightMm],
  )

  const printDetails = useMemo(
    () => ({
      passport: `${activeCountrySpec.widthMm}x${activeCountrySpec.heightMm} mm (${passportWidthPx}x${passportHeightPx} px at 300 DPI)`,
      sheet: '6x4 in landscape (1800x1200 px at 300 DPI)',
      copies: `${layoutInfo.copies} copies laid out as ${layoutInfo.cols} columns x ${layoutInfo.rows} rows`,
    }),
    [
      activeCountrySpec.heightMm,
      activeCountrySpec.widthMm,
      layoutInfo.cols,
      layoutInfo.copies,
      layoutInfo.rows,
      passportHeightPx,
      passportWidthPx,
    ],
  )

  useEffect(() => {
    const savedSession = localStorage.getItem(AUTH_SESSION_KEY)
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession)
        if (parsed?.isLoggedIn && parsed?.email) {
          setAccount(parsed)
        } else {
          localStorage.removeItem(AUTH_SESSION_KEY)
        }
      } catch {
        localStorage.removeItem(AUTH_SESSION_KEY)
      }
    }

    setGenerationUsed(readGenerationUsed())
  }, [])

  useEffect(() => {
    return () => {
      if (sourcePreview) URL.revokeObjectURL(sourcePreview)
      if (subjectPreview) URL.revokeObjectURL(subjectPreview)
      if (sheetPreview) URL.revokeObjectURL(sheetPreview)
    }
  }, [sourcePreview, subjectPreview, sheetPreview])

  const handleUpload = (event) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    if (files.length > 2 && !isAuthenticated) {
      setPendingFiles(files)
      setAuthOpen(true)
      setAuthMode('signup')
      setAuthError('')
      setStatus('Please login or sign up to upload more than 2 photos.')
      pushToast('Login required for more than 2 photos.')
      event.target.value = ''
      return
    }

    applySelectedFiles(files)
  }

  const applyStyleAndBuildSheet = async (blob, nextStyle, countrySpec) => {
    const subjectUrl = toObjectUrl(blob)
    const subjectImage = await loadImageFromUrl(subjectUrl)
    const passportCanvas = renderPassportPhoto(subjectImage, nextStyle, countrySpec)
    const { canvas: sheetCanvas, layout } = render4x6Sheet(passportCanvas, nextStyle)
    const passportBlob = await blobFromCanvas(passportCanvas)
    const sheetBlob = await blobFromCanvas(sheetCanvas)

    if (subjectPreview) URL.revokeObjectURL(subjectPreview)
    if (sheetPreview) URL.revokeObjectURL(sheetPreview)

    setSubjectPreview(toObjectUrl(passportBlob))
    setSheetPreview(toObjectUrl(sheetBlob))
    setLayoutInfo(layout)
    URL.revokeObjectURL(subjectUrl)
  }

  const handleCountryChange = async (event) => {
    const nextCountry = event.target.value
    const nextCountrySpec = COUNTRY_SPECS[nextCountry] || COUNTRY_SPECS.india

    setSelectedCountry(nextCountry)
    setStyle((prev) => ({ ...prev, backgroundColor: nextCountrySpec.backgroundColor }))

    if (!subjectBlob) {
      setStatus('Country preset selected. Upload and generate to apply.')
      return
    }

    const nextStyle = {
      ...style,
      backgroundColor: nextCountrySpec.backgroundColor,
    }

    setIsWorking(true)
    setStatus(`Applying ${nextCountrySpec.label} photo specification...`)
    try {
      await applyStyleAndBuildSheet(subjectBlob, nextStyle, nextCountrySpec)
      setStatus(`${nextCountrySpec.label} specification applied.`)
    } catch (error) {
      setStatus(`Country update failed: ${error.message}`)
    } finally {
      setIsWorking(false)
    }
  }

  const generatePassportSheet = async () => {
    if (!sourceFile) return

    if (generationUsed >= MAX_GENERATION_CREDITS) {
      setStatus('All credits exhausted. Maximum 5 generations reached.')
      pushToast('All credits exhausted')
      return
    }

    setIsWorking(true)
    setStatus('Removing background with AI...')

    try {
      const removed = await removeBackground(sourceFile)
      setSubjectBlob(removed)
      setStatus('Applying passport styling and generating 4x6 template...')
      await applyStyleAndBuildSheet(removed, style, activeCountrySpec)
      const nextUsed = generationUsed + 1
      setGenerationUsed(nextUsed)
      localStorage.setItem(GENERATION_USED_KEY, String(nextUsed))
      setStatus('Done. Your country-formatted 4x6 sheet is ready to download.')
    } catch (error) {
      setStatus(`Processing failed: ${error.message}`)
    } finally {
      setIsWorking(false)
    }
  }

  const restyleFromSubject = async (key, value) => {
    const nextStyle = { ...style, [key]: value }
    setStyle(nextStyle)

    if (!subjectBlob) return

    setIsWorking(true)
    setStatus('Updating style and regenerating sheet...')
    try {
      await applyStyleAndBuildSheet(subjectBlob, nextStyle, activeCountrySpec)
      setStatus('Style updated.')
    } catch (error) {
      setStatus(`Style update failed: ${error.message}`)
    } finally {
      setIsWorking(false)
    }
  }

  const downloadSheet = () => {
    if (!sheetPreview) return
    const link = document.createElement('a')
    link.href = sheetPreview
    link.download = 'passport-sheet-4x6.png'
    link.click()
  }

  const handleSignup = (event) => {
    event.preventDefault()
    const username = signupForm.username.trim()
    const email = signupForm.email.trim().toLowerCase()
    const password = signupForm.password

    if (!username) {
      setAuthError('Username is required.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email) || isDummyEmail(email)) {
      setAuthError('Please use a valid non-dummy email address.')
      return
    }

    if (signupPasswordStrength.score < 5) {
      setAuthError(
        'Password is too weak. Use 8+ chars with uppercase, lowercase, number, and symbol.',
      )
      return
    }

    if (password !== signupForm.confirmPassword) {
      setAuthError('Passwords do not match.')
      return
    }

    const users = readStoredUsers()
    const emailTaken = users.some((user) => user.email === email)
    if (emailTaken) {
      setAuthError('Email already registered. Please login.')
      setAuthMode('login')
      return
    }

    const newUser = { username, email, password }
    const nextUsers = [...users, newUser]
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(nextUsers))
    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ username, email, isLoggedIn: true }),
    )
    setAccount({ username, email, isLoggedIn: true })
    setAuthError('')
    setAuthOpen(false)
    pushToast(`Welcome ${username}! Account created.`)

    if (pendingFiles.length > 0) {
      applySelectedFiles(pendingFiles)
      setPendingFiles([])
    }
  }

  const handleLogin = (event) => {
    event.preventDefault()
    const identifier = loginForm.identifier.trim().toLowerCase()
    const password = loginForm.password

    if (!identifier || !password) {
      setAuthError('Enter username/email and password.')
      return
    }

    const users = readStoredUsers()
    const matchedUser = users.find(
      (user) =>
        user.email.toLowerCase() === identifier ||
        user.username.toLowerCase() === identifier,
    )

    if (!matchedUser || matchedUser.password !== password) {
      setAuthError('Invalid credentials.')
      return
    }

    const sessionUser = {
      username: matchedUser.username,
      email: matchedUser.email,
      isLoggedIn: true,
    }

    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionUser))
    setAccount(sessionUser)
    setAuthError('')
    setAuthOpen(false)
    pushToast(`Welcome back ${matchedUser.username}!`)

    if (pendingFiles.length > 0) {
      applySelectedFiles(pendingFiles)
      setPendingFiles([])
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(AUTH_SESSION_KEY)
    setAccount(null)
    setPendingFiles([])
    pushToast('Logged out successfully.')
  }

  return (
    <main className="app-shell">
      {toasts.length > 0 && (
        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className="toast-item">
              {toast.message}
            </div>
          ))}
        </div>
      )}

      {authOpen && (
        <section className="auth-overlay" role="dialog" aria-modal="true">
          <div className="auth-card">
            <div className="auth-header">
              <h2>{authMode === 'signup' ? 'Create Account' : 'Login'}</h2>
              <p>Required to upload more than 2 photos at once.</p>
            </div>

            <div className="auth-tabs">
              <button
                className={authMode === 'signup' ? 'active' : ''}
                onClick={() => {
                  setAuthMode('signup')
                  setAuthError('')
                }}
                type="button"
              >
                Sign Up
              </button>
              <button
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => {
                  setAuthMode('login')
                  setAuthError('')
                }}
                type="button"
              >
                Login
              </button>
            </div>

            {authMode === 'signup' ? (
              <form onSubmit={handleSignup} className="auth-form">
                <label>
                  Username
                  <input
                    type="text"
                    value={signupForm.username}
                    onChange={(e) =>
                      setSignupForm((prev) => ({
                        ...prev,
                        username: e.target.value,
                      }))
                    }
                    placeholder="Your name"
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={signupForm.email}
                    onChange={(e) =>
                      setSignupForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="you@example.com"
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={signupForm.password}
                    onChange={(e) =>
                      setSignupForm((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    placeholder="Create a strong password"
                    required
                  />
                </label>

                <div className="password-meter">
                  <span className="meter-label">Strength</span>
                  <div className="meter-track">
                    <div
                      className={`meter-fill ${signupPasswordStrength.className}`}
                      style={{ width: `${Math.max(signupPasswordStrength.score, 1) * 16}%` }}
                    ></div>
                  </div>
                  <strong>{signupPasswordStrength.label}</strong>
                </div>

                <label>
                  Confirm Password
                  <input
                    type="password"
                    value={signupForm.confirmPassword}
                    onChange={(e) =>
                      setSignupForm((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                    placeholder="Repeat password"
                    required
                  />
                </label>

                <button className="primary-btn" type="submit">
                  Create Account
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="auth-form">
                <label>
                  Username or Email
                  <input
                    type="text"
                    value={loginForm.identifier}
                    onChange={(e) =>
                      setLoginForm((prev) => ({
                        ...prev,
                        identifier: e.target.value,
                      }))
                    }
                    placeholder="username or email"
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="Your password"
                    required
                  />
                </label>

                <button className="primary-btn" type="submit">
                  Login
                </button>
              </form>
            )}

            {authError && <p className="auth-error">{authError}</p>}
            <button
              className="auth-close"
              type="button"
              onClick={() => setAuthOpen(false)}
            >
              Close
            </button>
          </div>
        </section>
      )}

      <header className="hero-block">
        <p className="eyebrow">AI Passport Photo Maker</p>
        <h1>Upload once. Get a print-ready 4x6 passport photo sheet.</h1>
        <p className="subtitle">
          The app removes background, styles the portrait, and places photos in
          a downloadable 4x6 layout based on country requirements.
        </p>
        <div className="hero-meta">
          <span className="credit-chip">
            Credits left: {remainingCredits} / {MAX_GENERATION_CREDITS}
          </span>
          <span className="credit-chip">
            {isAuthenticated ? `Logged in: ${account.username}` : 'Guest mode'}
          </span>
          {isAuthenticated ? (
            <button className="chip-btn" onClick={handleLogout} type="button">
              Logout
            </button>
          ) : (
            <button
              className="chip-btn"
              onClick={() => {
                setAuthOpen(true)
                setAuthMode('login')
                setAuthError('')
              }}
              type="button"
            >
              Login
            </button>
          )}
        </div>
      </header>

      <section className="workspace-grid">
        <article className="panel controls-panel">
          <h2>1) Upload & Generate</h2>
          <label className="country-select" htmlFor="countrySpec">
            <span>Country Specification</span>
            <select
              id="countrySpec"
              value={selectedCountry}
              onChange={handleCountryChange}
              disabled={isWorking}
            >
              {Object.entries(COUNTRY_SPECS).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label} ({item.widthMm}x{item.heightMm} mm)
                </option>
              ))}
            </select>
            <small>{activeCountrySpec.note}</small>
          </label>

          <label className="upload-field" htmlFor="photoUpload">
            <span>Choose portrait image(s)</span>
            <input
              id="photoUpload"
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
            />
            <small>
              Uploading more than 2 photos at once requires login/signup.
            </small>
          </label>

          <button
            className="primary-btn"
            onClick={generatePassportSheet}
            disabled={!sourceFile || isWorking}
          >
            {isWorking ? 'Processing...' : 'Generate Passport Sheet'}
          </button>

          <h2>2) Fine Tune Style</h2>
          <div className="sliders">
            <label>
              Zoom {style.zoom.toFixed(2)}
              <input
                type="range"
                min="0.9"
                max="1.35"
                step="0.01"
                value={style.zoom}
                onChange={(e) =>
                  restyleFromSubject('zoom', Number(e.target.value))
                }
                disabled={controlsDisabled}
              />
            </label>
            <label>
              Vertical Offset {style.yOffset}px
              <input
                type="range"
                min="-80"
                max="60"
                step="1"
                value={style.yOffset}
                onChange={(e) =>
                  restyleFromSubject('yOffset', Number(e.target.value))
                }
                disabled={controlsDisabled}
              />
            </label>
            <label>
              Brightness {style.brightness.toFixed(2)}
              <input
                type="range"
                min="0.85"
                max="1.3"
                step="0.01"
                value={style.brightness}
                onChange={(e) =>
                  restyleFromSubject('brightness', Number(e.target.value))
                }
                disabled={controlsDisabled}
              />
            </label>
            <label>
              Contrast {style.contrast.toFixed(2)}
              <input
                type="range"
                min="0.85"
                max="1.4"
                step="0.01"
                value={style.contrast}
                onChange={(e) =>
                  restyleFromSubject('contrast', Number(e.target.value))
                }
                disabled={controlsDisabled}
              />
            </label>
            <label>
              Saturation {style.saturation.toFixed(2)}
              <input
                type="range"
                min="0.8"
                max="1.5"
                step="0.01"
                value={style.saturation}
                onChange={(e) =>
                  restyleFromSubject('saturation', Number(e.target.value))
                }
                disabled={controlsDisabled}
              />
            </label>
            <label className="color-control">
              Passport Background
              <div className="color-inline">
                <input
                  type="color"
                  value={style.backgroundColor}
                  onChange={(e) =>
                    restyleFromSubject('backgroundColor', e.target.value)
                  }
                  disabled={controlsDisabled}
                />
                <span>{style.backgroundColor}</span>
              </div>
            </label>
            <label className="color-control">
              Border Color
              <div className="color-inline">
                <input
                  type="color"
                  value={style.borderColor}
                  onChange={(e) =>
                    restyleFromSubject('borderColor', e.target.value)
                  }
                  disabled={controlsDisabled}
                />
                <span>{style.borderColor}</span>
              </div>
            </label>
            <label>
              Border Thickness {style.borderWidth}px
              <input
                type="range"
                min="0"
                max="8"
                step="1"
                value={style.borderWidth}
                onChange={(e) =>
                  restyleFromSubject('borderWidth', Number(e.target.value))
                }
                disabled={controlsDisabled}
              />
            </label>
          </div>

          <button
            className="download-btn"
            onClick={downloadSheet}
            disabled={!sheetPreview}
          >
            Download 4x6 PNG
          </button>

          <p className="status">{status}</p>
        </article>

        <article className="panel preview-panel">
          <h2>Preview</h2>
          <div className="preview-grid">
            <figure>
              <figcaption>Original</figcaption>
              {sourcePreview ? (
                <img src={sourcePreview} alt="Uploaded portrait" />
              ) : (
                <div className="placeholder">Waiting for upload</div>
              )}
            </figure>
            <figure>
              <figcaption>Styled Passport</figcaption>
              {subjectPreview ? (
                <img src={subjectPreview} alt="Styled passport photo" />
              ) : (
                <div className="placeholder">Generated after processing</div>
              )}
            </figure>
          </div>

          <figure className="sheet-preview">
            <figcaption>4x6 Sheet ({layoutInfo.copies} photos)</figcaption>
            {sheetPreview ? (
              <img src={sheetPreview} alt="4x6 print sheet" />
            ) : (
              <div className="placeholder wide">
                4x6 output appears here after generation
              </div>
            )}
          </figure>
        </article>
      </section>

      <section className="specs-panel">
        <h2>Print Specs</h2>
        <ul>
          <li>Country preset: {activeCountrySpec.label}</li>
          <li>{printDetails.passport}</li>
          <li>{printDetails.sheet}</li>
          <li>{printDetails.copies}</li>
        </ul>
      </section>

      <section className="legal-panel" aria-label="Legal notice">
        <p>
          Copyright {currentYear} {COPYRIGHT_OWNER}. All rights reserved.
        </p>
        <p>
          Unauthorized copying, redistribution, reverse engineering, or resale
          of this app, generated templates, design system, and source code is
          strictly prohibited without prior written permission from {COPYRIGHT_OWNER}.
        </p>
      </section>
    </main>
  )
}

export default App
