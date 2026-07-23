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

export function canSpeakQuiz() {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined'
}

export function canListenForQuiz() {
  return Boolean(getSpeechRecognitionCtor())
}

// Tiny valid WAV — unlocks the mobile audio session on tap.
const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

let speakToken = 0
let currentAudio: HTMLAudioElement | null = null
let audioContext: AudioContext | null = null

function pauseFeedVideos() {
  if (typeof document === 'undefined') return
  document.querySelectorAll('video').forEach((node) => {
    const video = node as HTMLVideoElement
    video.pause()
  })
}

function ttsUrl(text: string) {
  const url = new URL('https://api.streamelements.com/kappa/v2/speech')
  url.searchParams.set('voice', 'Brian')
  url.searchParams.set('text', text.slice(0, 280))
  return url.toString()
}

function waitForAudioEnd(audio: HTMLAudioElement, token: number) {
  return new Promise<void>((resolve) => {
    if (token !== speakToken) {
      resolve()
      return
    }
    const settle = () => {
      audio.removeEventListener('ended', settle)
      audio.removeEventListener('error', settle)
      resolve()
    }
    audio.addEventListener('ended', settle)
    audio.addEventListener('error', settle)
  })
}

/** Unlocks iOS/Android audio session. Call from a tap handler. */
export function unlockAudioSession() {
  pauseFeedVideos()

  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (Ctx) {
      audioContext = audioContext ?? new Ctx()
      void audioContext.resume()
    }
  } catch {
    // ignore
  }

  try {
    const silent = new Audio(SILENT_WAV)
    silent.muted = false
    silent.volume = 1
    void silent.play().catch(() => {})
  } catch {
    // ignore
  }
}

/** Call from Passive toggle — unlocks session and plays an audible Ready clip. */
export function unlockSpeechSynthesis() {
  unlockAudioSession()
  void playAudioClip('Ready')
}

export function stopSpeaking() {
  speakToken += 1
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
}

async function playAudioClip(text: string) {
  if (!canSpeakQuiz() || !text.trim()) return
  const token = speakToken
  pauseFeedVideos()

  const audio = new Audio()
  currentAudio = audio
  audio.preload = 'auto'
  audio.muted = false
  audio.defaultMuted = false
  audio.volume = 1
  audio.playsInline = true
  audio.setAttribute('playsinline', 'true')
  audio.src = ttsUrl(text)

  try {
    await audio.play()
  } catch {
    return
  }

  if (token !== speakToken) {
    audio.pause()
    return
  }

  await waitForAudioEnd(audio, token)
}

export async function speakText(text: string) {
  if (!text.trim()) return
  const chunks = chunkSpeech(text, 180)
  const token = speakToken
  for (const chunk of chunks) {
    if (token !== speakToken) return
    await playAudioClip(chunk)
  }
}

function chunkSpeech(text: string, maxLen = 180) {
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
  const isIOS = typeof navigator !== 'undefined'
    && (/iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

  recognition.continuous = !isIOS
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
    if (isIOS) {
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
