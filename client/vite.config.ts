// vite.config.ts  (বা vite.config.js)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// এখানে আপনার ngrok URL দিন (https:// ছাড়া শুধু হোস্ট)
// টানেল রিস্টার্ট করলে URL বদলাবে, তাই নিচে wildcard ব্যবহার করেছি।
const NGROK_HOST = process.env.NGROK_HOST || ''  // চাইলে runtime এ দিতে পারেন

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,            // 0.0.0.0 -> LAN/ngrok থেকে এক্সেস করা যাবে
    port: 5173,
    strictPort: true,

    // ✅ মূল সমাধান: ngrok ডোমেইন allow করা
    // ডোমেইনের সামনে dot দিলে সব সাবডোমেইন allow হয় (Vite 5 feature)
    allowedHosts: ['.ngrok-free.app'],

    // (ঐচ্ছিক) CORS খোলা থাকলে বাইরের রিকোয়েস্টে ঝামেলা কমে
    cors: true,

    // ✅ HMR যেন HTTPS টানেলে কাজ করে
    // NGROK_HOST না দিলেও কাজ করবে; দিলে হট-রিলোড আরও স্থিতিশীল হয়
    hmr: NGROK_HOST
      ? { protocol: 'wss', host: NGROK_HOST, clientPort: 443 }
      : { clientPort: 443 },

    // আপনার আগের proxy ব্লকটা রেখে দিন/প্রয়োজনে ঠিক করুন
    proxy: {
      '/api': {
        target: 'http://192.168.0.174:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/rpc': {
        target: 'http://192.168.0.174:8545',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
