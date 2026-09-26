// Session mono-utilisateur côté client. L'app est « local d'abord » : hors ligne, ou si le
// serveur ne répond pas / n'exige pas de mot de passe, on ne bloque jamais l'utilisateur.
export type AuthState = 'checking' | 'ok' | 'login'

export async function checkSession(): Promise<Exclude<AuthState, 'checking'>> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    const r = await fetch('/api/session', { cache: 'no-store', signal: ctrl.signal })
    clearTimeout(timer)
    if (!r.ok) return 'ok'
    const j = (await r.json()) as { required?: boolean; authenticated?: boolean }
    return j.required && !j.authenticated ? 'login' : 'ok'
  } catch {
    // hors ligne, timeout, ou réponse non JSON (serveur de dev) : pas de blocage
    return 'ok'
  }
}

export async function login(password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (r.ok) return { ok: true }
    if (r.status === 401) return { ok: false, error: 'Mot de passe incorrect.' }
    return { ok: false, error: 'Le serveur ne répond pas correctement. Réessaie dans un instant.' }
  } catch {
    return { ok: false, error: 'Pas de connexion. Réessaie une fois en ligne.' }
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/session', { method: 'DELETE' })
  } catch {
    // déjà hors ligne : le cookie expirera de lui-même
  }
}
