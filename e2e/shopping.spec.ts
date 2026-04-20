import { test, expect } from '@playwright/test'
import { resetDb } from './helpers/db'
import { addMap, addSpot, addItem, goToListTab } from './helpers/actions'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await resetDb(page)
  await addMap(page, 'テストホール')
  await addSpot(page, { name: 'テストサークル', priority: 'A' })
  await goToListTab(page)
})

test('商品を追加するとリストに表示される', async ({ page }) => {
  await addItem(page, 'テストサークル', '新刊A')
  await expect(page.getByText('新刊A')).toBeVisible()
})

test('商品をチェックすると購入済みになる', async ({ page }) => {
  await addItem(page, 'テストサークル', 'チェックテスト')

  // チェックボタン: ItemRow の w-5 h-5 rounded-full ボタン（テキストなし）
  await page.locator('button.w-5.h-5.rounded-full').first().click()
  await page.waitForTimeout(200)

  // アイテム名に line-through スタイルがかかる
  await expect(page.locator('span.line-through').filter({ hasText: 'チェックテスト' })).toBeVisible()
})

test('商品を売切にすると売切表示になる', async ({ page }) => {
  await addItem(page, 'テストサークル', '売切テスト')

  // 「売切」ボタンをクリック
  await page.getByRole('button', { name: '売切' }).first().click()
  await page.waitForTimeout(200)

  // 売切ボタン（ItemRow の text-xs クラスのボタン）が赤背景になる
  await expect(page.locator('button.text-xs').filter({ hasText: '売切' }).first()).toHaveClass(/bg-red-500/)
})

test('商品追加で進捗が更新される', async ({ page }) => {
  await addItem(page, 'テストサークル', '進捗テスト商品1')
  await addItem(page, 'テストサークル', '進捗テスト商品2')

  // 「0/2 購入済み」形式の進捗テキストが表示される
  await expect(page.getByText(/\d+\/\d+ 購入済み/)).toBeVisible()
})

test('価格付き商品を追加すると合計金額が表示される', async ({ page }) => {
  await addItem(page, 'テストサークル', '有料本', 500)

  // ヘッダーに ¥500 が表示される（2要素あってもどちらかが見えればOK）
  await expect(page.getByText(/¥500|500/).first()).toBeVisible()
})
