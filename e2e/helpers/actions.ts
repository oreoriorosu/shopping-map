import { Page, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_PDF = path.join(__dirname, '../fixtures/test-map.pdf')

/**
 * ヘッダーのドロップダウンを開き、PDFをアップロードしてマップを追加する。
 *
 * UIフロー:
 * 1. 「ホールを選択」ボタンをクリック（MapSelector のドロップダウントグル）
 * 2. 「ホールを追加」ボタンをクリック → hidden file input が開く
 * 3. PDFファイルをセット
 * 4. 「ホール名を入力」モーダルで名前を入力
 * 5. 「追加」ボタンをクリック
 */
export async function addMap(page: Page, mapName = 'テストホール') {
  // ドロップダウントグルボタン（「ホールを選択」または現在のマップ名 + ChevronDown）
  const toggleBtn = page.locator('header button').filter({ hasText: /ホールを選択|東|西|南|北|テスト/ }).first()
  const fallbackToggle = page.locator('header').getByRole('button').first()

  if (await toggleBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await toggleBtn.click()
  } else {
    await fallbackToggle.click()
  }

  // ドロップダウン内の「ホールを追加」ボタン
  const addHallBtn = page.getByText('ホールを追加')
  await addHallBtn.waitFor({ state: 'visible', timeout: 3000 })

  // file chooser イベントを待ちながらクリック
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    addHallBtn.click(),
  ])
  await fileChooser.setFiles(TEST_PDF)

  // 「ホール名を入力」モーダルが表示される
  const nameInput = page.getByPlaceholder('例: 東ホール')
  await nameInput.waitFor({ state: 'visible', timeout: 3000 })
  await nameInput.clear()
  await nameInput.fill(mapName)

  // 「追加」ボタン（exact: true で「ホールを追加」と区別）
  await page.getByRole('button', { name: '追加', exact: true }).click()

  // ドロップダウンが閉じてマップが選択されるのを待つ
  await page.waitForTimeout(500)
}

/**
 * FABをクリックしてピン配置後、スポット追加モーダルで情報を入力する。
 *
 * UIフロー:
 * 1. FAB「+」をクリック → ピン配置バナー表示
 * 2. マップ（canvas または img）をクリックしてピン配置
 * 3. AddSpotModal が開く
 *    - 場所: placeholder="さ" の入力欄に文字、placeholder="10" に番号
 *    - サークル名: placeholder="空欄なら場所名を使用"
 *    - 優先度: A/B/C/Dのボタン
 * 4. 「追加」ボタンをクリック
 */
export async function addSpot(
  page: Page,
  opts: {
    locationCode?: string
    name?: string
    priority?: 'A' | 'B' | 'C' | 'D'
  } = {}
) {
  const { locationCode = 'あ-1', name = 'テストサークル', priority } = opts

  // FABクリック（テキストが「+」のボタン）
  await page.locator('button').filter({ hasText: /^\+$/ }).click()

  // ピン配置バナーが出るのを待つ
  await expect(page.getByText('マップをタップしてピンを配置')).toBeVisible({ timeout: 3000 })

  // マップ（canvas または img）の中央をクリックしてピン配置
  await page.waitForFunction(() => {
    const el = (document.querySelector('canvas') ?? document.querySelector('img[alt=""]')) as HTMLElement | null
    return el && el.getBoundingClientRect().width > 0
  }, { timeout: 5000 })

  const hasCanvas = await page.locator('canvas').count() > 0
  if (hasCanvas) {
    await page.locator('canvas').first().click()
  } else {
    await page.locator('img[alt=""]').first().click()
  }

  // モーダルが開くのを待つ
  await page.getByRole('heading', { name: 'サークルを追加' }).waitFor({ state: 'visible', timeout: 5000 })

  // 場所コード入力
  const [locationChar, locationNum] = locationCode.split('-')
  await page.getByPlaceholder('さ').fill(locationChar)
  await page.getByPlaceholder('10').fill(locationNum)

  // サークル名入力
  await page.getByPlaceholder('空欄なら場所名を使用').fill(name)

  // 優先度選択
  if (priority) {
    // 優先度ボタンは w-12 h-12 クラスを持つ（ジャンルカラーボタン等と区別）
    await page.locator('button.w-12').filter({ hasText: new RegExp(`^${priority}$`) }).click()
  }

  // 「追加」ボタン（last() でモーダル内のものを確実に選択）
  await page.locator('button').filter({ hasText: /^追加$/ }).last().click()

  // モーダルが閉じるのを待つ
  await page.waitForTimeout(500)
}

/**
 * リストタブに切り替える。
 */
export async function goToListTab(page: Page) {
  await page.getByRole('button', { name: 'リスト' }).click()
}

/**
 * マップタブに切り替える。
 */
export async function goToMapTab(page: Page) {
  await page.getByRole('button', { name: 'マップ' }).click()
}

/**
 * スポットセクションを展開して商品を追加する。
 * ShoppingPanel 内の spotName テキストをクリックして展開し、商品を追加する。
 */
export async function addItem(page: Page, spotName: string, itemName: string, price?: number) {
  // ShoppingPanelのスポット名span（font-semibold truncate）をクリックして展開
  const spotRow = page.locator('span.font-semibold.truncate').filter({ hasText: spotName })
  await spotRow.click()
  await page.waitForTimeout(200)

  // 「+ 商品を追加」ボタンをクリック
  await page.getByRole('button', { name: /商品を追加/ }).last().click()

  // 商品名入力（最後に現れた入力欄）
  const input = page.getByPlaceholder(/商品名/).last()
  await input.waitFor({ state: 'visible' })
  await input.fill(itemName)

  if (price !== undefined) {
    const priceInput = page.getByPlaceholder(/金額|価格/).last()
    await priceInput.fill(String(price))
  }

  await input.press('Enter')
  await page.waitForTimeout(300)
}
