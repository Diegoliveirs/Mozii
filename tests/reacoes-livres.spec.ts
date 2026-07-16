import { test, expect } from '@playwright/test'
import { resetTestUser } from './helpers/reset'

// reações livres: picker estilo WhatsApp (fileira rápida + grade completa),
// chips dinâmicos por emoji presente, toggle remove, persiste após reload
const userA = { name: 'Ana Teste', email: 'mozii.e2e.a@gmail.com', password: 'senha-teste-123' }

test('reações livres com picker no card do feed', async ({ page }) => {
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
  await page.locator('textarea').fill('Review para reagir.')
  await page.getByRole('button', { name: 'Publicar' }).click()
  await page.waitForURL(/\/$/, { timeout: 10_000 })

  const card = page.locator('article').first()

  // sem reações: card mostra só o botão de abrir o picker
  await expect(card.getByRole('button', { name: 'Mais reações' })).toBeVisible()

  // fileira rápida: reage com ❤️
  await card.getByRole('button', { name: 'Mais reações' }).click()
  await page.getByRole('button', { name: 'Reagir ❤️', exact: true }).first().click()
  await expect(card.getByRole('button', { name: 'Reagir ❤️', exact: true })).toBeVisible({
    timeout: 5_000,
  })

  // grade completa: emoji fora da lista antiga (🚀)
  await card.getByRole('button', { name: 'Mais reações' }).click()
  await page.getByRole('button', { name: 'Reagir 🚀', exact: true }).click()
  const rocket = card.getByRole('button', { name: 'Reagir 🚀', exact: true })
  await expect(rocket).toBeVisible({ timeout: 5_000 })

  // toggle: clicar no chip remove a reação
  await rocket.click()
  await expect(rocket).toBeHidden({ timeout: 5_000 })

  // persistência
  await page.reload()
  await expect(
    page.locator('article').first().getByRole('button', { name: 'Reagir ❤️', exact: true }),
  ).toBeVisible({ timeout: 10_000 })
})
