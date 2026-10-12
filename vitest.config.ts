import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // Build-Ausgabe (inkl. .next/standalone mit Kopien der Quellen) ist kein Testcode.
    exclude: [...configDefaults.exclude, '.next/**'],
  },
})
