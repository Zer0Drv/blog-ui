import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// 跨域一律走 vite 代理：浏览器只碰同源 5173，后端不开 CORS
//
// 端口只读 VITE_PORT，不要读通用的 PORT：宿主环境（Ekko Studio 等）会把自己的
// 服务端口注入到 PORT，vite 一旦跟着占用，就会和宿主抢端口，进而触发
// 「端口冲突 -> 误杀占用进程 -> 宿主被杀」的连环故障。
export default defineConfig({
  plugins: [vue()],
  server: {
    port: Number(process.env.VITE_PORT || 5173),
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.API_TARGET || 'http://localhost:8082',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api/, '')
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // vitest 默认 externalize node_modules，async-validator（CJS）经 Node ESM 导入时
    // default 导出拿不到类本身（"AsyncValidator is not a constructor"），inline 后走 esbuild 预打包互操作
    server: {
      deps: {
        inline: ['element-plus', 'async-validator', '@element-plus/icons-vue']
      }
    }
  }
})
