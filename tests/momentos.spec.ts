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

  const uploads: string[] = []
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/storage/v1/object/post-photos/')) {
      uploads.push(req.url())
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

  // Upload convertido para WebP
  expect(uploads.some((u) => u.includes('.webp')), `uploads: ${uploads.join(' ; ')}`).toBeTruthy()
  console.log('[momentos] upload em WebP OK')

  // Lightbox: clicar na foto abre a visualização ampliada; Esc fecha
  await page.locator('img.max-h-96').first().click()
  await expect(page.getByRole('button', { name: 'Fechar' })).toBeVisible({ timeout: 10_000 })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Fechar' })).toBeHidden()
  console.log('[momentos] lightbox abre e fecha OK')

  // Memória no Mural: aparece no feed do grupo, com reações e comentários (igual review)
  await page.goto('/')
  const feedMoment = page.locator('article', { hasText: 'guardou uma memória' })
  await expect(feedMoment).toBeVisible({ timeout: 10_000 })
  await expect(feedMoment.getByText('Nosso primeiro momento juntos.')).toBeVisible()

  // reage com ❤️
  await feedMoment.getByRole('button', { name: 'Mais reações' }).click()
  await page.getByRole('button', { name: 'Reagir ❤️', exact: true }).first().click()
  await expect(feedMoment.getByRole('button', { name: 'Reagir ❤️', exact: true })).toBeVisible({
    timeout: 5_000,
  })

  // comenta inline
  await feedMoment.getByRole('button', { name: 'Comentários' }).click()
  await feedMoment.getByPlaceholder('Comentar…').fill('Que memória linda!')
  const momentComment = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/comments') && r.request().method() === 'POST' && r.ok(),
    { timeout: 15_000 },
  )
  await feedMoment.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText('Que memória linda!')).toBeVisible({ timeout: 5_000 })
  await momentComment
  console.log('[momentos] memória no feed com reação e comentário OK')

  // Minhas Pegadas: a memória também entra na timeline do perfil
  await page.goto('/perfil')
  await expect(page.getByText('Minhas Pegadas')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('article', { hasText: 'guardou uma memória' })).toBeVisible({
    timeout: 10_000,
  })
  console.log('[momentos] memória em Minhas Pegadas OK')

  // Paywall: no plano grátis o 6º momento do mês é bloqueado pelo RLS.
  // Semeia até 5 + expira o trial e confirma o paywall (requer service-role).
  if (hasAdmin) {
    const { token, userId } = await signInOrUp(userA.email, userA.password, userA.name)
    const prof = await api(`/rest/v1/profiles?id=eq.${userId}&select=couple_id`, token)
    const [{ couple_id: coupleId }] = await prof.json()

    // free = trial expirado (ainda sob o limite mensal, com 1 memória)
    await expireTrial(coupleId)

    // Álbum premium: no plano grátis, a 6ª foto de uma memória abre o paywall de álbum
    await page.goto('/momentos')
    await page.getByRole('button', { name: 'Novo momento' }).click()
    const albumSheet = page.locator('.sheet-in')
    await expect(albumSheet).toBeVisible()
    await albumSheet.locator('input[type="file"]').setInputFiles(
      Array.from({ length: 6 }, (_, i) => ({
        name: `f${i}.png`,
        mimeType: 'image/png',
        buffer: Buffer.from(PNG, 'base64'),
      })),
    )
    await expect(page.getByText('Álbum é Premium')).toBeVisible({ timeout: 10_000 })
    console.log('[momentos] gate de álbum (free: 5 fotos) OK')
    await page.goto('/momentos') // descarta sheet + paywall

    // Limite mensal: semeia até 5 e confirma o paywall de momentos
    for (let i = 0; i < 4; i++) {
      const res = await admin('/rest/v1/moments', {
        method: 'POST',
        body: JSON.stringify({ couple_id: coupleId, author_id: userId, caption: `semente ${i}` }),
      })
      if (!res.ok) throw new Error(`seed momento falhou (${res.status})`)
    }

    await page.goto('/momentos')
    await expect(page.getByText('semente 0')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Novo momento' }).click()
    await expect(page.getByText('Limite de momentos atingido')).toBeVisible({ timeout: 10_000 })
    console.log('[momentos] paywall no limite free OK')
  } else {
    console.log('[momentos] sem service-role — teste de paywall pulado')
  }

  // Exclusão: o autor apaga a própria memória com confirmação
  await page.goto('/momentos')
  const card = page.locator('div.rounded-2xl', { hasText: 'Nosso primeiro momento juntos.' })
  await card.getByRole('button', { name: 'Apagar memória' }).click()
  await expect(page.getByText('Tem certeza que deseja apagar', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Excluir' }).click()
  await expect(page.getByText('Nosso primeiro momento juntos.')).toHaveCount(0, { timeout: 10_000 })
  console.log('[momentos] exclusão de memória OK')

  expect(apiErrors, `erros de API: ${apiErrors.join(' ; ')}`).toEqual([])
})
