import { test } from '@playwright/test'
import { resetTestUser } from '../helpers/reset'

// Diagnóstico do card de share preto: instrumenta o pipeline inteiro e imprime
// um relatório JSON — NÃO asserta nada além do fluxo chegar ao fim.
// Rodar: npx playwright test tests/diagnostics/share-card-diag.spec.ts --headed --reporter=list
// Contra produção: $env:BASE_URL='https://moziii.vercel.app' antes do comando.

const userA = { name: 'Ana Teste', email: 'mozii.e2e.a@gmail.com', password: 'senha-teste-123' }

type FetchLogEntry = { url: string; ok?: boolean; status?: number; type?: string; error?: string }
type SvgLoad = { len: number; hasPoster: boolean }
type DiagWindow = Window & {
  __lastBlob?: Blob
  __fetchLog?: FetchLogEntry[]
  __svgLoads?: SvgLoad[]
}

test('diagnóstico: pipeline de geração do card de share', async ({ page }, testInfo) => {
  test.setTimeout(120_000) // fluxo completo + até 2 capturas de 15s
  await resetTestUser(userA.email, userA.password, userA.name)

  const consoleMsgs: string[] = []
  page.on('console', (msg) => {
    const text = msg.text()
    if (
      msg.type() === 'warning' ||
      msg.type() === 'error' ||
      /failed|fetch|cors|image/i.test(text)
    ) {
      consoleMsgs.push(`[${msg.type()}] ${text.slice(0, 300)}`)
    }
  })
  const tmdbResponses: string[] = []
  page.on('response', (res) => {
    if (res.url().includes('image.tmdb.org')) {
      tmdbResponses.push(
        `${res.status()} acao=${res.headers()['access-control-allow-origin'] ?? '(ausente)'} ${res.url().slice(-80)}`,
      )
    }
  })
  page.on('requestfailed', (req) => {
    if (req.url().includes('image.tmdb.org')) {
      tmdbResponses.push(`FALHOU ${req.failure()?.errorText} ${req.url().slice(-80)}`)
    }
  })

  await page.addInitScript(() => {
    const w = window as unknown as DiagWindow & typeof globalThis
    // força fallback de download (sem share sheet nativo)
    Object.defineProperty(navigator, 'canShare', { value: undefined })
    // guarda o Blob real gerado
    const origCreate = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      if (obj instanceof Blob) w.__lastBlob = obj
      return origCreate(obj)
    }
    // loga todo fetch para image.tmdb.org (pega o fetch interno da html-to-image)
    w.__fetchLog = []
    const origFetch = window.fetch.bind(window)
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url
      const isTmdb = url.includes('image.tmdb.org')
      try {
        const res = await origFetch(...args)
        if (isTmdb) w.__fetchLog!.push({ url: url.slice(-100), ok: res.ok, status: res.status, type: res.type })
        return res
      } catch (err) {
        if (isTmdb) w.__fetchLog!.push({ url: url.slice(-100), error: String(err) })
        throw err
      }
    }
    // registra todo SVG data-URI carregado em <img> (rasterização da html-to-image)
    // e se ele contém o poster inlined (data:image/jpeg cru ou percent-encoded)
    w.__svgLoads = []
    const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      ...desc,
      set(this: HTMLImageElement, value: string) {
        if (typeof value === 'string' && value.startsWith('data:image/svg+xml')) {
          w.__svgLoads!.push({
            len: value.length,
            hasPoster:
              value.includes('data:image/jpeg') || value.includes('data%3Aimage%2Fjpeg'),
          })
        }
        desc.set!.call(this, value)
      },
    })
  })

  // fluxo: login → criar espaço → avaliar filme → abrir modal de share
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

  // estado do <img> do card offscreen ANTES da captura
  const imgProbe = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'))
      .filter((i) => i.src.includes('share=1'))
      .map((i) => ({
        src: i.src.slice(-80),
        complete: i.complete,
        naturalWidth: i.naturalWidth,
        naturalHeight: i.naturalHeight,
        crossOrigin: i.crossOrigin,
      }))
    return imgs
  })

  await page.locator('.fixed').getByRole('button', { name: 'Compartilhar' }).click()

  // espera o blob aparecer (ou o erro na UI)
  const blobInfo = await page
    .waitForFunction(
      () => {
        const w = window as unknown as { __lastBlob?: Blob }
        return w.__lastBlob ? { size: w.__lastBlob.size, type: w.__lastBlob.type } : null
      },
      undefined,
      { timeout: 45_000 },
    )
    .then((h) => h.jsonValue())
    .catch(() => null)

  const errorShown = await page
    .getByText('Algo deu errado')
    .isVisible()
    .catch(() => false)

  // análise de pixels do PNG gerado, em página
  let pixelStats: unknown = null
  let pngBase64: string | null = null
  if (blobInfo) {
    const analysis = await page.evaluate(async () => {
      const w = window as unknown as { __lastBlob?: Blob }
      const blob = w.__lastBlob!
      const bmp = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bmp.width
      canvas.height = bmp.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bmp, 0, 0)

      function region(x: number, y: number, w2: number, h2: number) {
        const d = ctx.getImageData(x, y, w2, h2).data
        let sum = 0
        let sumSq = 0
        const n = d.length / 4
        for (let i = 0; i < d.length; i += 4) {
          const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
          sum += lum
          sumSq += lum * lum
        }
        const mean = sum / n
        return { mean: Math.round(mean), variance: Math.round(sumSq / n - mean * mean) }
      }

      const stats = {
        dims: `${bmp.width}x${bmp.height}`,
        cantoSupEsq: region(0, 0, 100, 100),
        cantoInfDir: region(bmp.width - 100, bmp.height - 100, 100, 100),
        centroPoster: region(420, 760, 240, 240),
        faixaTitulo: region(140, 1300, 800, 120),
      }
      // base64 pro Node salvar em disco
      const buf = new Uint8Array(await blob.arrayBuffer())
      let bin = ''
      for (let i = 0; i < buf.length; i += 0x8000) {
        bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
      }
      return { stats, b64: btoa(bin) }
    })
    pixelStats = analysis.stats
    pngBase64 = analysis.b64
  }

  if (pngBase64) {
    const fs = await import('node:fs')
    const outPath = testInfo.outputPath('share-card-diag.png')
    fs.writeFileSync(outPath, Buffer.from(pngBase64, 'base64'))
    await testInfo.attach('share-card-diag.png', { path: outPath, contentType: 'image/png' })
    console.log(`PNG salvo em: ${outPath}`)
  }

  const inPageLogs = await page.evaluate(() => {
    const w = window as unknown as {
      __fetchLog?: unknown[]
      __svgLoads?: unknown[]
    }
    return { fetchLog: w.__fetchLog ?? [], svgLoads: w.__svgLoads ?? [] }
  })

  console.log(
    'RELATORIO_DIAG ' +
      JSON.stringify(
        {
          baseURL: testInfo.project.use.baseURL,
          imgOffscreenAntes: imgProbe,
          blob: blobInfo,
          erroNaUI: errorShown,
          pixels: pixelStats,
          fetchTmdbInterno: inPageLogs.fetchLog,
          svgRasterizados: inPageLogs.svgLoads,
          respostasTmdbRede: tmdbResponses,
          console: consoleMsgs.slice(0, 20),
        },
        null,
        2,
      ),
  )
})
