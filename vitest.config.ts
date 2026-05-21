import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Separate vitest config: no React Compiler plugin (babel-plugin-react-compiler
// doesn't work well in jsdom test environment)
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    css: false,
  },
})
