import { Save } from 'lucide-react';
import { SaveSectionProps } from './types';

const SaveSection = ({
  cardId,
  hasContentToSave,
  selectedEase,
  isSaving,
  isMediaLoading,
  saveSuccess,
  saveError,
  onSave,
}: SaveSectionProps) => {
  const isButtonDisabled =
    !cardId ||
    (!hasContentToSave && selectedEase === null) ||
    isSaving || isMediaLoading;

  const getButtonText = () => {
    if (isSaving || isMediaLoading) return '処理中...';
    if (hasContentToSave && selectedEase !== null) return "解答と難易度を保存/登録";
    if (hasContentToSave) return "解答を保存";
    if (selectedEase !== null) return "難易度を登録";
    return "保存";
  };

  return (
    <div className="mt-auto pt-4 border-t">
      {/* 保存成功/エラーメッセージ */}
      {saveSuccess && (
        <div className="bg-green-100 border border-green-300 text-green-800 px-3 py-2 rounded text-sm mb-4">
          解答と難易度が正常に保存/登録されました
        </div>
      )}
      {saveError && (
        <div className="bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded text-sm mb-4">
          保存/登録に失敗しました: {saveError.message}
        </div>
      )}

      {/* 保存ボタン */}
      <button
        type="button"
        onClick={onSave}
        disabled={isButtonDisabled}
        className={`w-full p-3 rounded-md font-medium flex items-center justify-center transition-colors ${
          isButtonDisabled
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-primary text-white hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary'
        }`}
      >
        <Save className="w-4 h-4 mr-2" />
        {getButtonText()}
      </button>
    </div>
  );
};

export default SaveSection;
