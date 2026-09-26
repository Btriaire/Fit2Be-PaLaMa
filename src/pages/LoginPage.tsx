import { useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { login } from '../lib/auth'

/** Écran de connexion : protège la sauvegarde et les fonctions IA côté serveur. */
export default function LoginPage({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError(null)
    const r = await login(password)
    setBusy(false)
    if (r.ok) onDone()
    else setError(r.error ?? 'Connexion impossible.')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-zinc-100">
      <form onSubmit={submit} className="w-full max-w-xs">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-teal-500 shadow-[0_0_40px_rgba(226,54,28,0.45)]">
          <Lock size={28} className="text-zinc-950" strokeWidth={2.4} />
        </div>
        <h1 className="mb-1 text-center text-2xl font-extrabold tracking-tight">Fit2Be</h1>
        <p className="mb-6 text-center text-sm text-zinc-400">Entre ton mot de passe pour retrouver ta sauvegarde.</p>

        <label htmlFor="login-password" className="mb-1 block text-xs text-zinc-400">
          Mot de passe
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          aria-invalid={error != null}
          className={`mb-2 min-h-12 w-full rounded-xl bg-zinc-900 px-4 text-base outline-none focus:ring-2 focus:ring-teal-400/60 ${error ? 'ring-2 ring-orange-500/70' : ''}`}
        />
        {error && (
          <p role="alert" className="mb-2 text-sm text-orange-300">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!password || busy}
          className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 font-semibold text-zinc-950 disabled:opacity-50 active:scale-[0.98]"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
