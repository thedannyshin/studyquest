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
let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null

function waitForVoices() {
  if (!canSpeakQuiz()) return Promise.resolve([] as SpeechSynthesisVoice[])
  if (voicesReady) return voicesReady

  voicesReady = new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices()
    if (existing.length > 0) {
      resolve(existing)
      return
    }

    const finish = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', finish)
      resolve(window.speechSynthesis.getVoices())
    }

    window.speechSynthesis.addEventListener('voiceschanged', finish)
    window.setTimeout(finish, 700)
  })

  return voicesReady
}

function pickVoice(voices: SpeechSynthesisVoice[]) {
  if (voices.length === 0) return null
  const preferred = voices.find((voice) => /en(-|_)US/i.test(voice.lang) && /siri|Samantha|Karen|Daniel|Google US/i.test(voice.name))
    ?? voices.find((voice) => /en(-|_)US/i.test(voice.lang))
    ?? voices.find((voice) => /^en/i.test(voice.lang))
  return preferred ?? voices[0]
}

/** Call inside a tap handler so later programmatic speak() works on iOS. */
export function unlockSpeechSynthesis() {
  if (!canSpeakQuiz()) return
  speechUnlocked = true
  void waitForVoices().then((voices) => {
    const voice = pickVoice(voices)
    try {
      window.speechSynthesis.cancel()
      window.speechSynthesis.resume()
      const unlock = new SpeechSynthesisUtterance('Ready')
      unlock.rate = 1.05
      unlock.volume = 1
      unlock.lang = voice?.lang || 'en-US'
      if (voice) unlock.voice = voice
      window.speechSynthesis.speak(unlock)
    } catch {
      // ignore
    }
  })

  // Also kick an immediate empty speak in the gesture turn (iOS requirement).
  try {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(' '))
  } catch {
    // ignore
  }
}

export function stopSpeaking() {
  if (!canSpeakQuiz()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    // ignore
  }
}

export async function speakText(text: string, rate = 1) {
  if (!canSpeakQuiz() || !text.trim()) return

  const voices = await waitForVoices()
  const voice = pickVoice(voices)

  await new Promise<void>((resolve) => {
    stopSpeaking()

    // Chrome can leave synthesis paused; iOS needs a beat after cancel.
    window.setTimeout(() => {
      try {
        window.speechSynthesis.resume()
      } catch {
        // ignore
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = rate
      utterance.pitch = 1
      utterance.volume = 1
      utterance.lang = voice?.lang || 'en-US'
      if (voice) utterance.voice = voice

      let settled = false
      const settle = () => {
        if (settled) return
        settled = true
        window.clearInterval(watchdog)
        resolve()
      }

      utterance.onend = settle
      utterance.onerror = settle

      // Chrome bug: speech can freeze unless resumed periodically.
      const watchdog = window.setInterval(() => {
        try {
          if (window.speechSynthesis.paused) window.speechSynthesis.resume()
          if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) settle()
        } catch {
          settle()
        }
      }, 250)

      try {
        window.speechSynthesis.speak(utterance)
        if (!speechUnlocked) {
          // Still try; unlock should have happened on Passive tap.
          speechUnlocked = true
        }
      } catch {
        settle()
      }

      // Safety timeout for silent failures.
      window.setTimeout(settle, Math.min(20000, Math.max(4000, text.length * 80)))
    }, 60)
  })
}

export function buildQuizSpeech(question: string, options: string[]) {
  const choices = options
    .map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`)
    .join('. ')
  return `${question}. Your choices are: ${choices}. Say the letter of your answer.`
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
