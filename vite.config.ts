import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

function git(command: string) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

const commitCount = git('git rev-list --count HEAD') || '0'
const commitSha = git('git rev-parse --short HEAD') || 'dev'

const TTS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-tts-api',
      configureServer(server) {
        server.middlewares.use('/api/tts', async (req, res) => {
          try {
            const full = new URL(req.url || '', 'http://localhost')
            const text = (full.searchParams.get('text') || '').trim().slice(0, 180)
            if (!text) {
              res.statusCode = 400
              res.end('Missing text')
              return
            }
            const upstream = new URL('https://translate.google.com/translate_tts')
            upstream.searchParams.set('ie', 'UTF-8')
            upstream.searchParams.set('client', 'tw-ob')
            upstream.searchParams.set('tl', 'en')
            upstream.searchParams.set('q', text)
            const response = await fetch(upstream.toString(), {
              headers: {
                'User-Agent': TTS_UA,
                Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
                Referer: 'https://translate.google.com/',
              },
            })
            if (!response.ok) {
              res.statusCode = 502
              res.end('TTS upstream failed')
              return
            }
            const buffer = Buffer.from(await response.arrayBuffer())
            res.setHeader('Content-Type', 'audio/mpeg')
            res.setHeader('Cache-Control', 'public, max-age=86400')
            res.end(buffer)
          } catch (error) {
            res.statusCode = 500
            res.end(String(error))
          }
        })
      },
    },
  ],
  define: {
    __COMMIT_COUNT__: JSON.stringify(commitCount),
    __COMMIT_SHA__: JSON.stringify(commitSha),
  },
})
