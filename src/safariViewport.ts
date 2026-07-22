/** Keep the app sized to Safari’s visible viewport, and nudge document scroll so the chrome can collapse. */

function setAppHeight() {
  const viewport = window.visualViewport
  const height = Math.round(viewport?.height ?? window.innerHeight)
  const top = Math.round(viewport?.offsetTop ?? 0)
  document.documentElement.style.setProperty('--app-height', `${height}px`)
  document.documentElement.style.setProperty('--app-top', `${top}px`)
}

function isMobileSafariShell() {
  return window.matchMedia('(max-width: 720px)').matches
}

/** One-pixel document scroll is enough for Safari to start collapsing its UI. */
function nudgeSafariChrome() {
  if (!isMobileSafariShell()) return
  if (window.scrollY > 0) return
  window.scrollTo(0, 1)
}

export function installSafariViewport() {
  setAppHeight()

  window.visualViewport?.addEventListener('resize', setAppHeight)
  window.visualViewport?.addEventListener('scroll', setAppHeight)
  window.addEventListener('resize', setAppHeight)
  window.addEventListener('orientationchange', setAppHeight)

  // First interaction often unlocks chrome collapse better than load alone.
  const onFirstGesture = () => {
    nudgeSafariChrome()
    setAppHeight()
  }
  window.addEventListener('touchstart', onFirstGesture, { passive: true, once: true })
  window.addEventListener('touchmove', onFirstGesture, { passive: true, once: true })
  window.addEventListener('load', () => {
    requestAnimationFrame(() => {
      setAppHeight()
      nudgeSafariChrome()
    })
  })
}
