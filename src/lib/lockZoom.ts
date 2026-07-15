export function lockZoom() {
  document.addEventListener('gesturestart', (e) => e.preventDefault())

  let lastTouch = 0
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now()
      if (now - lastTouch < 300) e.preventDefault()
      lastTouch = now
    },
    { passive: false },
  )
}
