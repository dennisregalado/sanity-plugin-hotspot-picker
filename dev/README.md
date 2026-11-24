# Dev harness

Renders the plugin's inputs from `../src` in a browser, without a Sanity project: the real `sanity`
package with the hooks that need a running Studio (client, preview store, form callbacks, initial
values) replaced in `mock-sanity.tsx`. Each scene in `main.tsx` shows one behaviour. Not published:
the package only ships `dist`.

```sh
cd dev
npm install
npx vite                       # http://localhost:5173 (?scene=<id> for one scene)
node screenshots.cjs <out-dir>  # a PNG per scene; optional second argument: scene ids, comma-separated
```

Vite doesn't watch `../src` (outside its root); run `./restart.sh` after changing it.
