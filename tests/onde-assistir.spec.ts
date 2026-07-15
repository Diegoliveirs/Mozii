import { test, expect } from '@playwright/test'

const userA = { email: 'mozii.e2e.a@gmail.com', password: 'senha-teste-123' }

test('seção Onde assistir aparece na página do filme', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByPlaceholder('E-mail').fill(userA.email)
  await page.getByPlaceholder('Senha').fill(userA.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL(/\/($|parear)/, { timeout: 15_000 })

  await page.goto('/filme/598')
  await expect(page.getByRole('heading', { name: 'Cidade de Deus' })).toBeVisible({ timeout: 15_000 })

  await expect(page.getByText('Onde assistir')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByAltText('Netflix', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'via JustWatch' })).toBeVisible()

  const logos = await page.locator('img[title]').count()
  console.log(`Onde assistir visível com ${logos} logos de streaming`)

  // espera todas as imagens da página realmente decodificarem
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0),
        ),
      { timeout: 15_000 },
    )
    .toBe(true)

  await page.screenshot({ path: 'test-results/onde-assistir.png', fullPage: true })
  console.log('screenshot salvo em test-results/onde-assistir.png')
})
