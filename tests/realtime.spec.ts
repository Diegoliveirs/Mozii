import { test, expect, type Page } from '@playwright/test'
import { resetTestUser } from './helpers/reset'

// realtime do casal: o que um faz aparece para o outro SEM reload.
// Depende da migration 009_realtime.sql aplicada no Supabase (publicação).
const userA = { name: 'Ana Teste', email: 'mozii.e2e.a@gmail.com', password: 'senha-teste-123' }
const userB = { name: 'Diego Teste', email: 'mozii.e2e.b@gmail.com', password: 'senha-teste-123' }

test.beforeAll(async () => {
  await resetTestUser(userA.email, userA.password, userA.name)
  await resetTestUser(userB.email, userB.password, userB.name)
})

async function login(page: Page, user: typeof userA) {
  await page.goto('/entrar')
  await page.getByPlaceholder('E-mail').fill(user.email)
  await page.getByPlaceholder('Senha').fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

test('mudanças do par chegam sem atualizar a tela', async ({ browser }) => {
  test.setTimeout(120_000)

  // A cria o espaço; B entra com o código
  const contextA = await browser.newContext()
  const pageA = await contextA.newPage()
  await login(pageA, userA)
  await pageA.waitForURL(/\/parear/, { timeout: 15_000 })
  await pageA.getByText('Criar nosso espaço').click()
  const codeEl = pageA.locator('p.font-mono')
  await expect(codeEl).toBeVisible({ timeout: 10_000 })
  const code = (await codeEl.textContent())!.trim()
  await pageA.getByRole('button', { name: 'Continuar' }).click()
  await expect(pageA).toHaveURL('/', { timeout: 10_000 })

  const contextB = await browser.newContext()
  const pageB = await contextB.newPage()
  await login(pageB, userB)
  await pageB.waitForURL(/\/parear/, { timeout: 15_000 })
  await pageB.getByPlaceholder('código de 6 letras').fill(code)
  await pageB.getByRole('button', { name: 'Entrar no espaço' }).click()
  await expect(pageB).toHaveURL('/', { timeout: 10_000 })

  // A fica parado no feed a partir daqui — NENHUM reload/goto em pageA
  await pageA.goto('/')

  // 1) B publica review → card aparece no feed de A sozinho
  await pageB.goto('/buscar')
  await pageB.getByPlaceholder('Buscar filme…').fill('cidade de deus')
  await pageB.locator('ul a').first().click()
  await pageB.getByRole('button', { name: /Avaliar/ }).click()
  await pageB.locator('form button[aria-label="4 estrelas"]').click()
  await pageB.locator('textarea').fill('Review realtime.')
  await pageB.getByRole('button', { name: 'Publicar' }).click()
  await pageB.waitForURL(/\/$/, { timeout: 10_000 })

  await expect(
    pageA.getByText('Review realtime.'),
    'review do par deve chegar no feed sem reload',
  ).toBeVisible({ timeout: 15_000 })
  console.log('[realtime] review de B apareceu para A sem reload')

  // 2) B comenta no próprio post → badge de comentário sobe no feed de A
  await pageB.getByRole('button', { name: 'Comentários' }).first().click()
  await pageB.getByPlaceholder('Comentar…').fill('Comentário realtime.')
  await pageB.getByRole('button', { name: 'Enviar' }).click()

  await expect(
    pageA.getByRole('button', { name: 'Comentários' }).first(),
    'badge de comentário deve subir sem reload',
  ).toContainText('1', { timeout: 15_000 })
  // e o texto chega se A abrir a seção (query nova, sem reload de página)
  await pageA.getByRole('button', { name: 'Comentários' }).first().click()
  await expect(pageA.getByText('Comentário realtime.')).toBeVisible({ timeout: 15_000 })
  console.log('[realtime] comentário de B apareceu para A sem reload')

  // 3) B reage 🚀 pelo picker → chip aparece no card de A
  await pageB.getByRole('button', { name: 'Mais reações' }).first().click()
  await pageB.getByRole('button', { name: 'Reagir 🚀', exact: true }).click()

  await expect(
    pageA.locator('article').first().getByRole('button', { name: 'Reagir 🚀', exact: true }),
    'reação do par deve chegar sem reload',
  ).toBeVisible({ timeout: 15_000 })
  console.log('[realtime] reação de B apareceu para A sem reload')

  // 4) B adiciona filme a uma lista → atividade entra no feed de A
  await pageB.goto('/buscar')
  await pageB.getByPlaceholder('Buscar filme…').fill('duna parte 2')
  await pageB.locator('ul a').first().click()
  await pageB.getByRole('button', { name: /Adicionar à lista/ }).click()
  await pageB.getByPlaceholder('Nome da lista').fill('Realtime juntos')
  await pageB.getByRole('button', { name: 'Criar' }).click()
  await expect(pageB.getByText(/^Adicionar à lista:/)).toBeHidden({ timeout: 15_000 })

  await expect(
    pageA.getByText(/adicionou/),
    'atividade de lista deve chegar no feed sem reload',
  ).toBeVisible({ timeout: 15_000 })
  console.log('[realtime] atividade de lista de B apareceu para A sem reload')

  await contextA.close()
  await contextB.close()
})
