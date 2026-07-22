let sessionAudioUnlocked = false

export function isIOSDevice() {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function shouldDeferVideoAutoplay() {
  if (typeof window === 'undefined') return false
  return isIOSDevice() || window.matchMedia('(pointer: coarse)').matches
}

export function markSessionAudioUnlocked() {
  sessionAudioUnlocked = true
}

export function isSessionAudioUnlocked() {
  return sessionAudioUnlocked
}

export function primeVideoForSound(video: HTMLVideoElement) {
  video.muted = false
  video.removeAttribute('muted')
  video.volume = 1
  markSessionAudioUnlocked()
}
