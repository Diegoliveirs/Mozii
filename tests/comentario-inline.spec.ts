import { test, expect } from '@playwright/test'
import { resetTestUser } from './helpers/reset'

// comentário direto do card do feed: ícone expande seção inline, envia com
// otimismo, badge de contagem aparece e persiste após reload
const userA = { name: 'Ana Teste', email: 'mozii.e2e.a@gmail.com', password: 'senha-teste-123' }

test('comentário inline no card do feed', async ({ page }) => {
  await resetTestUser(userA.email, userA.password, userA.name)

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
  await page.locator('textarea').fill('Review para comentar.')
  await page.getByRole('button', { name: 'Publicar' }).click()
  await page.waitForURL(/\/$/, { timeout: 10_000 })

  // expande comentários no próprio card, sem navegar
  await page.getByRole('button', { name: 'Comentários' }).first().click()
  await expect(page).toHaveURL(/\/$/)

  await page.getByPlaceholder('Comentar…').fill('Comentário inline de teste.')
  // espera o POST do comentário assentar antes de seguir: contra a latência do
  // staging na nuvem o reload chega antes da escrita persistir (o otimismo some)
  const commentPosted = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/comments') && r.request().method() === 'POST' && r.ok(),
    { timeout: 15_000 },
  )
  await page.getByRole('button', { name: 'Enviar' }).click()

  // otimismo: aparece imediatamente no card
  await expect(page.getByText('Comentário inline de teste.')).toBeVisible({ timeout: 5_000 })
  await commentPosted

  // persistência + badge de contagem após reload
  await page.reload()
  const toggle = page.getByRole('button', { name: 'Comentários' }).first()
  await expect(toggle).toContainText('1', { timeout: 10_000 })
  await toggle.click()
  await expect(page.getByText('Comentário inline de teste.')).toBeVisible({ timeout: 10_000 })

  // link para a publicação continua acessível dentro da seção
  await page.getByRole('link', { name: 'Abrir publicação' }).click()
  await page.waitForURL(/\/post\//, { timeout: 10_000 })
  await expect(page.getByText('Comentário inline de teste.')).toBeVisible()
})
