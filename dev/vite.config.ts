import {fileURLToPath} from 'node:url'

import react from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

// The harness renders the plugin's components from ../src. `sanity` is aliased to a module that
// re-exports the real package and swaps out the hooks that need a running Studio (client, preview
// store, form callbacks).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {find: /^sanity$/, replacement: fileURLToPath(new URL('./mock-sanity.tsx', import.meta.url))},
    ],
    dedupe: ['react', 'react-dom', 'styled-components', '@sanity/ui'],
  },
  server: {port: 5173, fs: {allow: ['..']}},
})
