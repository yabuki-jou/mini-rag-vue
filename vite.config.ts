import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  // Windows 下当前 vue-router 版本的预构建会误扫描到受限父目录；浏览器可直接加载其 ESM。
  optimizeDeps: { exclude: ['vue-router'] },
  test: { environment: 'jsdom' },
})
