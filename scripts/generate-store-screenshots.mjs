import { spawn } from 'node:child_process'
import { mkdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const port = 4174
const baseUrl = `http://127.0.0.1:${port}`
const rawDir = path.join(root, 'store-assets', 'screenshots', 'raw')

const scenarios = [
  {
    id: 'offline_plan',
    title: 'Download once. Plan offline.',
    subtitle: 'Routes, fares and stations work without mobile data.',
    setup: async (page) => {
      await waitForApp(page)
    },
  },
  {
    id: 'nearest_station',
    title: 'Nearest station from GPS',
    subtitle: 'Offline coordinates help find nearby metro stations.',
    setup: async (page) => {
      await waitForApp(page)
      await page.getByRole('button', { name: /Nearest/i }).last().click()
      await page.waitForTimeout(700)
    },
  },
  {
    id: 'route_result',
    title: 'Clear routes and interchanges',
    subtitle: 'See stops, fare, time and where to change lines.',
    setup: async (page) => {
      await waitForApp(page)
      await page.getByRole('button', { name: /Find route/i }).click()
      await page.waitForTimeout(700)
    },
  },
  {
    id: 'metro_map',
    title: 'Interactive metro map',
    subtitle: 'Search stations and view Purple, Green and Yellow lines.',
    setup: async (page) => {
      await waitForApp(page)
      await page.getByRole('button', { name: /Find route/i }).click()
      await page.waitForTimeout(500)
      await page.getByRole('button', { name: /View on map/i }).click()
      await page.waitForTimeout(700)
    },
  },
  {
    id: 'journey_mode',
    title: 'Journey mode for commuters',
    subtitle: 'Move stop by stop and keep your trip context handy.',
    setup: async (page) => {
      await waitForApp(page)
      await page.getByRole('button', { name: /Find route/i }).click()
      await page.waitForTimeout(500)
      await page.getByRole('button', { name: /Start journey/i }).click()
      await page.waitForTimeout(700)
    },
  },
]

const products = [
  {
    name: 'ios_iphone_69',
    width: 1290,
    height: 2796,
    viewport: { width: 430, height: 932, deviceScaleFactor: 2 },
    outDir: path.join(root, 'fastlane', 'screenshots', 'ios', 'en-US'),
    prefix: 'iphone_69',
  },
  {
    name: 'ios_ipad_13',
    width: 2048,
    height: 2732,
    viewport: { width: 820, height: 1092, deviceScaleFactor: 1 },
    outDir: path.join(root, 'fastlane', 'screenshots', 'ios', 'en-US'),
    prefix: 'ipad_13',
  },
  {
    name: 'android_phone',
    width: 1080,
    height: 1920,
    viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    outDir: path.join(root, 'fastlane', 'metadata', 'android', 'en-US', 'images', 'phoneScreenshots'),
    prefix: 'phone',
  },
  {
    name: 'android_7_tablet',
    width: 1200,
    height: 1920,
    viewport: { width: 600, height: 960, deviceScaleFactor: 1 },
    outDir: path.join(root, 'fastlane', 'metadata', 'android', 'en-US', 'images', 'sevenInchScreenshots'),
    prefix: '7in',
  },
  {
    name: 'android_10_tablet',
    width: 1600,
    height: 2560,
    viewport: { width: 800, height: 1280, deviceScaleFactor: 1 },
    outDir: path.join(root, 'fastlane', 'metadata', 'android', 'en-US', 'images', 'tenInchScreenshots'),
    prefix: '10in',
  },
]

function startServer() {
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  return child
}

async function waitForServer() {
  const started = Date.now()
  while (Date.now() - started < 30000) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
  }
  throw new Error('Timed out waiting for Vite dev server')
}

async function waitForApp(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.waitForSelector('.app-shell')
  await page.waitForTimeout(1200)
}

function screenshotPath(product, scenario, index) {
  return path.join(product.outDir, `${String(index + 1).padStart(2, '0')}_${product.prefix}_${scenario.id}.png`)
}

async function captureRaw(browser, product, scenario) {
  const context = await browser.newContext({
    viewport: { width: product.viewport.width, height: product.viewport.height },
    deviceScaleFactor: product.viewport.deviceScaleFactor,
    isMobile: product.viewport.width < 700,
    hasTouch: product.viewport.width < 700,
    geolocation: { latitude: 12.9758, longitude: 77.5729, accuracy: 35 },
    permissions: ['geolocation'],
  })

  const page = await context.newPage()
  await scenario.setup(page)
  const file = path.join(rawDir, `${product.name}_${scenario.id}.png`)
  await page.screenshot({ path: file, fullPage: false })
  await context.close()
  return file
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

async function compose(browser, product, scenario, rawPath, index) {
  const context = await browser.newContext({
    viewport: { width: product.width, height: product.height },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  const rawUrl = `data:image/png;base64,${(await readFile(rawPath)).toString('base64')}`
  const isTablet = product.width >= 1200 && product.height <= 2200 ? true : product.width >= 1600
  const topSpace = Math.round(product.height * (isTablet ? 0.16 : 0.18))
  const side = Math.round(product.width * (isTablet ? 0.075 : 0.085))
  const bottom = Math.round(product.height * 0.045)
  const appWidth = product.width - side * 2
  const appHeight = product.height - topSpace - bottom
  const radius = Math.round(product.width * 0.035)
  const titleSize = Math.round(product.width * (isTablet ? 0.045 : 0.058))
  const subtitleSize = Math.round(product.width * (isTablet ? 0.021 : 0.032))
  const html = `<!doctype html>
    <html>
      <head>
        <style>
          * { box-sizing: border-box; }
          html, body { height: 100%; margin: 0; width: 100%; }
          body {
            align-items: center;
            background:
              radial-gradient(circle at 20% 10%, rgba(45, 212, 191, 0.32), transparent 32%),
              radial-gradient(circle at 86% 78%, rgba(124, 58, 237, 0.26), transparent 34%),
              linear-gradient(135deg, #083047 0%, #07111f 100%);
            color: white;
            display: flex;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            height: ${product.height}px;
            justify-content: center;
            overflow: hidden;
            position: relative;
            width: ${product.width}px;
          }
          .lines {
            inset: 0;
            opacity: 0.26;
            position: absolute;
          }
          .copy {
            left: ${side}px;
            position: absolute;
            right: ${side}px;
            top: ${Math.round(topSpace * 0.2)}px;
          }
          h1 {
            font-size: ${titleSize}px;
            letter-spacing: 0;
            line-height: 1.04;
            margin: 0 0 ${Math.round(titleSize * 0.28)}px;
            max-width: ${Math.round(product.width * 0.82)}px;
          }
          p {
            color: #ccfbf1;
            font-size: ${subtitleSize}px;
            font-weight: 750;
            line-height: 1.35;
            margin: 0;
            max-width: ${Math.round(product.width * 0.78)}px;
          }
          .app {
            background: white;
            border: ${Math.max(1, Math.round(product.width * 0.005))}px solid rgba(255,255,255,.42);
            border-radius: ${radius}px;
            bottom: ${bottom}px;
            box-shadow: 0 ${Math.round(product.width * 0.045)}px ${Math.round(product.width * 0.11)}px rgba(0,0,0,.36);
            height: ${appHeight}px;
            left: ${side}px;
            overflow: hidden;
            position: absolute;
            width: ${appWidth}px;
          }
          .app img {
            display: block;
            height: 100%;
            object-fit: cover;
            object-position: top center;
            width: 100%;
          }
        </style>
      </head>
      <body>
        <svg class="lines" viewBox="0 0 ${product.width} ${product.height}" preserveAspectRatio="none">
          <polyline points="${product.width * 0.06},${product.height * 0.72} ${product.width * 0.28},${product.height * 0.55} ${product.width * 0.46},${product.height * 0.59} ${product.width * 0.72},${product.height * 0.38} ${product.width * 0.96},${product.height * 0.31}" fill="none" stroke="#7c3aed" stroke-width="${Math.round(product.width * 0.026)}" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="${product.width * 0.22},${product.height * 0.08} ${product.width * 0.38},${product.height * 0.27} ${product.width * 0.48},${product.height * 0.47} ${product.width * 0.42},${product.height * 0.82}" fill="none" stroke="#22c55e" stroke-width="${Math.round(product.width * 0.026)}" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="${product.width * 0.56},${product.height * 0.88} ${product.width * 0.62},${product.height * 0.69} ${product.width * 0.72},${product.height * 0.50} ${product.width * 0.89},${product.height * 0.45}" fill="none" stroke="#facc15" stroke-width="${Math.round(product.width * 0.026)}" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <section class="copy">
          <h1>${escapeHtml(scenario.title)}</h1>
          <p>${escapeHtml(scenario.subtitle)}</p>
        </section>
        <section class="app"><img src="${rawUrl}" /></section>
      </body>
    </html>`

  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.screenshot({ path: screenshotPath(product, scenario, index), fullPage: false })
  await context.close()
}

async function main() {
  await rm(rawDir, { recursive: true, force: true })
  await mkdir(rawDir, { recursive: true })
  for (const product of products) await mkdir(product.outDir, { recursive: true })

  const server = startServer()
  try {
    await waitForServer()
    const browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
    })

    try {
      for (const product of products) {
        for (let index = 0; index < scenarios.length; index += 1) {
          const scenario = scenarios[index]
          const raw = await captureRaw(browser, product, scenario)
          await compose(browser, product, scenario, raw, index)
        }
      }
    } finally {
      await browser.close()
    }
  } finally {
    server.kill('SIGTERM')
  }

  console.log(`Generated ${products.length * scenarios.length} store screenshots.`)
}

await main()
