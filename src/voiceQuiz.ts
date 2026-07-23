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
  return typeof window !== 'undefined' && typeof Audio !== 'undefined'
}

export function canListenForQuiz() {
  return Boolean(getSpeechRecognitionCtor())
}

const READY_MP3 = '/audio/ready.mp3'
const CORRECT_MP3 = '/audio/correct.mp3'

let speakToken = 0
let voiceSession = 0
let currentAudio: HTMLAudioElement | null = null
let sharedAudio: HTMLAudioElement | null = null
let audioContext: AudioContext | null = null
let unlocked = false
let objectUrls: string[] = []
const blobUrlCache = new Map<string, string>()

export function getVoiceSession() {
  return voiceSession
}

export function isAudioSessionUnlocked() {
  return unlocked
}

function pauseFeedVideos() {
  if (typeof document === 'undefined') return
  document.querySelectorAll('video').forEach((node) => {
    const video = node as HTMLVideoElement
    video.pause()
  })
}

/** One HTMLAudioElement in the DOM — iOS Safari is most reliable this way. */
function getSharedAudio() {
  if (!sharedAudio) {
    sharedAudio = document.createElement('audio')
    sharedAudio.preload = 'auto'
    sharedAudio.muted = false
    sharedAudio.defaultMuted = false
    sharedAudio.volume = 1
    sharedAudio.setAttribute('playsinline', 'true')
    sharedAudio.setAttribute('webkit-playsinline', 'true')
    sharedAudio.setAttribute('controls', 'false')
    sharedAudio.style.display = 'none'
    document.body.appendChild(sharedAudio)
  }
  sharedAudio.muted = false
  sharedAudio.defaultMuted = false
  sharedAudio.volume = 1
  return sharedAudio
}

/** Same-origin MP3 from our Vercel/Vite TTS proxy. */
function ttsApiUrl(text: string) {
  const url = new URL('/api/tts', window.location.origin)
  url.searchParams.set('text', text.slice(0, 180))
  return url.toString()
}

function rememberObjectUrl(url: string) {
  objectUrls.push(url)
  return url
}

function revokeObjectUrls() {
  for (const url of objectUrls) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      // ignore
    }
  }
  objectUrls = []
  blobUrlCache.clear()
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

/** Download TTS as a real audio file (blob), then play from a local object URL. */
async function resolveClipUrl(text: string): Promise<string | null> {
  const trimmed = text.trim().slice(0, 180)
  if (!trimmed) return null

  if (/^correct\.?$/i.test(trimmed)) return CORRECT_MP3
  if (/^ready\.?$/i.test(trimmed)) return READY_MP3

  const cached = blobUrlCache.get(trimmed)
  if (cached) return cached

  try {
    const response = await fetch(ttsApiUrl(trimmed), { cache: 'force-cache' })
    if (!response.ok) return null
    const blob = await response.blob()
    if (blob.size < 100) return null
    const file = blob.type.startsWith('audio/')
      ? blob
      : new Blob([blob], { type: 'audio/mpeg' })
    const url = rememberObjectUrl(URL.createObjectURL(file))
    blobUrlCache.set(trimmed, url)
    return url
  } catch {
    return null
  }
}

async function playSrc(src: string, token: number) {
  const audio = getSharedAudio()
  currentAudio = audio
  audio.muted = false
  audio.defaultMuted = false
  audio.volume = 1
  audio.src = src

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
  return !audio.error
}

/**
 * Call from a user tap (Passive toggle / Hear question).
 * Must invoke audio.play() inside the gesture so iOS allows later clips.
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

  const audio = getSharedAudio()
  try {
    audio.pause()
    audio.muted = false
    audio.volume = 1
    audio.src = READY_MP3
    // Critical: play() in this turn unlocks the element for later MP3s.
    void audio.play().catch(() => {})
  } catch {
    // ignore
  }
}

/** Passive toggle: unlock + audible Ready MP3. */
export function unlockSpeechSynthesis() {
  unlockAudioSession()
}

export function stopSpeaking() {
  speakToken += 1
  voiceSession += 1
  if (currentAudio) {
    try {
      currentAudio.pause()
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
}

async function playAudioClip(text: string) {
  if (!canSpeakQuiz() || !text.trim()) return false
  const token = speakToken
  pauseFeedVideos()
  const src = await resolveClipUrl(text)
  if (!src || token !== speakToken) return false
  return playSrc(src, token)
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
  for (const part of parts) {
    if (token !== speakToken) return
    await playAudioClip(part)
  }
}

/**
 * Hear question — runs inside a tap.
 * Primes a local MP3 in the gesture, then plays quiz lines as downloaded audio files.
 */
export async function speakQuizFromGesture(question: string, options: string[]) {
  stopSpeaking()
  const token = speakToken
  const session = voiceSession
  const parts = buildQuizSpeechParts(question, options)
  pauseFeedVideos()
  unlocked = true

  const audio = getSharedAudio()
  audio.muted = false
  audio.volume = 1

  // 1) Start a real local file immediately (user gesture) so iOS allows audio.
  audio.src = READY_MP3
  const prime = audio.play()

  // 2) Download the first quiz line as an MP3 blob in parallel.
  const firstUrlPromise = resolveClipUrl(parts[0] ?? '')

  await prime.catch(() => {})
  if (token !== speakToken) return session

  // Don't make the user sit through all of Ready — jump to the question.
  try {
    audio.pause()
  } catch {
    // ignore
  }

  for (let index = 0; index < parts.length; index += 1) {
    if (token !== speakToken) return session
    const src = index === 0
      ? await firstUrlPromise
      : await resolveClipUrl(parts[index])
    if (!src) continue
    const ok = await playSrc(src, token)
    if (!ok && index === 0) {
      // If even the first file fails, surface silence rather than hanging.
      break
    }
  }

  return session
}

export function buildQuizSpeech(question: string, options: string[]) {
  return buildQuizSpeechParts(question, options).join(' ')
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

// Keep cache from growing forever across a long study session.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    revokeObjectUrls()
  })
}
