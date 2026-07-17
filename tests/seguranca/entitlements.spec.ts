import { test, expect } from '@playwright/test'
import { api, admin, hasAdmin, signInOrUp, expireTrial, seedSubscription } from '../helpers/api'
import { resetTestUser } from '../helpers/reset'

/**
 * Prova que o entitlement por ESPAÇO (010_subscriptions.sql) não é contornável
 * pela Data API: quota de listas free, limite de membros 2/8, escrita em
 * subscriptions bloqueada, isolamento entre espaços e trava do pagante.
 * Usuários próprios (não os 2 fixos do fluxo-casal) — workers: 1.
 */

const uA = { name: 'Ent A', email: 'mozii.ent.a@gmail.com', password: 'senha-teste-123' }
const uB = { name: 'Ent B', email: 'mozii.ent.b@gmail.com', password: 'senha-teste-123' }
const uC = { name: 'Ent C', email: 'mozii.ent.c@gmail.com', password: 'senha-teste-123' }
const uD = { name: 'Ent D', email: 'mozii.ent.d@gmail.com', password: 'senha-teste-123' }
const uZ = { name: 'Ent Z', email: 'mozii.ent.z@gmail.com', password: 'senha-teste-123' }

const json = { Prefer: 'return=representation' }

let a: { token: string; userId: string }
let b: { token: string; userId: string }
let c: { token: string; userId: string }
let d: { token: string; userId: string }
let z: { token: string; userId: string }
let coupleId: string
let inviteCode: string
let coupleZId: string

test.skip(!hasAdmin, 'requer service-role para fixtures (expirar trial / semear assinatura)')

test.beforeAll(async () => {
  for (const u of [uA, uB, uC, uD, uZ]) await resetTestUser(u.email, u.password, u.name)
  a = await signInOrUp(uA.email, uA.password, uA.name)
  b = await signInOrUp(uB.email, uB.password, uB.name)
  c = await signInOrUp(uC.email, uC.password, uC.name)
  d = await signInOrUp(uD.email, uD.password, uD.name)
  z = await signInOrUp(uZ.email, uZ.password, uZ.name)

  // zera o rate-limit de invite acumulado por execuções anteriores (janela de 15min)
  const ids = [a, b, c, d, z].map((u) => u.userId).join(',')
  await admin(`/rest/v1/join_attempts?user_id=in.(${ids})`, { method: 'DELETE' })

  const couple = await (await api('/rest/v1/rpc/create_couple', a.token, { method: 'POST', body: '{}' })).json()
  coupleId = couple.id
  inviteCode = couple.invite_code
  const coupleZ = await (await api('/rest/v1/rpc/create_couple', z.token, { method: 'POST', body: '{}' })).json()
  coupleZId = coupleZ.id
})

test('trial vigente: espaço novo é premium (listas além de 3, entitlement)', async () => {
  for (let i = 1; i <= 4; i++) {
    const res = await api('/rest/v1/lists', a.token, {
      method: 'POST',
      body: JSON.stringify({ couple_id: coupleId, name: `L${i}`, created_by: a.userId }),
    })
    expect(res.status, `lista ${i} criada no trial`).toBe(201)
  }
  const ent = await (await api('/rest/v1/rpc/get_entitlement', a.token, { method: 'POST', body: '{}' })).json()
  expect(ent.is_premium, 'premium pelo trial').toBe(true)
  expect(ent.plan, 'sem plano pago').toBeNull()
  expect(ent.trial_ends_at, 'trial registrado').toBeTruthy()
})

test('trial expirado: 5ª lista é recusada com 42501; free segue com as 4', async () => {
  await expireTrial(coupleId)
  const res = await api('/rest/v1/lists', a.token, {
    method: 'POST',
    body: JSON.stringify({ couple_id: coupleId, name: 'L5', created_by: a.userId }),
  })
  expect(res.status, '5ª lista bloqueada').toBe(403)
  const body = await res.json()
  expect(body.code, 'violação de RLS').toBe('42501')
})

test('membros: 2º entra no free; 3º é recusado com a mensagem conhecida', async () => {
  const join = await (await api('/rest/v1/rpc/join_couple', b.token, { method: 'POST', body: JSON.stringify({ code: inviteCode }) })).json()
  expect(join?.id, '2º membro entra').toBe(coupleId)

  const res = await api('/rest/v1/rpc/join_couple', c.token, { method: 'POST', body: JSON.stringify({ code: inviteCode }) })
  expect(res.status, '3º membro recusado').toBeGreaterThanOrEqual(400)
  const body = await res.json()
  expect(body.message, 'mensagem que a UI conhece').toContain('completo')
})

test('código inválido devolve null e o rate-limit trava após 5 falhas', async () => {
  const first = await api('/rest/v1/rpc/join_couple', c.token, { method: 'POST', body: JSON.stringify({ code: 'XXXXXX' }) })
  expect(first.status, 'código inválido não é exception').toBe(200)
  const firstBody = await first.json()
  expect(firstBody?.id ?? null, 'retorno null/vazio').toBeNull()

  for (let i = 0; i < 5; i++)
    await api('/rest/v1/rpc/join_couple', c.token, { method: 'POST', body: JSON.stringify({ code: 'YYYYYY' }) })
  const blocked = await api('/rest/v1/rpc/join_couple', c.token, { method: 'POST', body: JSON.stringify({ code: 'ZZZZZZ' }) })
  const body = await blocked.json()
  expect(body.message, 'rate-limit ativo').toContain('tentativas')
})

test('escrita direta em subscriptions é bloqueada para authenticated', async () => {
  const ins = await api('/rest/v1/subscriptions', a.token, {
    method: 'POST',
    body: JSON.stringify({ couple_id: coupleId, status: 'active', is_lifetime: true }),
  })
  expect(ins.status, 'INSERT bloqueado').toBeGreaterThanOrEqual(400)

  await seedSubscription(coupleId, { paid_by: a.userId })
  const upd = await api(`/rest/v1/subscriptions?couple_id=eq.${coupleId}`, a.token, {
    method: 'PATCH',
    headers: json,
    body: JSON.stringify({ is_lifetime: true }),
  })
  // PATCH sem privilégio: ou 4xx, ou 200 sem linhas afetadas
  const updRows = await upd.json().catch(() => [])
  expect(
    upd.status >= 400 || (Array.isArray(updRows) && updRows.length === 0),
    'UPDATE bloqueado',
  ).toBe(true)
  const [row] = await (await admin(`/rest/v1/subscriptions?couple_id=eq.${coupleId}&select=is_lifetime`)).json()
  expect(row.is_lifetime, 'nada mudou').toBe(false)
})

test('com assinatura ativa: 3º membro entra (grupo) e listas liberam', async () => {
  const join = await (await api('/rest/v1/rpc/join_couple', d.token, { method: 'POST', body: JSON.stringify({ code: inviteCode }) })).json()
  expect(join?.id, '3º membro entra com premium').toBe(coupleId)

  const res = await api('/rest/v1/lists', a.token, {
    method: 'POST',
    body: JSON.stringify({ couple_id: coupleId, name: 'L5', created_by: a.userId }),
  })
  expect(res.status, '5ª lista com premium').toBe(201)

  const ent = await (await api('/rest/v1/rpc/get_entitlement', a.token, { method: 'POST', body: '{}' })).json()
  expect(ent.is_premium).toBe(true)
  expect(ent.plan).toBe('monthly')
  expect(ent.price_amount, 'valor exposto p/ UI').toBe(990)
  expect(ent.current_period_end, 'próxima renovação exposta').toBeTruthy()
})

test('isolamento: Z (outro espaço) não vê listas nem assinatura do espaço A', async () => {
  const lists = await (await api(`/rest/v1/lists?couple_id=eq.${coupleId}&select=id`, z.token)).json()
  expect(lists, 'listas invisíveis').toHaveLength(0)
  const subs = await (await api(`/rest/v1/subscriptions?couple_id=eq.${coupleId}&select=*`, z.token)).json()
  expect(subs, 'assinatura invisível').toHaveLength(0)
})

test('profiles.couple_id é imutável por PATCH direto', async () => {
  const res = await api(`/rest/v1/profiles?id=eq.${a.userId}`, a.token, {
    method: 'PATCH',
    body: JSON.stringify({ couple_id: coupleZId }),
  })
  expect(res.status, 'troca de espaço só via RPC').toBeGreaterThanOrEqual(400)
})

test('trava do pagante: quem paga não sai nem exclui a conta; os demais saem', async () => {
  const leave = await api('/rest/v1/rpc/leave_couple', a.token, { method: 'POST', body: '{}' })
  const leaveBody = await leave.json().catch(() => ({}))
  expect(leaveBody.message ?? '', 'pagante bloqueado ao sair').toContain('assinatura')

  const del = await api('/rest/v1/rpc/request_account_deletion', a.token, { method: 'POST', body: '{}' })
  const delBody = await del.json().catch(() => ({}))
  expect(delBody.message ?? '', 'pagante bloqueado ao excluir').toContain('assinatura')

  const leaveB = await api('/rest/v1/rpc/leave_couple', b.token, { method: 'POST', body: '{}' })
  expect(leaveB.status, 'não-pagante sai normal').toBeLessThan(400)
})

test('cancel_at_period_end libera a saída do pagante', async () => {
  await admin(`/rest/v1/subscriptions?couple_id=eq.${coupleId}`, {
    method: 'PATCH',
    body: JSON.stringify({ cancel_at_period_end: true }),
  })
  const leave = await api('/rest/v1/rpc/leave_couple', a.token, { method: 'POST', body: '{}' })
  expect(leave.status, 'pagante sai após marcar cancelamento').toBeLessThan(400)
})

test.afterAll(async () => {
  if (coupleId) await admin(`/rest/v1/couples?id=eq.${coupleId}`, { method: 'DELETE' })
  if (coupleZId) await admin(`/rest/v1/couples?id=eq.${coupleZId}`, { method: 'DELETE' })
  for (const u of [uA, uB, uC, uD, uZ]) await resetTestUser(u.email, u.password, u.name)
})
