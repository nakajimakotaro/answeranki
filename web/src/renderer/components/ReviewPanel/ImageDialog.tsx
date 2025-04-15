import { XCircle } from 'lucide-react';
import { ImageDialogProps } from './types';

const ImageDialog = ({ enlargedImage, onClose }: ImageDialogProps) => {
  if (!enlargedImage) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 cursor-zoom-out"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
        <img src={enlargedImage} alt="拡大画像" className="max-h-[90vh] max-w-full object-contain rounded shadow-lg" />
        <button
          className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-1.5 shadow-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500"
          onClick={onClose}
          title="閉じる"
          aria-label="拡大画像を閉じる"
        >
          <XCircle className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default ImageDialog;
