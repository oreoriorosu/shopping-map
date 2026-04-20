import { test, expect } from '@playwright/test'
import { resetDb } from './helpers/db'
import { addMap } from './helpers/actions'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await resetDb(page)
})

test('初期状態でマップ未選択メッセージが表示される', async ({ page }) => {
  await expect(page.getByText(/マップを選択してください/i)).toBeVisible()
})

test('PDFをアップロードするとマップが追加されて選択される', async ({ page }) => {
  await addMap(page, 'テストホール')

  // マップが選択されてPDF（canvas）が表示される
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 5000 })

  // ボトムタブが表示される（マップが1件以上あるとき）
  await expect(page.getByRole('button', { name: 'マップ' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'リスト' })).toBeVisible()
})

test('マップを追加するとFABが表示される', async ({ page }) => {
  await addMap(page, 'テストホール')

  // マップタブにいる状態でFAB「+」が表示される
  const fab = page.locator('button').filter({ hasText: '+' })
  await expect(fab).toBeVisible()
})
