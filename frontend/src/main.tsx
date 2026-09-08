import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ConfigErrorScreen from './components/ConfigErrorScreen';
import { missingEnvVars } from './config/env';
import { publishBuildInfo } from './lib/buildInfo';
import { installGlobalErrorHandlers, reactErrorHandlers } from './lib/errorReporting';

// Self-hosted Titillium Web — only the faces this design actually uses.
// Previously a render-blocking Google Fonts <link> that needed two cold
// cross-origin handshakes, requested weight 300 (never used) and omitted
// 700-italic and 900 (both used), so the browser synthesised faux-italic and
// faux-bold for the brand headline on the first screen.
// Weight 800 (VersusMode, HeadToHeadLoader) resolves to 900 by CSS font
// matching, so it needs no face of its own. The family has no 900-italic.
// Vite emits these as hashed woff2 under the existing far-future cache rule.
import '@fontsource/titillium-web/latin-400.css';
import '@fontsource/titillium-web/latin-600.css';
import '@fontsource/titillium-web/latin-700.css';
import '@fontsource/titillium-web/latin-700-italic.css';
import '@fontsource/titillium-web/latin-900.css';

// An error thrown outside a render — in a promise chain, an event handler or a
// timer — previously reached nothing but the browser console.
installGlobalErrorHandlers();

// One console line and a window global, so support can ask 'which build?' and
// get an answer. Before the render, so it survives a boot-time crash.
publishBuildInfo();

// Checked at boot rather than at import: a missing key used to render nothing
// at all, so the failure looked like a broken deploy rather than a config gap.
const root = createRoot(document.getElementById('root')!, reactErrorHandlers);

root.render(
    <StrictMode>
        {missingEnvVars.length > 0 ? <ConfigErrorScreen missing={missingEnvVars} /> : <App />}
    </StrictMode>,
);

// Field measurement, deliberately last and dynamically imported: the library
// that measures the first paint should not be one of the things downloaded
// before it.
//
// Guarded on the collector being configured, and both operands are statically
// replaced at build time — so a production build with no VITE_RUM_ENDPOINT
// folds this to `false` and rolldown drops web-vitals and the module below it
// entirely, rather than shipping ~4 kB gz to measure into a void. Setting the
// endpoint is what makes it appear. DEV keeps it on regardless, where the
// measurements go to the console.
if (import.meta.env.DEV || import.meta.env.VITE_RUM_ENDPOINT) {
    void import('./lib/webVitals').then(({ reportWebVitals }) => reportWebVitals());
}
