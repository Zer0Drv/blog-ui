import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 跨域一律走 vite 代理：浏览器只碰同源 5173，后端不开 CORS
export default defineConfig({
  plugins: [vue()],
  server: {
    port: Number(process.env.PORT || 5173),
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.API_TARGET || 'http://localhost:8082',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api/, '')
      }
    }
  }
})
