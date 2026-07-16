import type { Post, Profile } from '../domain/types'
import { posterUrl } from '../api/tmdb'
import { t } from './i18n'
import { CARD, STAR_PATH, STAR_VIEWBOX } from './shareCardLayout'

// Gera o PNG 1080x1920 do share card desenhando direto num canvas 2D.
// Substitui a captura de DOM via html-to-image, que rasterizava o card
// offscreen (position:fixed; left:-9999) fora do viewport do SVG e exportava
// um PNG transparente — e engolia falhas de rede do poster silenciosamente.

type Seg = { text: string; color: string }
type Poster = { src: CanvasImageSource; w: number; h: number }

async function loadPoster(url: string): Promise<Poster> {
  const attempt = async () => {
    const res = await fetch(url, { mode: 'cors', cache: 'no-store' })
    if (!res.ok) throw new Error(`poster HTTP ${res.status}`)
    return res.blob()
  }
  let blob: Blob
  try {
    blob = await attempt()
  } catch {
    blob = await attempt() // 1 retry; se falhar de novo, erro sobe até a UI
  }

  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(blob)
    return { src: bmp, w: bmp.width, h: bmp.height }
  }
  const img = new Image()
  const objUrl = URL.createObjectURL(blob)
  try {
    img.src = objUrl
    await img.decode()
    return { src: img, w: img.naturalWidth, h: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(objUrl)
  }
}

function wrapSegments(ctx: CanvasRenderingContext2D, segs: Seg[], maxWidth: number): Seg[][] {
  const words = segs.flatMap((s) =>
    s.text
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => ({ text: w, color: s.color })),
  )
  const lines: Seg[][] = []
  let line: Seg[] = []
  let lineText = ''
  for (const w of words) {
    const candidate = lineText ? `${lineText} ${w.text}` : w.text
    if (lineText && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = [w]
      lineText = w.text
    } else {
      line.push(w)
      lineText = candidate
    }
  }
  if (line.length) lines.push(line)
  return lines
}

function drawSegLine(ctx: CanvasRenderingContext2D, line: Seg[], centerX: number, y: number) {
  const full = line.map((s) => s.text).join(' ')
  const spaceW = ctx.measureText(' ').width
  let x = centerX - ctx.measureText(full).width / 2
  ctx.textAlign = 'left'
  for (const seg of line) {
    ctx.fillStyle = seg.color
    ctx.fillText(seg.text, x, y)
    x += ctx.measureText(seg.text).width + spaceW
  }
}

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawStars(ctx: CanvasRenderingContext2D, rating: number, centerX: number, top: number) {
  const { size, gap } = CARD.stars
  const css = getComputedStyle(document.documentElement)
  const on = css.getPropertyValue('--color-star').trim() || CARD.stars.color
  const off = css.getPropertyValue('--color-star-off').trim() || CARD.stars.offColor
  const scale = size / STAR_VIEWBOX
  const rowW = 5 * size + 4 * gap
  const path = new Path2D(STAR_PATH)
  for (let i = 0; i < 5; i++) {
    const fill = Math.min(Math.max(rating - i, 0), 1)
    ctx.save()
    ctx.translate(centerX - rowW / 2 + i * (size + gap), top)
    ctx.scale(scale, scale)
    ctx.fillStyle = off
    ctx.fill(path)
    if (fill > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, STAR_VIEWBOX * fill, STAR_VIEWBOX)
      ctx.clip()
      ctx.fillStyle = on
      ctx.fill(path)
      ctx.restore()
    }
    ctx.restore()
  }
}

export async function renderShareCard(post: Post, members: Profile[]): Promise<Blob> {
  // mesma query própria de antes: não reusa a entrada de cache sem CORS
  // criada pelos <img> do feed
  const baseUrl = post.movie ? posterUrl(post.movie.posterPath, 'w500') : null
  const poster = baseUrl ? await loadPoster(`${baseUrl}?share=1`) : null

  const canvas = document.createElement('canvas')
  canvas.width = CARD.width
  canvas.height = CARD.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D indisponível')

  ctx.fillStyle = CARD.background
  ctx.fillRect(0, 0, CARD.width, CARD.height)
  ctx.textBaseline = 'middle'

  const centerX = CARD.width / 2
  const maxW = CARD.width - CARD.padding * 2
  const serif = (px: number) => `${px}px ${CARD.serifStack}`
  const sans = (px: number, weight = 400) => `${weight} ${px}px ${CARD.fontStack}`

  const names = members.map((m) => m.displayName).join(' ♥ ')
  const snippet =
    post.body && post.body.length > 140 ? `${post.body.slice(0, 140)}…` : post.body

  // mede tudo antes pra centralizar verticalmente (como o flex center do DOM)
  ctx.font = serif(CARD.header.size)
  const headerLines = wrapSegments(
    ctx,
    [{ text: `${t.appName} · ${names}`, color: CARD.header.color }],
    maxW,
  )
  const headerLH = CARD.header.size * 1.2

  ctx.font = sans(CARD.title.size, CARD.title.weight)
  const titleSegs: Seg[] = [{ text: post.movie?.title ?? '', color: CARD.title.color }]
  if (post.movie?.releaseYear) {
    titleSegs.push({ text: String(post.movie.releaseYear), color: CARD.title.yearColor })
  }
  const titleLines = wrapSegments(ctx, titleSegs, maxW)
  const titleLH = CARD.title.size * 1.2

  ctx.font = serif(CARD.snippet.size)
  const snippetLines = snippet
    ? wrapSegments(ctx, [{ text: `“${snippet}”`, color: CARD.snippet.color }], CARD.snippet.maxWidth)
    : []
  const snippetLH = CARD.snippet.size * CARD.snippet.lineHeight

  const footerLH = CARD.footer.size * 1.2

  const hasStars = post.rating !== null
  const total =
    headerLines.length * headerLH +
    CARD.header.marginBottom +
    CARD.poster.height +
    CARD.title.marginTop +
    titleLines.length * titleLH +
    (hasStars ? CARD.stars.size + CARD.stars.marginY * 2 : 0) +
    (snippetLines.length ? snippetLines.length * snippetLH + CARD.snippet.marginBottom : 0) +
    footerLH
  let y = Math.max((CARD.height - total) / 2, CARD.padding)

  ctx.font = serif(CARD.header.size)
  for (const line of headerLines) {
    drawSegLine(ctx, line, centerX, y + headerLH / 2)
    y += headerLH
  }
  y += CARD.header.marginBottom

  const posterX = centerX - CARD.poster.width / 2
  ctx.save()
  roundedPath(ctx, posterX, y, CARD.poster.width, CARD.poster.height, CARD.poster.radius)
  ctx.clip()
  if (poster) {
    // cover-crop: preenche 480x720 mantendo proporção
    const scale = Math.max(CARD.poster.width / poster.w, CARD.poster.height / poster.h)
    const sw = CARD.poster.width / scale
    const sh = CARD.poster.height / scale
    ctx.drawImage(
      poster.src,
      (poster.w - sw) / 2,
      (poster.h - sh) / 2,
      sw,
      sh,
      posterX,
      y,
      CARD.poster.width,
      CARD.poster.height,
    )
  } else {
    ctx.fillStyle = CARD.poster.placeholderBg
    ctx.fillRect(posterX, y, CARD.poster.width, CARD.poster.height)
    ctx.font = sans(CARD.poster.placeholderSize)
    const phLines = wrapSegments(
      ctx,
      [{ text: post.movie?.title ?? '', color: CARD.poster.placeholderColor }],
      CARD.poster.width - 80,
    )
    const phLH = CARD.poster.placeholderSize * 1.3
    let phY = y + CARD.poster.height / 2 - ((phLines.length - 1) * phLH) / 2
    for (const line of phLines) {
      drawSegLine(ctx, line, centerX, phY)
      phY += phLH
    }
  }
  ctx.restore()
  y += CARD.poster.height + CARD.title.marginTop

  ctx.font = sans(CARD.title.size, CARD.title.weight)
  for (const line of titleLines) {
    drawSegLine(ctx, line, centerX, y + titleLH / 2)
    y += titleLH
  }

  if (hasStars) {
    y += CARD.stars.marginY
    drawStars(ctx, post.rating!, centerX, y)
    y += CARD.stars.size + CARD.stars.marginY
  }

  if (snippetLines.length) {
    ctx.font = serif(CARD.snippet.size)
    for (const line of snippetLines) {
      drawSegLine(ctx, line, centerX, y + snippetLH / 2)
      y += snippetLH
    }
    y += CARD.snippet.marginBottom
  }

  ctx.font = sans(CARD.footer.size)
  drawSegLine(
    ctx,
    [{ text: `${t.share.reviewedTogether} · mozii`, color: CARD.footer.color }],
    centerX,
    y + footerLH / 2,
  )

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  // card real 1080x1920 com poster nunca é tão pequeno — vazio ≈ poucos KB
  if (!blob || blob.size < 25_000) throw new Error('Imagem gerada em branco')
  return blob
}
