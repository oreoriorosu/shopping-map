import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Slide {
  title: string;
  steps: string[];
  note?: string;
}

const SLIDES: Slide[] = [
  {
    title: '📋 マップを追加する',
    steps: [
      'ヘッダー右の ↑ アイコンをタップ',
      '「マップを追加」を選択',
      'PDFファイルを選択するとマップが登録される',
    ],
    note: '複数のマップを登録して切り替えられます',
  },
  {
    title: '📍 ピン（スポット）を追加する',
    steps: [
      'マップを表示した状態で右下の ＋ をタップ',
      '場所・サークル名・優先度などを入力して「次へ」',
      'マップ上のピンを置きたい場所をタップ',
    ],
    note: '長押しすると「ここに配置」プレビューが表示されます',
  },
  {
    title: '✏️ ピンを移動する',
    steps: [
      'マップ上部のペンシル（✏️）ボタンをタップして編集モードに入る',
      '移動したいピンを長押しするとドラッグできる',
      '好きな場所で指を離すと位置が保存される',
    ],
    note: 'ペンシルボタンをもう一度タップすると編集モードを終了できます',
  },
  {
    title: '🗺️ リストとマップを行き来する',
    steps: [
      '【リスト → マップ】スポット行右のピンアイコンをタップ → マップに切り替わりピンが中央に表示',
      '【マップ → リスト】マップ上のピンをタップ → ポップアップの店名をタップ → リストのスポットにスクロール',
    ],
  },
];

const QA = [
  {
    q: 'ピンの色を変えたい',
    a: 'リストのスポット名右のペンアイコンから編集できます。ピンカラーで8色から選択可能です。',
  },
  {
    q: '商品を追加したい',
    a: 'リストのスポットを展開して「＋ 商品を追加」をタップ。商品名と金額（任意）を入力してください。',
  },
  {
    q: '優先度の高いスポットだけ表示したい',
    a: 'マップ上部の A/B/C/D ボタンをタップして絞り込みできます（複数選択可）。',
  },
  {
    q: '完了したスポットを非表示にしたい',
    a: 'マップ上部の「済み非表示」ボタンをタップしてください。',
  },
  {
    q: 'スポットの並び順を変えたい',
    a: 'リストヘッダーの「並び替え」ボタンをタップ。ドラッグで自由に並び替えるか、「名前順」「優先度順」で自動整列できます。',
  },
  {
    q: 'スポットをまとめて登録したい',
    a: 'ヘッダーの ↑ アイコンから CSV インポートが使えます。',
  },
];

type Page = 'slides' | 'qa';

interface Props {
  onClose: () => void;
}

export function HelpModal({ onClose }: Props) {
  const [page, setPage] = useState<Page>('slides');
  const [slideIndex, setSlideIndex] = useState(0);

  const slide = SLIDES[slideIndex];
  const isFirst = slideIndex === 0;
  const isLast = slideIndex === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center px-5 pt-5 pb-3 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 absolute left-1/2 -translate-x-1/2 top-3" />
          <div className="flex gap-1 flex-1 mt-2">
            <button
              onClick={() => setPage('slides')}
              className={`flex-1 py-1.5 text-sm rounded-full transition-colors ${page === 'slides' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              使い方
            </button>
            <button
              onClick={() => setPage('qa')}
              className={`flex-1 py-1.5 text-sm rounded-full transition-colors ${page === 'qa' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Q&A
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2 mt-2 shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {page === 'slides' ? (
            <div className="flex flex-col gap-4">
              {/* スライドカード */}
              <div className="bg-gray-50 rounded-2xl p-5 min-h-48">
                <h3 className="text-base font-bold text-gray-800 mb-4">{slide.title}</h3>
                <ol className="space-y-3">
                  {slide.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-700">
                      <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                {slide.note && (
                  <p className="mt-4 text-xs text-gray-400 bg-white rounded-xl px-3 py-2 border border-gray-100">
                    💡 {slide.note}
                  </p>
                )}
              </div>

              {/* ページネーション */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSlideIndex(i => i - 1)}
                  disabled={isFirst}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-gray-500 disabled:opacity-30"
                >
                  <ChevronLeft size={16} /> 前へ
                </button>
                <div className="flex gap-1.5">
                  {SLIDES.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSlideIndex(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${i === slideIndex ? 'bg-blue-500' : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => {
                    if (isLast) { setPage('qa'); }
                    else { setSlideIndex(i => i + 1); }
                  }}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-blue-500"
                >
                  {isLast ? 'Q&A へ' : '次へ'} <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {QA.map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-800 mb-1.5">Q. {item.q}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">A. {item.a}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
