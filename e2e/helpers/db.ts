import { Page } from '@playwright/test'

const DB_NAME = 'ShoppingMapDB'

/**
 * IndexedDB を削除してページをリロードし、クリーンな状態にする。
 * 各テストの beforeEach で呼ぶ。
 */
export async function resetDb(page: Page) {
  await page.evaluate((dbName) => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(dbName)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
      req.onblocked = () => resolve() // ブロックされても続行
    })
  }, DB_NAME)
  await page.reload()
  // アプリの初期化完了を待つ
  await page.waitForSelector('body', { state: 'visible' })
}
