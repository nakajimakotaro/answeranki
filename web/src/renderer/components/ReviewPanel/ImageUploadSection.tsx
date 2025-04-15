import { Scan, X, Maximize } from 'lucide-react';
import { ImageUploadSectionProps } from './types';

const ImageUploadSection = ({
  imagePreviews,
  onDrop,
  onDragOver,
  onFileChange,
  onRemoveImage,
  onEnlargeImage,
}: ImageUploadSectionProps) => {
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onClick={() => document.getElementById('file-upload')?.click()}
      className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center cursor-pointer hover:bg-gray-50 mb-4"
    >
      {imagePreviews.length > 0 ? (
        <div>
          <p className="text-sm text-gray-700 mb-2">{imagePreviews.length}枚の画像がアップロードされました</p>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative group aspect-square">
                <img
                  src={preview}
                  alt={`アップロードされた解答 ${index + 1}`}
                  onClick={(e) => { e.stopPropagation(); onEnlargeImage(preview); }}
                  className="w-full h-full object-cover rounded border"
                />
                <div className="absolute top-1 right-1 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveImage(index); }}
                    title="削除"
                    className="bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEnlargeImage(preview); }}
                    title="拡大"
                    className="bg-blue-500 text-white rounded-full p-1 hover:bg-blue-600 shadow"
                  >
                    <Maximize className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); document.getElementById('file-upload')?.click(); }}
            className="text-sm text-blue-600 hover:text-blue-800 mt-2"
          >
            さらに画像を追加
          </button>
        </div>
      ) : (
        <div className="py-4">
          <Scan className="w-8 h-8 mx-auto text-gray-400 mb-2" />
          <p className="text-gray-500 mb-1">ここに解答画像をドラッグ&ドロップ</p>
          <p className="text-sm text-gray-400">または、クリックして画像を選択</p>
        </div>
      )}
      <input
        id="file-upload"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  );
};

export default ImageUploadSection;
