import { test, expect, type Page } from '@playwright/test'

const stamp = Date.now()
const userA = { name: 'Ana Teste', email: `fable.teste.a.${stamp}@gmail.com`, password: 'senha-teste-123' }
const userB = { name: 'Diego Teste', email: `fable.teste.b.${stamp}@gmail.com`, password: 'senha-teste-123' }

async function signup(page: Page, user: typeof userA) {
  await page.goto('/cadastro')
  await page.getByPlaceholder('Seu nome').fill(user.name)
  await page.getByPlaceholder('E-mail').fill(user.email)
  await page.getByPlaceholder('Senha').fill(user.password)
  await page.getByRole('button', { name: 'Criar conta' }).click()
}

test('fluxo completo do casal', async ({ browser }) => {
  const contextA = await browser.newContext()
  const pageA = await contextA.newPage()
  const apiErrors: string[] = []
  pageA.on('response', (res) => {
    if (res.url().includes('supabase.co') && res.status() >= 400) {
      apiErrors.push(`${res.status()} ${res.url()}`)
    }
  })

  // A: cadastro
  await signup(pageA, userA)
  await pageA.waitForURL(/\/(parear|entrar)/, { timeout: 15_000 }).catch(() => {})
  const urlAfterSignup = pageA.url()
  console.log('[A] pós-cadastro:', urlAfterSignup, apiErrors.length ? `| erros API: ${apiErrors.join(' ; ')}` : '')

  expect(urlAfterSignup, 'cadastro deve levar a /parear (se ficou em /cadastro ou /entrar, confirmação de e-mail está ativa no Supabase)').toContain('/parear')

  // A: cria espaço, pega código
  await pageA.getByText('Criar nosso espaço').click()
  const codeEl = pageA.locator('p.font-mono')
  await expect(codeEl).toBeVisible({ timeout: 10_000 })
  const code = (await codeEl.textContent())!.trim()
  console.log('[A] código do casal:', code)
  await pageA.getByRole('button', { name: 'Continuar' }).click()
  await expect(pageA).toHaveURL('/', { timeout: 10_000 })

  // B: cadastro + entra com código
  const contextB = await browser.newContext()
  const pageB = await contextB.newPage()
  await signup(pageB, userB)
  await pageB.waitForURL(/\/parear/, { timeout: 15_000 })
  await pageB.getByPlaceholder('código de 6 letras').fill(code)
  await pageB.getByRole('button', { name: 'Entrar no espaço' }).click()
  await expect(pageB).toHaveURL('/', { timeout: 10_000 })
  console.log('[B] pareado, feed carregado')

  // B: perfil mostra os dois
  await pageB.goto('/perfil')
  await expect(pageB.getByText(userA.name).first()).toBeVisible({ timeout: 10_000 })
  await expect(pageB.getByText(userB.name).first()).toBeVisible()

  // A: busca filme e cria review
  await pageA.goto('/buscar')
  await pageA.getByPlaceholder('Buscar filme…').fill('cidade de deus')
  const firstResult = pageA.locator('ul a').first()
  await expect(firstResult).toBeVisible({ timeout: 15_000 })
  await firstResult.click()
  await pageA.getByRole('button', { name: /Avaliar/ }).click()
  await pageA.locator('button[aria-label="4 estrelas"]').click()
  await pageA.locator('textarea').fill('Teste automatizado: filme excelente.')
  await pageA.getByRole('button', { name: 'Publicar' }).click()
  await expect(pageA).toHaveURL('/', { timeout: 10_000 })
  await expect(pageA.getByText('Cidade de Deus')).toBeVisible({ timeout: 10_000 })
  console.log('[A] review publicada no feed')

  // B: vê a review no feed
  await pageB.goto('/')
  await expect(pageB.getByText('Cidade de Deus')).toBeVisible({ timeout: 10_000 })
  await expect(pageB.getByText('Teste automatizado: filme excelente.')).toBeVisible()
  console.log('[B] review visível no feed do par')

  // A: adiciona à lista (gera atividade)
  await pageA.goto('/buscar')
  await pageA.getByPlaceholder('Buscar filme…').fill('duna parte 2')
  await pageA.locator('ul a').first().click()
  await pageA.getByRole('button', { name: /Adicionar à lista/ }).click()
  await pageA.getByPlaceholder('Nome da lista').fill('Para ver juntos')
  await pageA.getByRole('button', { name: 'Criar' }).click()
  await expect(pageA.getByText(/^Adicionar à lista:/)).toBeHidden({ timeout: 15_000 })
  await pageA.goto('/')
  await expect(pageA.getByText(/adicionou/)).toBeVisible({ timeout: 10_000 })
  console.log('[A] atividade de lista no feed')

  // ---- v2 ----

  // A: review aparece na página do filme + edição
  await pageA.goto('/filme/598')
  await expect(pageA.getByText('Nossas avaliações')).toBeVisible({ timeout: 10_000 })
  await expect(pageA.getByText('Teste automatizado: filme excelente.')).toBeVisible()
  await pageA.getByRole('button', { name: 'editar' }).click()
  await pageA.locator('form button[aria-label="5 estrelas"]').click()
  await pageA.getByRole('button', { name: 'Salvar' }).click()
  await expect(pageA.locator('span[aria-label="5 de 5 estrelas"]').first()).toBeVisible({ timeout: 10_000 })
  console.log('[A] review editada para 5 estrelas na página do filme')

  // B: avalia o mesmo filme, nota conjunta aparece
  await pageB.goto('/filme/598')
  await pageB.getByRole('button', { name: /Avaliar/ }).click()
  await pageB.locator('form button[aria-label="3 estrelas"]').click()
  await pageB.locator('textarea').fill('Nota do par.')
  await pageB.getByRole('button', { name: 'Publicar' }).click()
  await pageB.waitForURL('**/', { timeout: 10_000 })
  await pageB.goto('/filme/598')
  await expect(pageB.getByText('do casal')).toBeVisible({ timeout: 10_000 })
  console.log('[B] nota conjunta visível')

  // A: adiciona filme por dentro da lista + quem adicionou + sorteio
  await pageA.goto('/listas')
  await pageA.getByText('Para ver juntos').click()
  await pageA.getByRole('button', { name: '+ Adicionar filme' }).click()
  await pageA.getByPlaceholder('Buscar filme…').fill('matrix')
  const sheetResult = pageA.locator('.sheet-in ul button').first()
  await expect(sheetResult).toBeVisible({ timeout: 15_000 })
  await sheetResult.click()
  await expect(pageA.getByText(/^Adicionar a /)).toBeHidden({ timeout: 10_000 })
  await expect(pageA.getByText(`${userA.name} adicionou`).first()).toBeVisible({ timeout: 10_000 })
  console.log('[A] filme adicionado por dentro da lista, autor identificado')

  await pageA.getByRole('button', { name: /O que ver hoje/ }).click()
  await expect(pageA.getByText('Sortear de novo')).toBeVisible({ timeout: 10_000 })
  await pageA.getByRole('button', { name: 'Fechar' }).click()
  console.log('[A] sorteio funcionando')

  // A: badge de lista na página do filme adicionado
  await pageA.locator('ul a').first().click()
  await expect(pageA.getByRole('link', { name: 'Para ver juntos' })).toBeVisible({ timeout: 10_000 })
  console.log('[A] badge de lista na página do filme')

  // A: perfil — nome, avatar, estatísticas
  await pageA.goto('/perfil')
  await expect(pageA.getByText('Nossos números')).toBeVisible({ timeout: 10_000 })
  await pageA.getByRole('button', { name: userA.name }).click()
  await pageA.locator('form input').fill('Ana Editada')
  await pageA.getByRole('button', { name: 'Salvar' }).click()
  await expect(pageA.getByRole('button', { name: 'Ana Editada' })).toBeVisible({ timeout: 10_000 })

  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  await pageA.locator('input[type="file"]').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from(pngBase64, 'base64'),
  })
  await expect(pageA.locator('img.rounded-full').first()).toBeVisible({ timeout: 15_000 })
  console.log('[A] nome e avatar atualizados, estatísticas visíveis')

  console.log('FLUXO COMPLETO OK', apiErrors.length ? `| erros API acumulados: ${apiErrors.join(' ; ')}` : '| zero erros de API')
})
