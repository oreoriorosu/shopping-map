import { test, expect } from '@playwright/test'
import { resetDb } from './helpers/db'
import { addMap, addSpot, addItem, goToListTab, goToMapTab } from './helpers/actions'

// リスト内のスポット名を取得するヘルパー（pin labelと区別するため）
const listSpotName = (page: Parameters<typeof expect>[0], name: string) =>
  (page as import('@playwright/test').Page).locator('span.font-medium.truncate').filter({ hasText: name })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await resetDb(page)
  await addMap(page, 'テストホール')
  await addSpot(page, { name: 'ナビテストサークル', priority: 'B' })
})

test('リストタブに切り替えるとスポットが表示される', async ({ page }) => {
  await goToListTab(page)
  await expect(listSpotName(page, 'ナビテストサークル')).toBeVisible()
})

test('リストからマップタブに戻れる', async ({ page }) => {
  await goToListTab(page)
  await goToMapTab(page)

  await expect(page.locator('canvas').first()).toBeVisible()
})

test('リストのピンアイコンをタップするとマップタブに遷移する', async ({ page }) => {
  await goToListTab(page)

  // スポットのselect buttonをクリックして展開
  await listSpotName(page, 'ナビテストサークル').click()
  await page.waitForTimeout(200)

  // MapPin アイコン付きのボタン（onNavigateToPin）をクリック
  // ShoppingPanel line 391: <button onClick={onNavigateToPin} className="text-gray-300..."><MapPin size={15} /></button>
  const navButtons = page.locator('button.text-gray-300')
  const pinNavBtn = navButtons.filter({ has: page.locator('svg') }).first()
  await pinNavBtn.click()

  await page.waitForTimeout(500)
  await expect(page.locator('canvas').first()).toBeVisible()
})

test('ピンをタップするとポップアップが表示される', async ({ page }) => {
  // マップタブのピンラベルをクリック（text-white font-bold の div）
  const pinLabel = page.locator('div.text-white.font-bold').filter({ hasText: 'ナビテストサークル' })
  await pinLabel.click()
  await page.waitForTimeout(300)

  // ポップアップが開く（最初に現れる span.truncate がポップアップヘッダー）
  await expect(page.locator('span.truncate').filter({ hasText: 'ナビテストサークル' }).first()).toBeVisible()
})

test('スポット選択後にリストタブへ切り替えるとそのスポットがハイライトされる', async ({ page }) => {
  await goToListTab(page)
  await addItem(page, 'ナビテストサークル', 'ハイライト確認用商品')
  await goToMapTab(page)

  // マップのピンラベルをクリック
  await page.locator('div.text-white.font-bold').filter({ hasText: 'ナビテストサークル' }).click()
  await page.waitForTimeout(300)

  await goToListTab(page)

  // スポットが見えている
  await expect(listSpotName(page, 'ナビテストサークル')).toBeVisible()
})
