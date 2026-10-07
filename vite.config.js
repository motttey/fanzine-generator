import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // Relative URLs also work when GitHub Pages serves a repository under /<repo>/.
  base: './',
  plugins: [vue()],
})
