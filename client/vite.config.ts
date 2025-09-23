// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') // loads .env* into process.env

  // ---- General envs (with safe defaults) ----
  const HOST = env.VITE_HOST || '0.0.0.0'         // LAN/VPS access
  const PORT = Number(env.VITE_PORT || 5173)
  const API_PREFIX = env.VITE_API_PREFIX || '/api'

  // Backend URL (prod/preview); dev proxy target
  const BACKEND_URL = (env.VITE_BACKEND_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '')

  // Optional HTTPS for dev (cookies / OAuth)
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
          host: env.VITE_HMR_HOST,                 // e.g. nurrabby.xyz
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
    // rewrite: p => p.replace(new RegExp(`^${API_PREFIX}`), ''), // if backend is rooted
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

    // ---- DEV server (localhost, LAN IP, VPS IP, domain) ----
    server: {
      host: HOST,
      port: PORT,
      strictPort: true,
      https: httpsConfig,
      hmr,
      cors: {
        origin: true,
        credentials: true,
      },
      // ✅ allowlist your domains (fixes "host not allowed")
      // safer: list specific hosts instead of 'all'
      allowedHosts: ['nurrabby.xyz', 'www.nurrabby.xyz'],
      proxy: {
        [API_PREFIX]: proxyConfig,
      },
    },

    // ---- vite preview (prod-like quick test) ----
    preview: {
      host: HOST,
      port: Number(env.VITE_PREVIEW_PORT || 5174),
      https: httpsConfig,
      // keep same allowlist for preview too
      allowedHosts: ['nurrabby.xyz', 'www.nurrabby.xyz'],
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
