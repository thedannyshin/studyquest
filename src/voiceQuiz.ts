type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
    webkitAudioContext?: typeof AudioContext
  }
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function isIOSDevice() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function canSpeakQuiz() {
  return typeof window !== 'undefined' && (
    typeof Audio !== 'undefined' || 'speechSynthesis' in window
  )
}

export function canListenForQuiz() {
  return Boolean(getSpeechRecognitionCtor())
}

let speakToken = 0
let voiceSession = 0
let currentAudio: HTMLAudioElement | null = null
let sharedAudio: HTMLAudioElement | null = null
let audioContext: AudioContext | null = null
let unlocked = false

export function getVoiceSession() {
  return voiceSession
}

function pauseFeedVideos() {
  if (typeof document === 'undefined') return
  document.querySelectorAll('video').forEach((node) => {
    const video = node as HTMLVideoElement
    video.pause()
  })
}

function getSharedAudio() {
  if (!sharedAudio) {
    sharedAudio = new Audio()
    sharedAudio.preload = 'auto'
    sharedAudio.muted = false
    sharedAudio.defaultMuted = false
    sharedAudio.volume = 1
    sharedAudio.setAttribute('playsinline', 'true')
    sharedAudio.setAttribute('webkit-playsinline', 'true')
  }
  return sharedAudio
}

/** Same-origin MP3 proxy — required on iOS Safari (blocks translate.google.com media). */
function ttsUrl(text: string) {
  const url = new URL('/api/tts', window.location.origin)
  url.searchParams.set('text', text.slice(0, 180))
  return url.toString()
}

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  return (
    voices.find((voice) => voice.lang === 'en-US' && /samantha|karen|moira|daniel|enhanced/i.test(voice.name))
    || voices.find((voice) => voice.lang.startsWith('en') && voice.localService)
    || voices.find((voice) => voice.lang.startsWith('en'))
    || null
  )
}

function waitForAudioEnd(audio: HTMLAudioElement, token: number) {
  return new Promise<void>((resolve) => {
    if (token !== speakToken) {
      resolve()
      return
    }

    const settle = () => {
      window.clearInterval(poll)
      audio.removeEventListener('ended', settle)
      audio.removeEventListener('error', settle)
      resolve()
    }

    const poll = window.setInterval(() => {
      if (token !== speakToken) settle()
    }, 80)

    audio.addEventListener('ended', settle)
    audio.addEventListener('error', settle)
  })
}

function speakWithSynthesis(text: string, token: number) {
  return new Promise<void>((resolve) => {
    if (!('speechSynthesis' in window) || !text.trim() || token !== speakToken) {
      resolve()
      return
    }

    // iOS sometimes leaves synthesis in a paused state.
    try {
      window.speechSynthesis.resume()
    } catch {
      // ignore
    }

    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'en-US'
    utter.rate = 1
    utter.pitch = 1
    utter.volume = 1
    const voice = pickEnglishVoice()
    if (voice) utter.voice = voice

    const poll = window.setInterval(() => {
      if (token !== speakToken) {
        window.clearInterval(poll)
        try {
          window.speechSynthesis.cancel()
        } catch {
          // ignore
        }
        resolve()
      }
    }, 80)

    const settle = () => {
      window.clearInterval(poll)
      resolve()
    }

    utter.onend = settle
    utter.onerror = settle
    window.speechSynthesis.speak(utter)

    // iOS Safari: kick resume shortly after speak.
    window.setTimeout(() => {
      try {
        window.speechSynthesis.resume()
      } catch {
        // ignore
      }
    }, 40)
  })
}

async function speakPartsWithSynthesis(parts: string[], token: number) {
  for (const part of parts) {
    if (token !== speakToken) return
    await speakWithSynthesis(part, token)
  }
}

function playUnlockBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    audioContext = audioContext ?? new Ctx()
    void audioContext.resume()
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.0001
    gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.16)
    osc.connect(gain)
    gain.connect(audioContext.destination)
    osc.start()
    osc.stop(audioContext.currentTime + 0.18)
  } catch {
    // ignore
  }
}

/**
 * Call from a user tap (Passive toggle / Hear question).
 * On iOS this must run inside the gesture; it does not announce "Ready".
 */
export function unlockAudioSession() {
  pauseFeedVideos()
  unlocked = true

  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (Ctx) {
      audioContext = audioContext ?? new Ctx()
      void audioContext.resume()
    }
  } catch {
    // ignore
  }

  playUnlockBeep()

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.getVoices()
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        window.speechSynthesis.getVoices()
      }, { once: true })
      window.speechSynthesis.resume()
    } catch {
      // ignore
    }
  }

  // Prime a same-origin audio element (empty play after src set happens in Ready unlock).
  getSharedAudio()
}

/** Passive toggle: unlock + audible Ready (MP3 + on-device TTS). */
export function unlockSpeechSynthesis() {
  unlockAudioSession()

  const audio = getSharedAudio()
  try {
    audio.pause()
    audio.muted = false
    audio.volume = 1
    audio.src = '/audio/ready.mp3'
    void audio.play().catch(() => {})
  } catch {
    // ignore
  }

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel()
      window.speechSynthesis.resume()
      const utter = new SpeechSynthesisUtterance('Ready')
      utter.lang = 'en-US'
      utter.rate = 1
      utter.volume = 1
      const voice = pickEnglishVoice()
      if (voice) utter.voice = voice
      // Must speak in this tap turn — do not cancel afterward.
      window.speechSynthesis.speak(utter)
    } catch {
      // ignore
    }
  }
}

export function stopSpeaking() {
  speakToken += 1
  voiceSession += 1
  if (currentAudio) {
    try {
      currentAudio.pause()
      currentAudio.removeAttribute('src')
      currentAudio.load()
    } catch {
      // ignore
    }
    currentAudio = null
  }
  if (sharedAudio) {
    try {
      sharedAudio.pause()
    } catch {
      // ignore
    }
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

async function playMp3Clip(text: string, token: number) {
  const audio = getSharedAudio()
  currentAudio = audio
  audio.muted = false
  audio.defaultMuted = false
  audio.volume = 1
  audio.src = ttsUrl(text)

  try {
    await audio.play()
  } catch {
    return false
  }

  if (token !== speakToken) {
    audio.pause()
    return false
  }

  await waitForAudioEnd(audio, token)
  return !audio.error && Number.isFinite(audio.duration) && audio.duration > 0.05
}

async function playAudioClip(text: string) {
  if (!canSpeakQuiz() || !text.trim()) return
  const token = speakToken
  pauseFeedVideos()

  // iOS Safari: prefer on-device speech. Remote/cross-origin MP3 is often silent.
  if (isIOSDevice() && 'speechSynthesis' in window) {
    await speakWithSynthesis(text, token)
    return
  }

  const played = await playMp3Clip(text, token)
  if (!played && token === speakToken) {
    await speakWithSynthesis(text, token)
  }
}

export async function speakText(text: string) {
  if (!text.trim()) return
  const chunks = chunkSpeech(text, 160)
  const token = speakToken
  for (const chunk of chunks) {
    if (token !== speakToken) return
    await playAudioClip(chunk)
  }
}

function chunkSpeech(text: string, maxLen = 160) {
  const parts = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)

  const chunks: string[] = []
  for (const part of parts) {
    if (part.length <= maxLen) {
      chunks.push(part)
      continue
    }
    let rest = part
    while (rest.length > maxLen) {
      const slice = rest.slice(0, maxLen)
      const breakAt = Math.max(slice.lastIndexOf(' '), Math.floor(maxLen * 0.6))
      chunks.push(rest.slice(0, breakAt).trim())
      rest = rest.slice(breakAt).trim()
    }
    if (rest) chunks.push(rest)
  }
  return chunks.length > 0 ? chunks : [text]
}

export function buildQuizSpeechParts(question: string, options: string[]) {
  return [
    question,
    'Your choices are:',
    ...options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`),
    'Say the letter of your answer.',
  ]
}

export async function speakQuiz(question: string, options: string[]) {
  const parts = buildQuizSpeechParts(question, options)
  const token = speakToken
  pauseFeedVideos()

  if (isIOSDevice() && 'speechSynthesis' in window) {
    await speakPartsWithSynthesis(parts, token)
    return
  }

  for (const part of parts) {
    if (token !== speakToken) return
    await playAudioClip(part)
  }
}

/**
 * Start quiz speech inside a tap handler (Hear question).
 * On iOS, queues speechSynthesis immediately in the gesture — no network wait.
 * Resolves with the voice session id so callers can ignore stale completions.
 */
export async function speakQuizFromGesture(question: string, options: string[]) {
  stopSpeaking()
  unlockAudioSession()
  const token = speakToken
  const session = voiceSession
  const parts = buildQuizSpeechParts(question, options)
  pauseFeedVideos()

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.resume()
    } catch {
      // ignore
    }
    // First speak() happens synchronously before the first await inside.
    await speakPartsWithSynthesis(parts, token)
    return session
  }

  await speakQuiz(question, options)
  return session
}

export function buildQuizSpeech(question: string, options: string[]) {
  return buildQuizSpeechParts(question, options).join(' ')
}

export function isAudioSessionUnlocked() {
  return unlocked
}

function normalizeSpeech(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const letterWords: Record<string, number> = {
  a: 0,
  ay: 0,
  hey: 0,
  b: 1,
  be: 1,
  bee: 1,
  c: 2,
  see: 2,
  sea: 2,
  d: 3,
  dee: 3,
}

export function matchSpokenOption(transcript: string, options: string[]) {
  const normalized = normalizeSpeech(transcript)
  if (!normalized || options.length === 0) return null

  const tokens = normalized.split(' ')
  for (const token of tokens) {
    const index = letterWords[token]
    if (typeof index === 'number' && options[index]) return options[index]
  }

  const letterMatch = normalized.match(/\b(?:option|choice|answer)?\s*([abcd])\b/)
  if (letterMatch) {
    const index = letterMatch[1].charCodeAt(0) - 97
    if (options[index]) return options[index]
  }

  const ordinals = [
    ['first', '1', 'one'],
    ['second', '2', 'two'],
    ['third', '3', 'three'],
    ['fourth', '4', 'four'],
  ] as const
  for (let index = 0; index < options.length; index += 1) {
    if (ordinals[index]?.some((word) => normalized.includes(word))) {
      return options[index]
    }
  }

  let best: { option: string; score: number } | null = null
  for (const option of options) {
    const optionNorm = normalizeSpeech(option)
    if (!optionNorm) continue
    if (normalized.includes(optionNorm) || optionNorm.includes(normalized)) {
      const score = Math.min(normalized.length, optionNorm.length)
      if (!best || score > best.score) best = { option, score }
    }
  }

  return best && best.score >= 4 ? best.option : null
}

let sharedRecognition: SpeechRecognitionLike | null = null
let listenGeneration = 0

function getSharedRecognition() {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) return null
  if (!sharedRecognition) {
    sharedRecognition = new Ctor()
    sharedRecognition.lang = 'en-US'
    sharedRecognition.interimResults = true
    sharedRecognition.maxAlternatives = 3
  }
  return sharedRecognition
}

export function warmUpSpeechRecognition() {
  const recognition = getSharedRecognition()
  if (!recognition) return
  try {
    recognition.continuous = false
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
    recognition.start()
    window.setTimeout(() => {
      try {
        recognition.abort()
      } catch {
        // ignore
      }
    }, 120)
  } catch {
    // ignore
  }
}

export function startListeningForOption(
  options: string[],
  onMatch: (option: string) => void,
  onStatus?: (status: 'listening' | 'ended' | 'error') => void,
) {
  const recognition = getSharedRecognition()
  if (!recognition) {
    onStatus?.('error')
    return () => {}
  }

  const generation = ++listenGeneration
  let stopped = false
  const ios = isIOSDevice()

  recognition.continuous = !ios
  recognition.interimResults = true

  const handleResult = (event: SpeechRecognitionEventLike) => {
    if (stopped || generation !== listenGeneration) return
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i]
      const transcript = result?.[0]?.transcript ?? ''
      const matched = matchSpokenOption(transcript, options)
      if (matched) {
        stopped = true
        onMatch(matched)
        try {
          recognition.stop()
        } catch {
          // ignore
        }
        return
      }
    }
  }

  recognition.onresult = handleResult
  recognition.onerror = () => {
    if (stopped || generation !== listenGeneration) return
    onStatus?.('error')
  }
  recognition.onend = () => {
    if (stopped || generation !== listenGeneration) {
      onStatus?.('ended')
      return
    }
    if (ios) {
      window.setTimeout(() => {
        if (stopped || generation !== listenGeneration) return
        try {
          recognition.start()
          onStatus?.('listening')
        } catch {
          onStatus?.('ended')
        }
      }, 180)
      return
    }
    onStatus?.('ended')
  }

  try {
    recognition.start()
    onStatus?.('listening')
  } catch {
    onStatus?.('error')
  }

  return () => {
    stopped = true
    listenGeneration += 1
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
    try {
      recognition.abort()
    } catch {
      // ignore
    }
    onStatus?.('ended')
  }
}
