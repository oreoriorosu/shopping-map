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
 * FABをクリックしてスポット追加モーダルを開き、情報入力後にピンを配置する。
 *
 * UIフロー:
 * 1. FAB「+」をクリック
 * 2. AddSpotModal でサークル情報を入力
 *    - 場所: placeholder="さ" の入力欄に文字、placeholder="10" に番号
 *    - サークル名: placeholder="空欄なら場所名を使用"
 *    - 優先度: A/B/C/Dのボタン
 * 3. 「次へ（ピンを配置）」をクリック
 * 4. マップをタップしてピン配置
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

  // モーダルが開くのを待つ（h3「サークルを追加」タイトル）
  await page.getByRole('heading', { name: 'サークルを追加' }).waitFor({ state: 'visible', timeout: 3000 })

  // 場所コード入力
  const [locationChar, locationNum] = locationCode.split('-')
  const charInput = page.getByPlaceholder('さ')
  await charInput.fill(locationChar)

  const numInput = page.getByPlaceholder('10')
  await numInput.fill(locationNum)

  // サークル名入力
  await page.getByPlaceholder('空欄なら場所名を使用').fill(name)

  // 優先度選択
  if (priority) {
    // 優先度ボタンは w-10 h-10 クラスを持つ。w-6 h-6 のフィルタバッジと区別するためクラスで絞る
    await page.locator('button.w-10').filter({ hasText: new RegExp(`^${priority}$`) }).click()
  }

  // 「次へ（ピンを配置）」ボタン
  await page.getByRole('button', { name: '次へ（ピンを配置）' }).click()

  // ピン配置バナーが出るのを待つ
  await expect(page.getByText('マップをタップしてピンを配置')).toBeVisible({ timeout: 3000 })

  // マップ（canvas）の中央をクリックしてピン配置
  // canvasRef.current が確実に設定されるよう、canvasが非ゼロサイズになるまで待つ
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
    return canvas && canvas.getBoundingClientRect().width > 0
  }, { timeout: 5000 })

  // Playwright高レベルclickでcanvas中央をクリック
  await page.locator('canvas').first().click()

  // バナーが消えるのを待つ（handlePinPlace完了 = setPlacing(null)が呼ばれた証拠）
  await expect(page.getByText('マップをタップしてピンを配置')).not.toBeVisible({ timeout: 10000 })
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
  // ShoppingPanelのスポット名span（font-medium truncate）をクリックして展開
  const spotRow = page.locator('span.font-medium.truncate').filter({ hasText: spotName })
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
