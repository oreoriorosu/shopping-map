import { test, expect } from '@playwright/test'
import { resetDb } from './helpers/db'
import { addMap, addSpot, goToListTab } from './helpers/actions'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await resetDb(page)
  await addMap(page, 'テストホール')
})

test('スポットを追加するとリストに表示される', async ({ page }) => {
  await addSpot(page, { name: 'テストサークル', locationCode: 'あ-1', priority: 'A' })

  await goToListTab(page)
  // ShoppingPanelのスポット名span（font-semibold truncate）でマップのpinラベルと区別する
  await expect(page.locator('span.font-semibold.truncate').filter({ hasText: 'テストサークル' })).toBeVisible()
})

test('スポット追加後にマップ上にピンが表示される', async ({ page }) => {
  await addSpot(page, { name: 'ピンテスト', locationCode: 'い-2' })

  // マップタブにいるのでピンが表示されているはず（.firstでpin label を取得）
  await expect(page.getByText('ピンテスト').first()).toBeVisible({ timeout: 3000 })
})

test('ピン配置中は配置バナーが表示される', async ({ page }) => {
  // FABクリック → バナーが表示される
  await page.locator('button').filter({ hasText: /^\+$/ }).click()

  await expect(page.getByText(/タップしてピンを配置/)).toBeVisible()
})

test('優先度Aのスポットにはバッジが表示される', async ({ page }) => {
  await addSpot(page, { name: '優先度Aサークル', priority: 'A' })

  // マップビューでAバッジが見える
  await expect(page.getByText('A').first()).toBeVisible()
})
