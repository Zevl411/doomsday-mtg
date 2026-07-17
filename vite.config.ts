import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // Forks can change their GitHub Pages repository path without editing code.
    base: env.VITE_BASE_PATH || '/doomsday-mtg/',
    plugins: [vue(), vuetify({ autoImport: true })],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      server: {
        deps: {
          inline: ['vuetify'],
        },
      },
    },
  }
})
