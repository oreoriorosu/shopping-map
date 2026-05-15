/**
 * 画像マップでのピン配置座標テスト
 * 問題: 画像ファイルをマップとして登録した時にピンが画面外に飛ぶ
 * 原因候補: Tailwind max-width:100%、pageSize(naturalSize)と描画サイズのズレなど
 */
import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import { resetDb } from './helpers/db'
import { addSpot } from './helpers/actions'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_PNG = path.join(__dirname, 'fixtures/test-map.png')

async function addImageMap(page: import('@playwright/test').Page, mapName = 'テスト画像ホール') {
  const toggleBtn = page.locator('header button').filter({ hasText: /ホールを選択|東|西|南|北|テスト/ }).first()
  const fallbackToggle = page.locator('header').getByRole('button').first()

  if (await toggleBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await toggleBtn.click()
  } else {
    await fallbackToggle.click()
  }

  const addHallBtn = page.getByText('ホールを追加')
  await addHallBtn.waitFor({ state: 'visible', timeout: 3000 })

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    addHallBtn.click(),
  ])
  await fileChooser.setFiles(TEST_PNG)

  const nameInput = page.getByPlaceholder('例: 東ホール')
  await nameInput.waitFor({ state: 'visible', timeout: 3000 })
  await nameInput.clear()
  await nameInput.fill(mapName)

  await page.locator('button').filter({ hasText: /^追加$/ }).last().click()
  await page.waitForTimeout(500)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await resetDb(page)
})

test('画像マップ: canvasのサイズがnaturalSizeと一致する', async ({ page }) => {
  // モバイルサイズ: 画像(800×600)がビューポート(390px)より大きい状況
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await addImageMap(page)

  // canvas が表示されるまで待つ（画像描画完了 = pageSize が設定される）
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
    return canvas && canvas.width > 0
  }, { timeout: 5000 })
  await page.waitForTimeout(300)

  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      renderedWidth: rect.width,
      renderedHeight: rect.height,
      offsetWidth: canvas.offsetWidth,
      offsetHeight: canvas.offsetHeight,
    }
  })

  console.log('canvas info:', JSON.stringify(canvasInfo, null, 2))

  expect(canvasInfo).not.toBeNull()
  expect(canvasInfo!.canvasWidth).toBe(800)
  expect(canvasInfo!.canvasHeight).toBe(600)
  // CSS layout サイズ = naturalWidth (max-width 制約なし)
  expect(canvasInfo!.offsetWidth).toBe(800)
  console.log(`canvasWidth=800, renderedWidth=${canvasInfo!.renderedWidth}, ratio=${canvasInfo!.renderedWidth / 800}`)
})

test('画像マップ: ピン配置後の座標がクリック位置と一致する', async ({ page }) => {
  await addImageMap(page)

  // canvas に描画されるまで待つ
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement | null
    return c && c.width > 0
  }, { timeout: 5000 })
  await page.waitForTimeout(500)

  // FABクリック → ピン配置バナー表示
  await page.locator('button').filter({ hasText: /^\+$/ }).click()
  await expect(page.getByText('マップをタップしてピンを配置')).toBeVisible({ timeout: 3000 })

  // canvas の描画サイズと位置を取得（クリック前）
  const imgRect = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      left: rect.left, top: rect.top,
      width: rect.width, height: rect.height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    }
  })
  console.log('canvasRect before click:', JSON.stringify(imgRect))

  // canvas の 25% 位置をクリック → handlePinPlace → モーダル表示
  const targetX = imgRect!.left + imgRect!.width * 0.25
  const targetY = imgRect!.top + imgRect!.height * 0.25
  console.log(`clicking at (${targetX}, ${targetY})`)

  await page.mouse.click(targetX, targetY)

  // モーダルが開くのを待つ
  await page.getByRole('heading', { name: 'サークルを追加' }).waitFor({ state: 'visible', timeout: 5000 })

  await page.getByPlaceholder('さ').fill('あ')
  await page.getByPlaceholder('10').fill('1')
  await page.getByPlaceholder('空欄なら場所名を使用').fill('ピン位置テスト')
  await page.locator('button').filter({ hasText: /^追加$/ }).last().click()

  await page.waitForTimeout(300)

  // IndexedDB からピン座標を取得
  const pinCoord = await page.evaluate(() => {
    return new Promise<{ x: number; y: number } | null>((resolve) => {
      const req = indexedDB.open('ShoppingMapDB')
      req.onsuccess = (e) => {
        const db = (e.target as IDBOpenDBRequest).result
        const tx = db.transaction('spots', 'readonly')
        const store = tx.objectStore('spots')
        const getAll = store.getAll()
        getAll.onsuccess = () => {
          const spots = getAll.result
          if (spots.length === 0) { resolve(null); return }
          resolve({ x: spots[0].pin.x, y: spots[0].pin.y })
        }
      }
      req.onerror = () => resolve(null)
    })
  })

  console.log('stored pin coord:', JSON.stringify(pinCoord))

  // クリックした位置（25%付近）が正しく記録されているか確認
  expect(pinCoord).not.toBeNull()
  expect(pinCoord!.x).toBeGreaterThan(0.1)
  expect(pinCoord!.x).toBeLessThan(0.5)
  expect(pinCoord!.y).toBeGreaterThan(0.1)
  expect(pinCoord!.y).toBeLessThan(0.5)
})

test('画像マップ: ピンが画面内に表示される（画面外に飛ばない）', async ({ page }) => {
  await addImageMap(page)
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement | null
    return c && c.width > 0
  }, { timeout: 5000 })
  await page.waitForTimeout(500)

  // FABクリック → ピン配置バナー表示
  await page.locator('button').filter({ hasText: /^\+$/ }).click()
  await expect(page.getByText('マップをタップしてピンを配置')).toBeVisible({ timeout: 3000 })

  // canvas の中央をクリック
  const imgRect = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  })

  await page.mouse.click(
    imgRect!.left + imgRect!.width * 0.5,
    imgRect!.top + imgRect!.height * 0.5,
  )

  // モーダルが開くのを待って「追加」を押す
  await page.getByRole('heading', { name: 'サークルを追加' }).waitFor({ state: 'visible', timeout: 5000 })
  await page.getByPlaceholder('空欄なら場所名を使用').fill('画面内テスト')
  await page.locator('button').filter({ hasText: /^追加$/ }).last().click()

  await page.waitForTimeout(800) // setTransform アニメーション待ち

  // ピンラベルが viewport 内に表示されているか確認
  const pinVisible = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*')).filter(
      el => el.textContent?.trim() === '画面内テスト'
    )
    if (els.length === 0) return { found: false, rect: null }
    const rect = els[0].getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    return {
      found: true,
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      inViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= vw && rect.bottom <= vh,
      vw,
      vh,
    }
  })

  console.log('pin visibility:', JSON.stringify(pinVisible))
  expect(pinVisible.found).toBe(true)
  expect(pinVisible.inViewport).toBe(true)
})
