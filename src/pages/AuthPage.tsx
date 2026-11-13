import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail, Lock, User as UserIcon } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Logo } from '../components/Logo'

export function AuthPage() {
  const { signIn, signUp, requestPasswordReset } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [busy, setBusy] = useState(false)

  function switchMode(next: 'signin' | 'signup' | 'forgot') {
    setMode(next)
    setError(null)
    setResetSent(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    if (mode === 'forgot') {
      const res = await requestPasswordReset(email)
      setBusy(false)
      if (res.error) setError(res.error)
      else setResetSent(true)
      return
    }
    const res =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, name)
    setBusy(false)
    if (res.error) {
      setError(res.error)
    } else {
      navigate('/')
    }
  }

  const title = mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link
            to="/"
            aria-label="Back to home"
            className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">{title}</h1>
        </div>
      </header>
      <main className="flex-1 px-4 py-6">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo size={56} />
          <h2 className="text-xl font-extrabold text-ocean-900">MoryonGo</h2>
          <p className="text-sm text-ocean-700">
            {mode === 'forgot'
              ? 'Enter your account email and we will send you a link to choose a new password.'
              : 'Sign in to save your places and recent searches.'}
          </p>
        </div>

        {mode === 'forgot' && resetSent ? (
          <div className="card space-y-4 text-center">
            <p className="rounded-xl bg-leaf-50 px-3 py-2 text-sm font-semibold text-leaf-700">
              If an account exists for {email}, a reset link is on its way. Check your inbox and spam folder.
            </p>
            <button type="button" onClick={() => switchMode('signin')} className="btn-primary w-full">
              Back to Sign In
            </button>
          </div>
        ) : (
        <form onSubmit={submit} className="card space-y-4">
          {mode === 'signup' && (
            <Field
              label="Name"
              icon={<UserIcon size={18} className="text-ocean-500" />}
              value={name}
              onChange={setName}
              type="text"
              placeholder="Juan dela Cruz"
              required
            />
          )}
          <Field
            label="Email"
            icon={<Mail size={18} className="text-ocean-500" />}
            value={email}
            onChange={setEmail}
            type="email"
            placeholder="you@email.com"
            required
          />
          {mode !== 'forgot' && (
            <div>
              <Field
                label="Password"
                icon={<Lock size={18} className="text-ocean-500" />}
                value={password}
                onChange={setPassword}
                type="password"
                placeholder="••••••••"
                required
              />
              {mode === 'signin' && (
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-sm font-semibold text-ocean-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy
              ? 'Please wait…'
              : mode === 'signin'
                ? 'Sign In'
                : mode === 'signup'
                  ? 'Create Account'
                  : 'Send Reset Link'}
          </button>

          {mode !== 'forgot' ? (
            <button
              type="button"
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              className="w-full text-center text-sm font-semibold text-ocean-700 hover:underline"
            >
              {mode === 'signin'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="w-full text-center text-sm font-semibold text-ocean-700 hover:underline"
            >
              Back to Sign In
            </button>
          )}
        </form>
        )}

        <p className="mt-4 px-2 text-center text-xs text-ocean-600">
          Email confirmation is off. Use a real email you can remember.
        </p>
      </main>
    </div>
  )
}

interface FieldProps {
  label: string
  icon: React.ReactNode
  value: string
  onChange: (v: string) => void
  type: string
  placeholder: string
  required?: boolean
}

function Field({ label, icon, value, onChange, type, placeholder, required }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ocean-800">{label}</span>
      <span className="flex items-center gap-2 rounded-xl border border-ocean-100 bg-white px-3 py-2.5 focus-within:border-ocean-400">
        {icon}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full bg-transparent text-base text-ocean-900 focus:outline-none"
        />
      </span>
    </label>
  )
}
