import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { installGlobalErrorHandlers, reactErrorHandlers } from './lib/errorReporting'

// Self-hosted Titillium Web — only the faces this design actually uses.
// Previously a render-blocking Google Fonts <link> that needed two cold
// cross-origin handshakes, requested weight 300 (never used) and omitted
// 700-italic and 900 (both used), so the browser synthesised faux-italic and
// faux-bold for the brand headline on the first screen.
// Weight 800 (VersusMode, HeadToHeadLoader) resolves to 900 by CSS font
// matching, so it needs no face of its own. The family has no 900-italic.
// Vite emits these as hashed woff2 under the existing far-future cache rule.
import '@fontsource/titillium-web/latin-400.css'
import '@fontsource/titillium-web/latin-600.css'
import '@fontsource/titillium-web/latin-700.css'
import '@fontsource/titillium-web/latin-700-italic.css'
import '@fontsource/titillium-web/latin-900.css'

// An error thrown outside a render — in a promise chain, an event handler or a
// timer — previously reached nothing but the browser console.
installGlobalErrorHandlers()

createRoot(document.getElementById('root')!, reactErrorHandlers).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
