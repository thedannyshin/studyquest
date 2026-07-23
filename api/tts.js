const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.status(204).end()
    return
  }

  const raw = typeof req.query?.text === 'string' ? req.query.text : ''
  const text = raw.trim().slice(0, 180)
  if (!text) {
    res.status(400).json({ error: 'Missing text' })
    return
  }

  const upstream = new URL('https://translate.google.com/translate_tts')
  upstream.searchParams.set('ie', 'UTF-8')
  upstream.searchParams.set('client', 'tw-ob')
  upstream.searchParams.set('tl', 'en')
  upstream.searchParams.set('q', text)

  try {
    const response = await fetch(upstream.toString(), {
      headers: {
        'User-Agent': UA,
        Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
        Referer: 'https://translate.google.com/',
      },
    })

    if (!response.ok) {
      res.status(502).json({ error: 'TTS upstream failed', status: response.status })
      return
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength < 100) {
      res.status(502).json({ error: 'TTS returned empty audio' })
      return
    }

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).send(buffer)
  } catch (error) {
    res.status(500).json({ error: 'TTS proxy error', detail: String(error) })
  }
}
