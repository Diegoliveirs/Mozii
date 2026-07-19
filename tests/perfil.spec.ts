import { test, expect, type Page } from '@playwright/test'
import { resetTestUser } from './helpers/reset'
import { admin, hasAdmin, signInOrUp } from './helpers/api'

const userA = { name: 'Ana Teste', email: 'mozii.e2e.a@gmail.com', password: 'senha-teste-123' }
const userB = { name: 'Diego Teste', email: 'mozii.e2e.b@gmail.com', password: 'senha-teste-123' }

test.beforeAll(async () => {
  await resetTestUser(userA.email, userA.password, userA.name)
  await resetTestUser(userB.email, userB.password, userB.name)
  // favoritos são por pessoa e sobrevivem à troca de espaço (couple_id na linha) —
  // o anon não os enxerga fora do espaço atual, então a limpeza é via service-role
  if (hasAdmin) {
    for (const u of [userA, userB]) {
      const { userId } = await signInOrUp(u.email, u.password, u.name)
      await admin(`/rest/v1/favorites?profile_id=eq.${userId}`, { method: 'DELETE' })
    }
  }
})

async function login(page: Page, user: typeof userA) {
  await page.goto('/entrar')
  await page.getByPlaceholder('E-mail').fill(user.email)
  await page.getByPlaceholder('Senha').fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

test('perfil estilo Letterboxd: favoritos, avaliações, atividade, ajustes', async ({ browser }) => {
  const ctxA = await browser.newContext()
  const page = await ctxA.newPage()
  const apiErrors: string[] = []
  page.on('response', (res) => {
    if (res.url().includes('supabase.co') && res.status() >= 400) apiErrors.push(`${res.status()} ${res.url()}`)
  })

  // A: login + cria espaço
  await login(page, userA)
  await page.waitForURL(/\/parear/, { timeout: 15_000 })
  await page.getByText('Criar nosso espaço').click()
  const codeEl = page.locator('p.font-mono')
  await expect(codeEl).toBeVisible({ timeout: 10_000 })
  const code = (await codeEl.textContent())!.trim()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page).toHaveURL('/', { timeout: 10_000 })

  // A: avalia um filme (gera review + entra na atividade recente)
  await page.goto('/buscar')
  await page.getByPlaceholder('Buscar filme…').fill('cidade de deus')
  await page.locator('ul a').first().click()
  await page.getByRole('button', { name: /Avaliar/ }).click()
  await page.locator('button[aria-label="4 estrelas"]').click()
  await page.locator('textarea').fill('Review no perfil.')
  await page.getByRole('button', { name: 'Publicar' }).click()
  await expect(page).toHaveURL('/', { timeout: 10_000 })

  // A: adiciona à lista e marca como visto (gera atividade "assistiu")
  await page.goto('/buscar')
  await page.getByPlaceholder('Buscar filme…').fill('duna parte 2')
  await page.locator('ul a').first().click()
  await page.getByRole('button', { name: /Adicionar à lista/ }).click()
  await page.getByPlaceholder('Nome da lista').fill('Vistos')
  await page.getByRole('button', { name: 'Criar' }).click()
  await expect(page.getByText(/^Adicionar à lista:/)).toBeHidden({ timeout: 15_000 })
  await page.goto('/listas')
  await page.getByRole('link', { name: /^Vistos/ }).click()
  await page.locator('button[aria-label="Visto"]').first().click()
  // espera o round-trip (a atividade "assistiu" é inserida no mesmo mutationFn)
  await expect(page.locator('button[aria-label="Visto"]').first()).toHaveClass(/rose/, { timeout: 10_000 })

  // --- Perfil próprio ---
  await page.goto('/perfil')
  await expect(page.getByText(userA.name).first()).toBeVisible({ timeout: 10_000 })

  // Favoritos: adiciona um via picker
  await page.getByRole('button', { name: 'Adicionar favorito' }).click()
  const sheet = page.locator('.sheet-in')
  await sheet.getByPlaceholder('Buscar filme…').fill('matrix')
  const pick = sheet.locator('ul button').first()
  await expect(pick).toBeVisible({ timeout: 15_000 })
  await pick.click()
  await expect(page.getByRole('button', { name: 'Remover favorito' })).toHaveCount(1, { timeout: 10_000 })
  console.log('[perfil] favorito adicionado')

  // Avaliações recentes: clicar no pôster abre a review
  await expect(page.getByText('Avaliações recentes')).toBeVisible({ timeout: 10_000 })
  await page.locator('a[href^="/post/"]').first().click()
  await expect(page).toHaveURL(/\/post\//, { timeout: 10_000 })
  console.log('[perfil] avaliação recente abre a review')

  // Atividade pessoal: mostra "assistiu"
  await page.goto('/perfil')
  await expect(page.getByText(/assistiu/).first()).toBeVisible({ timeout: 10_000 })
  console.log('[perfil] evento "assistiu" no feed pessoal')

  // Engrenagem → Ajustes
  await page.getByRole('link', { name: 'Ajustes' }).click()
  await expect(page).toHaveURL(/\/ajustes/, { timeout: 10_000 })
  await expect(page.getByText('Nossos números')).toBeVisible({ timeout: 10_000 })
  console.log('[perfil] engrenagem abre Ajustes')

  // --- Perfil do par (somente leitura) ---
  const ctxB = await browser.newContext()
  const pageB = await ctxB.newPage()
  await login(pageB, userB)
  await pageB.waitForURL(/\/parear/, { timeout: 15_000 })
  await pageB.getByPlaceholder('código de 6 letras').fill(code)
  await pageB.getByRole('button', { name: 'Entrar no espaço' }).click()
  await expect(pageB).toHaveURL('/', { timeout: 10_000 })

  await page.goto('/perfil')
  await page.getByRole('button', { name: userB.name }).click()
  await expect(page).toHaveURL(/\/perfil\//, { timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'Adicionar favorito' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Ajustes' })).toHaveCount(0)
  console.log('[perfil] perfil do par em modo leitura')

  expect(apiErrors, `erros de API: ${apiErrors.join(' ; ')}`).toEqual([])
})
