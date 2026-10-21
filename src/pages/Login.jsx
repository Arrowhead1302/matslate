import { useState } from 'react'
import { supabase, friendlyError } from '../lib/supabase'
import { ErrorBox, Field } from '../components/ui'
import Logo from '../components/Logo'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function sendLink(e) {
    e?.preventDefault()
    setError(''); setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
    })
    setBusy(false)
    if (error) setError(friendlyError(error))
    else setSent(true)
  }

  async function verifyCode(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError(friendlyError(error))
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo"><Logo /></div>
        {!sent ? (
          <form onSubmit={sendLink}>
            <h1>Sign in</h1>
            <p className="lead">Enter your email. We'll send you a link to sign in — no password needed.</p>
            <Field label="Your email">
              <input
                type="email" required autoComplete="email" inputMode="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="coach@school.edu"
              />
            </Field>
            <ErrorBox error={error} />
            <button className="btn btn-primary btn-big btn-block" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>
            <p className="muted small center">New to MatSlate? Use this same button — you'll set up your account next.</p>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <h1>Check your email</h1>
            <p className="lead">
              We sent a message to <strong>{email}</strong>. Tap the <strong>Sign in</strong> button in that email.
            </p>
            <div className="divider"><span>or type the 6-digit code from the email</span></div>
            <Field label="Code">
              <input
                className="code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={8}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456"
              />
            </Field>
            <ErrorBox error={error} />
            <button className="btn btn-primary btn-big btn-block" disabled={busy || code.length < 6}>
              {busy ? 'Checking…' : 'Sign in with code'}
            </button>
            <p className="muted small center">
              Didn't get it? Check your spam folder, or{' '}
              <button type="button" className="link-btn" onClick={() => { setSent(false); setCode('') }}>try again</button>.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
