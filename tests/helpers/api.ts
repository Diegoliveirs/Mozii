import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function loadEnv(): { url: string; key: string } {
  const here = dirname(fileURLToPath(import.meta.url))
  const raw = readFileSync(resolve(here, '../../.env.local'), 'utf-8')
  const get = (name: string) => raw.match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1].trim() ?? ''
  return { url: get('VITE_SUPABASE_URL'), key: get('VITE_SUPABASE_ANON_KEY') }
}

export const { url: BASE, key: KEY } = loadEnv()

/** Chamada crua à API do Supabase (auth/rest/storage), com apikey e token opcional. */
export async function api(path: string, token: string | null, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    apikey: KEY,
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  }
  return fetch(`${BASE}${path}`, { ...init, headers })
}

/** Garante o usuário (signup idempotente) e devolve token + id da sessão logada. */
export async function signInOrUp(email: string, password: string, displayName: string) {
  await api('/auth/v1/signup', null, {
    method: 'POST',
    body: JSON.stringify({ email, password, data: { display_name: displayName } }),
  })
  const res = await api('/auth/v1/token?grant_type=password', null, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`login de ${email} falhou (${res.status})`)
  const { access_token, user } = await res.json()
  return { token: access_token as string, userId: user.id as string }
}
