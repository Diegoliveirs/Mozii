import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

function readEnvFile(rel: string): string {
  try {
    return readFileSync(resolve(here, rel), 'utf-8')
  } catch {
    return ''
  }
}

function loadEnv(): { url: string; key: string } {
  // overrides de ambiente (ex.: stack local do supabase CLI) têm prioridade
  const envUrl = process.env.SUPABASE_TEST_URL?.trim()
  const envKey = process.env.SUPABASE_TEST_ANON_KEY?.trim()
  if (envUrl && envKey) return { url: envUrl, key: envKey }

  const raw = readEnvFile('../../.env.local')
  const get = (name: string) => raw.match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1].trim() ?? ''
  return { url: envUrl || get('VITE_SUPABASE_URL'), key: envKey || get('VITE_SUPABASE_ANON_KEY') }
}

export const { url: BASE, key: KEY } = loadEnv()

// service-role usada APENAS para fixtures (expirar trial, semear subscription),
// nunca como o comportamento sob teste. Vem do env OU do arquivo local
// gitignored das functions (supabase/functions/.env — chave do staging).
const ADMIN_KEY =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY?.trim() ??
  readEnvFile('../../supabase/functions/.env')
    .match(/^SUPABASE_STAGING_SERVICE_ROLE_KEY=(.+)$/m)?.[1]
    .trim() ??
  ''

/** Segredo do webhook Stripe (staging) — só para o spec do webhook assinar eventos. */
export const WEBHOOK_SIGNING_SECRET =
  readEnvFile('../../supabase/functions/.env')
    .match(/^STRIPE_WEBHOOK_SIGNING_SECRET=(.+)$/m)?.[1]
    .trim() ?? ''

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

/** Chamada com service-role (bypassa RLS) — só para fixtures de teste. */
export function admin(path: string, init: RequestInit = {}) {
  if (!ADMIN_KEY) throw new Error('service-role ausente (SUPABASE_TEST_SERVICE_ROLE_KEY ou supabase/functions/.env)')
  const headers: Record<string, string> = {
    apikey: ADMIN_KEY,
    Authorization: `Bearer ${ADMIN_KEY}`,
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  }
  return fetch(`${BASE}${path}`, { ...init, headers })
}

export const hasAdmin = ADMIN_KEY.length > 0

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

/** Expira o trial do espaço (fixture: vira free imediatamente). */
export async function expireTrial(coupleId: string) {
  const res = await admin(`/rest/v1/couples?id=eq.${coupleId}`, {
    method: 'PATCH',
    body: JSON.stringify({ trial_ends_at: new Date(Date.now() - 86_400_000).toISOString() }),
  })
  if (!res.ok) throw new Error(`expireTrial falhou (${res.status})`)
}

/** Semeia assinatura no espaço (fixture). */
export async function seedSubscription(coupleId: string, overrides: Record<string, unknown> = {}) {
  const res = await admin('/rest/v1/subscriptions', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      couple_id: coupleId,
      plan: 'monthly',
      status: 'active',
      price_amount: 990,
      currency: 'brl',
      current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      ...overrides,
    }),
  })
  if (!res.ok) throw new Error(`seedSubscription falhou (${res.status})`)
}
