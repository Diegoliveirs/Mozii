import { test, expect, type Page } from '@playwright/test'
import { resetTestUser } from './helpers/reset'
import { admin, api, expireTrial, hasAdmin, signInOrUp } from './helpers/api'

// usuário fixo E2E, resetado antes da execução (sem casal → cai no pareamento)
const userA = { name: 'Ana Teste', email: 'mozii.e2e.a@gmail.com', password: 'senha-teste-123' }

// 1x1 PNG — foto mínima válida para o upload
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

test.beforeAll(async () => {
  await resetTestUser(userA.email, userA.password, userA.name)
})

async function login(page: Page) {
  await page.goto('/entrar')
  await page.getByPlaceholder('E-mail').fill(userA.email)
  await page.getByPlaceholder('Senha').fill(userA.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

test('momentos + hub cinema + paywall no limite', async ({ page }) => {
  const apiErrors: string[] = []
  page.on('response', (res) => {
    if (res.url().includes('supabase.co') && res.status() >= 400) {
      apiErrors.push(`${res.status()} ${res.url()}`)
    }
  })

  // login + cria espaço (trial premium ativo por 7 dias)
  await login(page)
  await page.waitForURL(/\/parear/, { timeout: 15_000 })
  await page.getByText('Criar nosso espaço').click()
  await expect(page.locator('p.font-mono')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page).toHaveURL('/', { timeout: 10_000 })

  // a nova navegação em hubs
  await expect(page.getByRole('link', { name: 'Momentos' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Cinema' })).toBeVisible()

  // hub Cinema: /buscar redireciona e o segmented control alterna as abas na URL
  await page.goto('/buscar')
  await expect(page).toHaveURL(/\/cinema$/, { timeout: 10_000 })
  await expect(page.getByPlaceholder('Buscar filme…')).toBeVisible()
  await page.getByRole('button', { name: 'Listas' }).click()
  await expect(page).toHaveURL(/aba=listas/)
  await expect(page.getByRole('button', { name: 'Nova lista' })).toBeVisible()
  await page.goto('/listas')
  await expect(page).toHaveURL(/aba=listas/, { timeout: 10_000 })
  console.log('[cinema] redirects e abas OK')

  // Momentos: estado vazio → cria um momento (foto + legenda)
  await page.getByRole('link', { name: 'Momentos' }).click()
  await expect(page).toHaveURL(/\/momentos/, { timeout: 10_000 })
  await expect(page.getByText('Nenhum momento ainda', { exact: false })).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Novo momento' }).click()
  const sheet = page.locator('.sheet-in')
  await expect(sheet).toBeVisible()
  await sheet.locator('input[type="file"]').setInputFiles({
    name: 'momento.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG, 'base64'),
  })
  await sheet.locator('textarea').fill('Nosso primeiro momento juntos.')
  await sheet.getByRole('button', { name: 'Guardar momento' }).click()

  await expect(page.getByText('Nosso primeiro momento juntos.')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('hoje').first()).toBeVisible()
  console.log('[momentos] criado e visível na timeline')

  // Paywall: no plano grátis o 6º momento do mês é bloqueado pelo RLS.
  // Semeia até 5 + expira o trial e confirma o paywall (requer service-role).
  if (hasAdmin) {
    const { token, userId } = await signInOrUp(userA.email, userA.password, userA.name)
    const prof = await api(`/rest/v1/profiles?id=eq.${userId}&select=couple_id`, token)
    const [{ couple_id: coupleId }] = await prof.json()

    for (let i = 0; i < 4; i++) {
      const res = await admin('/rest/v1/moments', {
        method: 'POST',
        body: JSON.stringify({ couple_id: coupleId, author_id: userId, caption: `semente ${i}` }),
      })
      if (!res.ok) throw new Error(`seed momento falhou (${res.status})`)
    }
    await expireTrial(coupleId)

    await page.goto('/momentos')
    await expect(page.getByText('semente 0')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Novo momento' }).click()
    await expect(page.getByText('Limite de momentos atingido')).toBeVisible({ timeout: 10_000 })
    console.log('[momentos] paywall no limite free OK')
  } else {
    console.log('[momentos] sem service-role — teste de paywall pulado')
  }

  expect(apiErrors, `erros de API: ${apiErrors.join(' ; ')}`).toEqual([])
})
