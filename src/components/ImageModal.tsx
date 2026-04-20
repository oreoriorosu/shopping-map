export function ImageModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <img
        src={url}
        alt="お品書き"
        className="max-w-full max-h-full rounded-lg object-contain"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}
