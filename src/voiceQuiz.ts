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
  }
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function canSpeakQuiz() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function canListenForQuiz() {
  return Boolean(getSpeechRecognitionCtor())
}

let speechUnlocked = false
let speakToken = 0
let cachedVoice: SpeechSynthesisVoice | null = null

function refreshVoice() {
  if (!canSpeakQuiz()) return null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return cachedVoice
  cachedVoice = voices.find((voice) => /en(-|_)US/i.test(voice.lang) && !/compact/i.test(voice.name))
    ?? voices.find((voice) => /^en/i.test(voice.lang))
    ?? voices[0]
  return cachedVoice
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices()
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    refreshVoice()
  })
}

/** Must run synchronously inside a tap handler (iOS). */
export function unlockSpeechSynthesis() {
  if (!canSpeakQuiz()) return
  speechUnlocked = true
  const synth = window.speechSynthesis
  try {
    synth.cancel()
    synth.resume()
    synth.getVoices()
    refreshVoice()

    // Keep this synchronous with the tap — do not await voices.
    const unlock = new SpeechSynthesisUtterance('Ready')
    unlock.rate = 1
    unlock.volume = 1
    unlock.lang = 'en-US'
    const voice = cachedVoice ?? refreshVoice()
    if (voice) {
      unlock.voice = voice
      unlock.lang = voice.lang
    }
    synth.speak(unlock)
  } catch {
    // ignore
  }
}

export function isSpeechUnlocked() {
  return speechUnlocked
}

export function stopSpeaking() {
  speakToken += 1
  if (!canSpeakQuiz()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    // ignore
  }
}

function speakChunk(text: string, rate: number, token: number) {
  return new Promise<void>((resolve) => {
    if (!canSpeakQuiz() || token !== speakToken) {
      resolve()
      return
    }

    const synth = window.speechSynthesis
    try {
      synth.resume()
    } catch {
      // ignore
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = rate
    utterance.pitch = 1
    utterance.volume = 1
    utterance.lang = 'en-US'
    const voice = cachedVoice ?? refreshVoice()
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    }

    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      window.clearInterval(watchdog)
      window.clearTimeout(timeout)
      resolve()
    }

    utterance.onend = settle
    utterance.onerror = settle

    const watchdog = window.setInterval(() => {
      if (token !== speakToken) {
        settle()
        return
      }
      try {
        if (synth.paused) synth.resume()
      } catch {
        settle()
      }
    }, 200)

    // If the browser silently drops the utterance, don't hang forever.
    const timeout = window.setTimeout(settle, Math.min(12000, Math.max(2500, text.length * 70)))

    try {
      synth.speak(utterance)
    } catch {
      settle()
    }
  })
}

function chunkSpeech(text: string, maxLen = 140) {
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

export async function speakText(text: string, rate = 1) {
  if (!canSpeakQuiz() || !text.trim()) return
  const token = speakToken
  refreshVoice()

  // Tiny gap after cancel so iOS/Chrome accept the next utterance.
  await new Promise((resolve) => window.setTimeout(resolve, 80))
  if (token !== speakToken) return

  for (const chunk of chunkSpeech(text)) {
    if (token !== speakToken) return
    await speakChunk(chunk, rate, token)
  }
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
  const token = speakToken
  for (const part of buildQuizSpeechParts(question, options)) {
    if (token !== speakToken) return
    await speakText(part)
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
    // Permission or start race — ignore.
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
