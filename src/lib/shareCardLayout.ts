// Fonte única de layout do share card (1080x1920): consumido pelo preview DOM
// (ShareCard.tsx) e pelo renderer canvas (renderShareCard.ts) — mudou aqui,
// mudou nos dois.
export const CARD = {
  width: 1080,
  height: 1920,
  background: '#0e0b12',
  padding: 80,
  fontStack: 'system-ui, sans-serif',
  serifStack: 'Georgia, serif',
  header: { size: 44, color: '#8d8499', marginBottom: 60 },
  poster: {
    width: 480,
    height: 720,
    radius: 32,
    placeholderBg: '#221d2b',
    placeholderColor: '#8d8499',
    placeholderSize: 40,
  },
  title: { size: 52, weight: 500, color: '#f2edf5', yearColor: '#8d8499', marginTop: 56 },
  stars: { size: 64, gap: 4, marginY: 24, color: '#efb927', offColor: '#4a4356' },
  snippet: { size: 38, lineHeight: 1.6, color: '#c3bccd', maxWidth: 800, marginBottom: 60 },
  footer: { size: 28, color: '#5f5866' },
} as const

// mesmo path do StarRating.tsx (viewBox 24)
export const STAR_PATH = 'M12 17.3l-6.2 3.4 1.2-6.9-5-4.9 6.9-1L12 1.6l3.1 6.3 6.9 1-5 4.9 1.2 6.9z'
export const STAR_VIEWBOX = 24
