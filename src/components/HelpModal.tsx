import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Slide {
  title: string;
  images: { src: string; alt: string }[];
  caption: string;
}

const SLIDES: Slide[] = [
  {
    title: '📋 マップを追加する',
    images: [
      { src: '/help/01-map-dropdown.png', alt: 'ホールを選択ドロップダウン' },
      { src: '/help/01-hall-name.png', alt: 'ホール名入力' },
    ],
    caption: 'ヘッダーの「ホールを選択」→「ホールを追加」→ PDF を選択 → 名前を入力して追加',
  },
  {
    title: '📍 ピン（スポット）を追加する',
    images: [
      { src: '/help/02-placing-banner.png', alt: 'ピン配置バナー' },
      { src: '/help/02-add-spot-modal.png', alt: 'サークル追加モーダル' },
    ],
    caption: '右下の ＋ → マップをタップしてピンを配置 → 情報を入力して「追加」',
  },
  {
    title: '✏️ ピンを移動する',
    images: [
      { src: '/help/03-pin-edit-mode.png', alt: 'ピン編集モード' },
    ],
    caption: 'ツールバーの ✏️ ボタンで編集モードに切り替え → ピンを長押しドラッグで移動',
  },
  {
    title: '🗺️ リストとマップを行き来する',
    images: [
      { src: '/help/04-list-tab.png', alt: 'リストのピンアイコン' },
    ],
    caption: 'リストの 📍 アイコンでマップのピンへ移動。マップのピンをタップ → 店名タップでリストへ',
  },
];

const QA = [
  {
    q: 'ピンの色・情報を変えたい',
    a: 'リストのスポット右端の ✏️ アイコンから編集できます。',
  },
  {
    q: '商品を追加したい',
    a: 'リストでスポットを展開し「＋ 商品を追加」をタップ。名前と金額（任意）を入力。',
  },
  {
    q: '優先度やジャンルでピンを絞り込みたい',
    a: 'マップのツールバーまたはリストヘッダーのフィルターアイコンをタップ → 優先度・ジャンル・タグで絞り込みできます（複数選択可）。',
  },
  {
    q: '完了したスポットを非表示にしたい',
    a: 'フィルターアイコンをタップして「完了非表示」をオン。',
  },
  {
    q: 'スポットの並び順を変えたい',
    a: 'リストヘッダーの ↕ アイコンをタップ → ドラッグまたは「名前順」「優先度順」ボタンで整列。',
  },
  {
    q: 'まとめてスポットを登録したい',
    a: '右上の ⚙️（設定）→「データ」→「CSVインポート」から一括登録できます。',
  },
];

type Page = 'slides' | 'qa';

interface Props {
  onClose: () => void;
}

export function HelpModal({ onClose }: Props) {
  const [page, setPage] = useState<Page>('slides');
  const [slideIndex, setSlideIndex] = useState(0);
  const [imgIndex, setImgIndex] = useState(0);

  const slide = SLIDES[slideIndex];
  const isFirst = slideIndex === 0;
  const isLast = slideIndex === SLIDES.length - 1;

  const goToSlide = (index: number) => {
    setSlideIndex(index);
    setImgIndex(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl flex flex-col"
        style={{ maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ドラッグハンドル + タブ + 閉じるボタン */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
          <div className="flex items-center gap-2">
            <div className="flex gap-1 flex-1 bg-gray-100 rounded-full p-0.5">
              <button
                onClick={() => setPage('slides')}
                className={`flex-1 py-2.5 text-body rounded-full transition-colors ${page === 'slides' ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-400'}`}
              >
                使い方
              </button>
              <button
                onClick={() => setPage('qa')}
                className={`flex-1 py-2.5 text-body rounded-full transition-colors ${page === 'qa' ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-400'}`}
              >
                Q&A
              </button>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 p-2.5">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto">
          {page === 'slides' ? (
            <div className="flex flex-col">
              <div className="px-4 pb-2">
                <h3 className="text-base font-bold text-gray-800">{slide.title}</h3>
              </div>

              {/* スクショ（複数の場合は横スライド） */}
              <div className="relative bg-gray-50 overflow-hidden">
                <div
                  className="flex transition-transform duration-300"
                  style={{ transform: `translateX(-${imgIndex * 100}%)` }}
                >
                  {slide.images.map((img, i) => (
                    <img
                      key={i}
                      src={img.src}
                      alt={img.alt}
                      className="w-full object-contain shrink-0"
                      style={{ maxHeight: '52vh' }}
                    />
                  ))}
                </div>
                {slide.images.length > 1 && (
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                    {slide.images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setImgIndex(i)}
                        className={`w-3 h-3 rounded-full transition-colors ${i === imgIndex ? 'bg-blue-500' : 'bg-gray-300'}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* キャプション */}
              <div className="px-4 py-3">
                <p className="text-body text-gray-700 leading-relaxed">{slide.caption}</p>
              </div>

              {/* スライドナビ */}
              <div className="flex items-center justify-between px-2 pb-5">
                <button
                  onClick={() => goToSlide(slideIndex - 1)}
                  disabled={isFirst}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-lg text-body text-gray-500 disabled:opacity-30"
                >
                  <ChevronLeft size={16} /> 前へ
                </button>
                <div className="flex gap-1.5">
                  {SLIDES.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goToSlide(i)}
                      className={`w-3 h-3 rounded-full transition-colors ${i === slideIndex ? 'bg-blue-500' : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => {
                    if (isLast) { setPage('qa'); }
                    else { goToSlide(slideIndex + 1); }
                  }}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-lg text-body text-blue-500"
                >
                  {isLast ? 'Q&A へ' : '次へ'} <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 px-4 py-3 pb-6">
              {QA.map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-800 mb-1">Q. {item.q}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">A. {item.a}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
