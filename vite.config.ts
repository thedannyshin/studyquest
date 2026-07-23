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

export default defineConfig({
  plugins: [react()],
  define: {
    __COMMIT_COUNT__: JSON.stringify(commitCount),
    __COMMIT_SHA__: JSON.stringify(commitSha),
  },
})
