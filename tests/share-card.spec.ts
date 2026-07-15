import { test, expect } from '@playwright/test'
import { resetTestUser } from './helpers/reset'

// regressão do card de share (saía branco por cache CORS envenenado do poster)
const userA = { name: 'Ana Teste', email: 'mozii.e2e.a@gmail.com', password: 'senha-teste-123' }

test('card de compartilhamento gera PNG real com poster', async ({ page }) => {
  await resetTestUser(userA.email, userA.password, userA.name)

  await page.addInitScript(() => {
    // força o fallback de download (senão o Edge abre o share sheet nativo)
    Object.defineProperty(navigator, 'canShare', { value: undefined })
    // intercepta o blob do anchor programático
    const original = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      if (obj instanceof Blob) {
        const w = window as unknown as { __blobSize?: number; __blobMagic?: number[] }
        w.__blobSize = obj.size
        obj.arrayBuffer().then((buf) => {
          w.__blobMagic = Array.from(new Uint8Array(buf.slice(0, 4)))
        })
      }
      return original(obj)
    }
  })

  await page.goto('/entrar')
  await page.getByPlaceholder('E-mail').fill(userA.email)
  await page.getByPlaceholder('Senha').fill(userA.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL(/\/parear/, { timeout: 15_000 })
  await page.getByText('Criar nosso espaço').click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.waitForURL(/\/$/, { timeout: 10_000 })

  await page.goto('/buscar')
  await page.getByPlaceholder('Buscar filme…').fill('cidade de deus')
  await page.locator('ul a').first().click()
  await page.getByRole('button', { name: /Avaliar/ }).click()
  await page.locator('form button[aria-label="4 estrelas"]').click()
  await page.locator('textarea').fill('Card de teste.')
  await page.getByRole('button', { name: 'Publicar' }).click()
  await page.waitForURL(/\/$/, { timeout: 10_000 })

  await page.getByRole('button', { name: 'Compartilhar' }).first().click()
  await page.locator('.fixed').getByRole('button', { name: 'Compartilhar' }).click()

  await expect
    .poll(
      () => page.evaluate(() => (window as unknown as { __blobSize?: number }).__blobSize ?? 0),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(25_000)

  const magic = await page.evaluate(
    () => (window as unknown as { __blobMagic?: number[] }).__blobMagic ?? [],
  )
  expect(magic, 'assinatura PNG').toEqual([137, 80, 78, 71])
  await expect(page.getByText('Algo deu errado')).toBeHidden()
})
