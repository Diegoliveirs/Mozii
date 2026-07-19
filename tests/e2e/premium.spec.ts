import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { admin, hasAdmin } from '../helpers/api'
import { resetTestUser } from '../helpers/reset'

/**
 * Fluxo REAL de assinatura, ponta a ponta e sem sair do app:
 * login → /premium → Embedded Checkout num modal (cartão de teste 4242) →
 * onComplete → webhook grava → premium confirmado SEM F5 → cancelar dentro
 * do app → "Renovação cancelada".
 *
 * Requer VITE_STRIPE_PUBLISHABLE_KEY no .env.local + secrets reais no staging
 * (checkout/webhook). Sem isso, o spec inteiro é pulado.
 */

const here = dirname(fileURLToPath(import.meta.url))
const envLocal = (() => {
  try {
    return readFileSync(resolve(here, '../../.env.local'), 'utf-8')
  } catch {
    return ''
  }
})()
const HAS_STRIPE_KEY = /^VITE_STRIPE_PUBLISHABLE_KEY=pk_/m.test(envLocal)

const user = { name: 'Premium Teste', email: 'mozii.premium@gmail.com', password: 'senha-teste-123' }

test.skip(!HAS_STRIPE_KEY, 'VITE_STRIPE_PUBLISHABLE_KEY ausente no .env.local')
test.skip(!hasAdmin, 'requer service-role para limpeza')

let coupleId: string | null = null

test('assinar, confirmar sem F5 e cancelar — tudo dentro do app', async ({ page }) => {
  test.setTimeout(300_000)
  await resetTestUser(user.email, user.password, user.name)

  // login + espaço novo
  await page.goto('/entrar')
  await page.getByPlaceholder('E-mail').fill(user.email)
  await page.getByPlaceholder('Senha').fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL(/\/parear/, { timeout: 15_000 })
  await page.getByText('Criar nosso espaço').click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.waitForURL(/\/$/, { timeout: 10_000 })

  // /premium → o preço tem que estar visível no card ANTES de clicar
  await page.goto('/premium')
  const monthlyCard = page.locator('button', { has: page.getByText('Mensal', { exact: true }) }).first()
  await expect(monthlyCard).toContainText('R$', { timeout: 10_000 })
  await expect(monthlyCard).toContainText('/mês')

  // assinar o plano mensal → modal embedded (sem redirect)
  await monthlyCard.click()

  const frame = page.frameLocator('iframe[src*="stripe.com"], iframe[name^="embedded-checkout"]').first()
  const cardNumber = frame.locator('#cardNumber, input[placeholder*="1234"], input[autocomplete="cc-number"]').first()
  await expect(cardNumber, 'formulário do Stripe carregou no modal').toBeVisible({ timeout: 45_000 })

  // e-mail pode vir pré-preenchido pelo Customer; preenche só se vazio
  const email = frame.locator('#email, input[type="email"]').first()
  if ((await email.count()) > 0 && (await email.inputValue().catch(() => 'x')) === '') {
    await email.fill(user.email)
  }
  await cardNumber.fill('4242 4242 4242 4242')
  await frame.locator('#cardExpiry, input[autocomplete="cc-exp"]').first().fill('12 / 34')
  await frame.locator('#cardCvc, input[autocomplete="cc-csc"]').first().fill('123')
  const name = frame.locator('#billingName, input[autocomplete="cc-name"], input[name="billingName"]').first()
  if ((await name.count()) > 0) await name.fill(user.name)

  await frame.locator('button[type="submit"], .SubmitButton').first().click()

  // sem sair do app: modal fecha → "Confirmando pagamento…" → premium ativo
  await expect(page.getByText('Confirmando pagamento…')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(/Premium ativo|Aproveitem/)).toBeVisible({ timeout: 90_000 })

  // ajustes mostram plano + valor + próxima cobrança
  await page.goto('/ajustes')
  await expect(page.getByText('Premium ativo')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Plano mensal/)).toBeVisible()
  await expect(page.getByText(/Próxima cobrança em/)).toBeVisible()

  // cancelar DENTRO do app
  await page.getByRole('button', { name: 'Cancelar assinatura' }).click()
  await page
    .locator('.fixed')
    .getByRole('button', { name: 'Cancelar assinatura' })
    .last()
    .click()
  await expect(page.getByText(/Renovação cancelada/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Retomar assinatura' })).toBeVisible()
})

test.afterAll(async () => {
  // limpeza: cancela a subscription de teste no Stripe e apaga o espaço
  const users = await (await admin('/auth/v1/admin/users')).json().catch(() => ({ users: [] }))
  const u = users.users?.find((x: { email: string }) => x.email === user.email)
  if (u) {
    const profs = await (await admin(`/rest/v1/profiles?id=eq.${u.id}&select=couple_id`)).json()
    coupleId = profs[0]?.couple_id ?? null
  }
  if (coupleId) {
    const subs = await (await admin(`/rest/v1/subscriptions?couple_id=eq.${coupleId}&select=stripe_subscription_id`)).json()
    const stripeSubId = subs[0]?.stripe_subscription_id
    const fnEnv = (() => {
      try {
        return readFileSync(resolve(here, '../../supabase/functions/.env'), 'utf-8')
      } catch {
        return ''
      }
    })()
    const sk = fnEnv.match(/^STRIPE_SECRET_KEY=(sk_test_.+)$/m)?.[1]?.trim()
    if (stripeSubId && sk) {
      await fetch(`https://api.stripe.com/v1/subscriptions/${stripeSubId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sk}` },
      }).catch(() => {})
    }
    await admin(`/rest/v1/couples?id=eq.${coupleId}`, { method: 'DELETE' })
  }
  await resetTestUser(user.email, user.password, user.name)
})
