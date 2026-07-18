import { test, expect } from '@playwright/test'
import { createHmac } from 'node:crypto'
import { api, admin, hasAdmin, signInOrUp, BASE, KEY, WEBHOOK_SIGNING_SECRET } from '../helpers/api'
import { resetTestUser } from '../helpers/reset'

/**
 * Prova a Edge Function stripe-webhook DEPLOYADA no staging, sem passar pelo
 * Stripe: (1) assinatura HMAC inválida → 400; (2) checkout.session.completed
 * (payment) assinado com o segredo real concede vitalício ao ESPAÇO;
 * (3) replay do mesmo evento é idempotente; (4) stripe-cancel exige JWT.
 *
 * O caso (2) exige que STRIPE_WEBHOOK_SIGNING_SECRET em
 * supabase/functions/.env seja o MESMO configurado nos secrets do staging.
 */

const WEBHOOK_URL = `${BASE}/functions/v1/stripe-webhook`
const wh = { name: 'Webhook User', email: 'mozii.webhook@gmail.com', password: 'senha-teste-123' }

function sign(payload: string, secret: string, ts: number): string {
  const mac = createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex')
  return `t=${ts},v1=${mac}`
}

async function postEvent(payload: string, signature: string): Promise<Response> {
  return fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': signature },
    body: payload,
  })
}

test.skip(!hasAdmin, 'requer service-role para fixtures')

let coupleId: string
let userId: string

test.beforeAll(async () => {
  await resetTestUser(wh.email, wh.password, wh.name)
  const u = await signInOrUp(wh.email, wh.password, wh.name)
  userId = u.userId
  const couple = await (await api('/rest/v1/rpc/create_couple', u.token, { method: 'POST', body: '{}' })).json()
  coupleId = couple.id
})

test('assinatura HMAC inválida é rejeitada com 400', async () => {
  const payload = JSON.stringify({ id: 'evt_bad', type: 'checkout.session.completed', data: { object: {} } })
  const res = await postEvent(payload, `t=${Math.floor(Date.now() / 1000)},v1=deadbeef`)
  expect(res.status, 'evento sem assinatura válida rejeitado').toBe(400)

  const rows = await (await admin(`/rest/v1/subscriptions?couple_id=eq.${coupleId}`)).json()
  expect(rows, 'nada gravado').toHaveLength(0)
})

function lifetimeEvent(): string {
  return JSON.stringify({
    id: 'evt_test_lifetime_v2',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1',
        object: 'checkout.session',
        mode: 'payment',
        payment_status: 'paid',
        customer: 'cus_test_1',
        amount_total: 4990,
        currency: 'brl',
        client_reference_id: coupleId,
        metadata: { couple_id: coupleId, supabase_user_id: userId, plan: 'lifetime' },
      },
    },
  })
}

test('evento assinado concede vitalício ao espaço (e replay é idempotente)', async () => {
  test.skip(!WEBHOOK_SIGNING_SECRET, 'STRIPE_WEBHOOK_SIGNING_SECRET ausente em supabase/functions/.env')

  const payload = lifetimeEvent()
  const res = await postEvent(payload, sign(payload, WEBHOOK_SIGNING_SECRET, Math.floor(Date.now() / 1000)))
  expect(res.status, 'evento assinado aceito').toBe(200)

  const rows = await (await admin(`/rest/v1/subscriptions?couple_id=eq.${coupleId}`)).json()
  expect(rows, 'assinatura gravada').toHaveLength(1)
  expect(rows[0].is_lifetime, 'vitalício').toBe(true)
  expect(rows[0].status, 'ativa').toBe('active')
  expect(rows[0].plan).toBe('lifetime')
  expect(rows[0].price_amount, 'valor gravado p/ UI').toBe(4990)
  expect(rows[0].paid_by, 'pagante registrado').toBe(userId)

  // replay: mesmo evento, estado final idêntico (upsert por couple_id)
  const replay = await postEvent(payload, sign(payload, WEBHOOK_SIGNING_SECRET, Math.floor(Date.now() / 1000)))
  expect(replay.status, 'replay aceito').toBe(200)
  const after = await (await admin(`/rest/v1/subscriptions?couple_id=eq.${coupleId}`)).json()
  expect(after, 'sem duplicata').toHaveLength(1)
  expect(after[0].is_lifetime).toBe(true)
})

test('fixture sem couple_id (stripe trigger) responde 200 sem gravar', async () => {
  test.skip(!WEBHOOK_SIGNING_SECRET, 'STRIPE_WEBHOOK_SIGNING_SECRET ausente em supabase/functions/.env')

  const payload = JSON.stringify({
    id: 'evt_test_fixture',
    object: 'event',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_fixture', object: 'checkout.session', mode: 'payment', payment_status: 'paid' } },
  })
  const res = await postEvent(payload, sign(payload, WEBHOOK_SIGNING_SECRET, Math.floor(Date.now() / 1000)))
  expect(res.status, 'no-op com 200').toBe(200)
})

test('stripe-cancel e stripe-checkout exigem JWT de usuário', async () => {
  for (const fn of ['stripe-cancel', 'stripe-checkout']) {
    const res = await fetch(`${BASE}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
      body: '{}',
    })
    expect(res.status, `${fn} sem JWT → 401`).toBe(401)
  }
})

test.afterAll(async () => {
  if (coupleId) {
    await admin(`/rest/v1/subscriptions?couple_id=eq.${coupleId}`, { method: 'DELETE' })
    await admin(`/rest/v1/couples?id=eq.${coupleId}`, { method: 'DELETE' })
  }
  await resetTestUser(wh.email, wh.password, wh.name)
})
