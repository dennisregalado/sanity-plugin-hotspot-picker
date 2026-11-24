import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

import {defineConfig, type Plugin} from 'vite'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')

/**
 * Serves `/images/<project>/<dataset>/<id>-<w>x<h>.<ext>` (the Sanity CDN's URL shape) from
 * `./images/<id>.<ext>` (trailing `z`s padding the id to 24 characters dropped), logging the requested `w` so the harness can check the sizes requested.
 * An id starting with `slow` waits until `/release` is fetched, to show the loading state.
 */
function fakeCdn(): Plugin {
  let release: (() => void)[] = []
  return {
    name: 'fake-cdn',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        if (url.pathname === '/release') {
          release.forEach((fn) => fn())
          release = []
          res.end('ok')
          return
        }
        const match = url.pathname.match(/^\/images\/[^/]+\/[^/]+\/([a-z]+)-\d+x\d+\.(\w+)$/)
        if (!match) return next()
        const [, id, ext] = match
        const file = path.join(here, 'images', `${id.replace(/^slow/, '').replace(/z+$/, '')}.${ext}`)
        // eslint-disable-next-line no-console
        console.log(`[cdn] ${id} w=${url.searchParams.get('w')} rect=${url.searchParams.get('rect')}`)
        const send = () => {
          res.setHeader('Content-Type', 'image/jpeg')
          fs.createReadStream(file).pipe(res)
        }
        if (id.startsWith('slow')) release.push(send)
        else send()
      })
    },
  }
}

export default defineConfig({
  root: here,
  plugins: [fakeCdn()],
  esbuild: {jsx: 'automatic'},
  resolve: {
    alias: [
      {find: /^sanity$/, replacement: path.join(here, 'shims/sanity.tsx')},
      {find: /^sanity\/structure$/, replacement: path.join(here, 'shims/structure.tsx')},
    ],
    dedupe: ['react', 'react-dom', 'styled-components', '@sanity/ui'],
  },
  server: {fs: {allow: [root]}, port: 5199, strictPort: true},
})
