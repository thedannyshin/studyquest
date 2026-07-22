import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installSafariViewport } from './safariViewport'
import './styles.css'

installSafariViewport()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
