import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  build: {
    target: ['chrome89', 'safari15'],
  },
  plugins: [react()],
})
