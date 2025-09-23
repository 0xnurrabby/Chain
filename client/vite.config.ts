// vite.config.ts (js চাইলে .js করে নাও)
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') // loads .env* into process.env

  // ---- General envs (with safe defaults) ----
  const HOST = env.VITE_HOST || '0.0.0.0'         // LAN/VPS থেকে অ্যাক্সেসের জন্য 0.0.0.0
  const PORT = Number(env.VITE_PORT || 5173)
  const API_PREFIX = env.VITE_API_PREFIX || '/api'

  // Backend URL (prod বা preview এ দরকার; dev এ proxy target)
  const BACKEND_URL = (env.VITE_BACKEND_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '')

  // Optional HTTPS for dev (e.g., cookies / OAuth need secure)
  const USE_HTTPS = env.VITE_HTTPS === '1'
  const httpsConfig =
    USE_HTTPS
      ? {
          key: fs.readFileSync(path.resolve(env.VITE_HTTPS_KEY || './certs/dev.key')),
          cert: fs.readFileSync(path.resolve(env.VITE_HTTPS_CERT || './certs/dev.crt')),
        }
      : undefined

  // Optional explicit HMR host/port for VPS/domain dev
  const hmr =
    env.VITE_HMR_HOST
      ? {
          host: env.VITE_HMR_HOST,                 // e.g., nurrabby.xyz or 203.0.113.10
          port: Number(env.VITE_HMR_PORT || PORT),
          protocol: env.VITE_HMR_PROTOCOL || (USE_HTTPS ? 'wss' : 'ws'),
        }
      : undefined

  // Single proxy block that handles HTTP + WebSocket, CORS, origin, etc.
  const proxyTarget = BACKEND_URL
  const proxyConfig = {
    target: proxyTarget,
    changeOrigin: true,
    secure: false,           // allow self-signed during dev
    ws: true,                // WebSocket proxying
    // keep the same path prefix (/api -> /api). If your backend is root, use:
    // rewrite: p => p.replace(new RegExp(`^${API_PREFIX}`), ''),
  }

  return {
    plugins: [react()],

    // ---- Base path (useful if app served under subpath) ----
    base: env.VITE_BASE || '/',

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },

    // ---- DEV server (works on localhost, LAN IP, VPS IP, domain) ----
    server: {
      host: HOST,                // 0.0.0.0 -> LAN/VPS থেকে খুলে যাবে
      port: PORT,
      strictPort: true,
      https: httpsConfig,        // set VITE_HTTPS=1 and provide certs to enable
      hmr,                       // needed only when dev server is behind a proxy or on VPS
      cors: {
        origin: true,            // reflect request origin
        credentials: true,       // allow cookies if needed
      },
      proxy: {
        [API_PREFIX]: proxyConfig,
      },
    },

    // ---- vite preview (for quick prod-like test) ----
    preview: {
      host: HOST,
      port: Number(env.VITE_PREVIEW_PORT || 5174),
      https: httpsConfig,
      proxy: {
        [API_PREFIX]: proxyConfig,
      },
    },

    // ---- Build tweaks ----
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
      target: 'es2018',
    },

    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
  }
})
