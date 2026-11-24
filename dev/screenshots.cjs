// Usage: node screenshots.cjs <out-dir>   (with `npx vite` running in this folder)
const {chromium} = require('playwright')
const path = require('node:path')
const fs = require('node:fs')

const out = process.argv[2] || 'shots'
fs.mkdirSync(out, {recursive: true})

const only = process.argv[3]
const steps = {
  readonly: async (p, s) => {
    await s.locator('button[aria-label^="Edit"]').first().click()
  },
  initial: async (p, s) => {
    const box = await s.locator('[style*="crosshair"]').boundingBox()
    await p.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.7)
  },
  missing: async (p, s) => s.locator('button[aria-label^="Edit"]').first().hover(),
  imagefield: async () => {},
  norouter: async (p, s) => s.locator('button[aria-label^="Edit"]').first().hover(),
  edges: async () => {},
  // Headless Chromium has no hover media, so the header's actions stay hidden: show them.
  editbutton: async (p, s) =>
    p.addStyleTag({
      content: '[data-has-actions], [data-ui=FieldActionsFlex] {opacity: 1 !important}',
    }),
  crop: async (p, s) => {
    await s.locator('button[aria-label="Edit image"]').click()
    await p.mouse.move(0, 0)
  },
}

;(async () => {
  const browser = await chromium.launch()
  for (const [scene, step] of Object.entries(steps)) {
    if (only && !only.split(',').includes(scene)) continue
    const page = await browser.newPage({viewport: {width: 700, height: 1100}, deviceScaleFactor: 2})
    page.on('pageerror', (e) => console.log(scene, 'pageerror:', e.message.slice(0, 200)))
    await page.route('https://cdn.sanity.io/**', (r) =>
      r.fulfill({path: path.join(__dirname, 'public/demo.jpg'), contentType: 'image/jpeg'}),
    )
    await page.goto(`http://localhost:5173/?scene=${scene}`, {waitUntil: 'networkidle'})
    const s = page.locator(`[data-scene="${scene}"]`)
    await s.waitFor()
    await page.waitForTimeout(500)
    await step(page, s)
    await page.waitForTimeout(1200)
    const box = await s.boundingBox()
    await page.screenshot({
      path: path.join(out, `${scene}.png`),
      clip: {
        x: Math.max(0, box.x - 8),
        y: Math.max(0, box.y - 8),
        width: box.width + 16,
        height: box.height + 16,
      },
    })
    console.log('saved', scene)
    await page.close()
  }
  await browser.close()
})()
