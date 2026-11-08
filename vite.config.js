import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function firebaseMessagingWorker(env) {
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.VITE_FIREBASE_APP_ID || '',
  }
  const source = readFileSync(new URL('./src/firebase-messaging-sw.js', import.meta.url), 'utf8')
    .replace('__FIREBASE_CONFIG__', JSON.stringify(firebaseConfig))

  return {
    name: 'firebase-messaging-worker',
    configureServer(server) {
      server.middlewares.use('/firebase-messaging-sw.js', (req, res, next) => {
        if (req.method !== 'GET') return next()
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        res.setHeader('Service-Worker-Allowed', '/')
        res.end(source)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'firebase-messaging-sw.js', source })
    },
  }
}

function apiPreconnect(apiUrl) {
  const origin = new URL(apiUrl).origin

  return {
    name: 'api-preconnect',
    transformIndexHtml(html) {
      return html.replace('</head>', `  <link rel="preconnect" href="${origin}" crossorigin>\n</head>`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL || (mode === 'development'
    ? 'http://localhost:4000/api/v1'
    : 'https://academicall-api-1.onrender.com/api/v1')

  return {
    plugins: [react(), tailwindcss(), firebaseMessagingWorker(env), apiPreconnect(apiUrl)],
    resolve: {
      // Use pdf.js's legacy build so the reader works on older Chrome/Safari and Android WebViews
      // (the modern build needs Uint8Array.prototype.toHex and other very new APIs).
      alias: [{ find: /^pdfjs-dist$/, replacement: 'pdfjs-dist/legacy/build/pdf.mjs' }],
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
