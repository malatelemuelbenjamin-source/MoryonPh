import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail, Lock, User as UserIcon } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Logo } from '../components/Logo'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
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
          <h1 className="text-lg font-bold">{mode === 'signin' ? 'Sign In' : 'Create Account'}</h1>
        </div>
      </header>
      <main className="flex-1 px-4 py-6">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo size={56} />
          <h2 className="text-xl font-extrabold text-ocean-900">MoryonGo</h2>
          <p className="text-sm text-ocean-700">
            Sign in to save your places and recent searches.
          </p>
        </div>

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
          <Field
            label="Password"
            icon={<Lock size={18} className="text-ocean-500" />}
            value={password}
            onChange={setPassword}
            type="password"
            placeholder="••••••••"
            required
          />

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="w-full text-center text-sm font-semibold text-ocean-700 hover:underline"
          >
            {mode === 'signin'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </form>

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
