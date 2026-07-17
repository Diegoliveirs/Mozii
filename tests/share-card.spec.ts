import { test, expect } from '@playwright/test'
import { resetTestUser } from './helpers/reset'

// regressão do card de share: além de tamanho/assinatura, valida os PIXELS do
// PNG exportado — card vazio/transparente ou sem poster não passa mais
const userA = { name: 'Ana Teste', email: 'mozii.e2e.a@gmail.com', password: 'senha-teste-123' }

test('card de compartilhamento gera PNG real com poster', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await resetTestUser(userA.email, userA.password, userA.name)

  await page.addInitScript(() => {
    // força o fallback de download (senão o Edge abre o share sheet nativo)
    Object.defineProperty(navigator, 'canShare', { value: undefined })
    // intercepta o blob do anchor programático
    const original = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      if (obj instanceof Blob) {
        const w = window as unknown as { __lastBlob?: Blob }
        w.__lastBlob = obj
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
      () =>
        page.evaluate(() => (window as unknown as { __lastBlob?: Blob }).__lastBlob?.size ?? 0),
      { timeout: 45_000 },
    )
    .toBeGreaterThan(25_000)

  // analisa o PNG em página: dimensões, opacidade, fundo escuro e poster presente
  const result = await page.evaluate(async () => {
    const blob = (window as unknown as { __lastBlob?: Blob }).__lastBlob!
    const magic = Array.from(new Uint8Array((await blob.arrayBuffer()).slice(0, 4)))
    const bmp = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bmp.width
    canvas.height = bmp.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(bmp, 0, 0)

    function region(x: number, y: number, w: number, h: number) {
      const d = ctx.getImageData(x, y, w, h).data
      let sum = 0
      let sumSq = 0
      let alphaMin = 255
      const n = d.length / 4
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
        sum += lum
        sumSq += lum * lum
        if (d[i + 3] < alphaMin) alphaMin = d[i + 3]
      }
      const mean = sum / n
      return { mean, variance: sumSq / n - mean * mean, alphaMin }
    }

    const cantoA = region(0, 0, 100, 100)
    const cantoB = region(bmp.width - 100, bmp.height - 100, 100, 100)

    // faixa onde o poster (480x720, centrado em x) sempre está: tiles 100x100
    let tiles = 0
    let tilesComConteudo = 0
    let bandSum = 0
    for (let y = 400; y + 100 <= 1240; y += 100) {
      for (let x = 320; x + 100 <= 760; x += 100) {
        const r = region(x, y, 100, 100)
        tiles++
        bandSum += r.mean
        if (r.variance > 100) tilesComConteudo++
      }
    }

    // base64 pro artifact
    const buf = new Uint8Array(await blob.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) {
      bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    }

    return {
      magic,
      dims: `${bmp.width}x${bmp.height}`,
      cantoMean: (cantoA.mean + cantoB.mean) / 2,
      cantoAlphaMin: Math.min(cantoA.alphaMin, cantoB.alphaMin),
      bandMean: bandSum / tiles,
      tiles,
      tilesComConteudo,
      b64: bin ? btoa(bin) : null,
    }
  })

  if (result.b64) {
    const fs = await import('node:fs')
    const outPath = testInfo.outputPath('share-card.png')
    fs.writeFileSync(outPath, Buffer.from(result.b64, 'base64'))
    await testInfo.attach('share-card.png', { path: outPath, contentType: 'image/png' })
  }

  expect(result.magic, 'assinatura PNG').toEqual([137, 80, 78, 71])
  expect(result.dims, 'dimensões do card').toBe('1080x1920')
  expect(result.cantoAlphaMin, 'card opaco (não transparente)').toBe(255)
  expect(result.cantoMean, 'fundo escuro presente nos cantos').toBeGreaterThan(3)
  expect(result.cantoMean, 'cantos são fundo, não conteúdo').toBeLessThan(30)
  expect(result.bandMean, 'faixa do poster mais clara que o fundo').toBeGreaterThan(
    result.cantoMean + 15,
  )
  expect(
    result.tilesComConteudo / result.tiles,
    `poster com conteúdo real (${result.tilesComConteudo}/${result.tiles} tiles com variância)`,
  ).toBeGreaterThanOrEqual(0.3)
  await expect(page.getByText('Algo deu errado')).toBeHidden()

  // compartilhar também pela página do filme (botão na avaliação)
  await page.evaluate(() => {
    ;(window as unknown as { __lastBlob?: Blob }).__lastBlob = undefined
  })
  await page.goto('/buscar')
  await page.getByPlaceholder('Buscar filme…').fill('cidade de deus')
  await page.locator('ul a').first().click()
  await page.getByRole('button', { name: 'compartilhar', exact: true }).click()
  await page.locator('.fixed').getByRole('button', { name: 'Compartilhar' }).click()
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as unknown as { __lastBlob?: Blob }).__lastBlob?.size ?? 0),
      { timeout: 45_000 },
    )
    .toBeGreaterThan(25_000)
  await expect(page.getByText('Algo deu errado')).toBeHidden()
})
