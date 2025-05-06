import { useState, useCallback } from 'react';
import { PlusCircle, AlertCircle } from 'lucide-react'; // アイコンはそのまま使用
import { CalculationMistakeDialog } from './CalculationMistakeDialog';
import { trpc } from '../lib/trpc';

interface CalculationMistakeSectionProps {
  problemNoteId: number | undefined; // 問題の Note ID
}

/**
 * 特定の問題に関連する計算ミスを表示・登録するためのセクションコンポーネント
 */
export const CalculationMistakeSection = ({ problemNoteId }: CalculationMistakeSectionProps) => {
  const utils = trpc.useUtils();
  const [isMistakeDialogOpen, setIsMistakeDialogOpen] = useState(false);

  // この問題に関連する計算ミスを取得
  const { data: calculationMistakes, isLoading: isLoadingMistakes, error: mistakesError } = trpc.calculationMistake.listDetails.useQuery(
    { problemNoteId },
    { enabled: !!problemNoteId } // noteId が確定したらクエリを実行
  );

  const handleOpenMistakeDialog = useCallback(() => {
    setIsMistakeDialogOpen(true);
  }, []);

  const handleCloseMistakeDialog = useCallback(() => {
    setIsMistakeDialogOpen(false);
    // ダイアログが閉じられたら、関連する計算ミスリストを再取得
    if (problemNoteId) {
      utils.calculationMistake.listDetails.invalidate({ problemNoteId });
    }
  }, [utils, problemNoteId]);

  // problemNoteId が未定義の場合は何も表示しない
  if (problemNoteId === undefined) {
    return null;
  }

  return (
    // コンテナスタイルを ReviewPanel に合わせる
    <div className="bg-white border rounded-lg shadow-sm p-4 mb-6 space-y-4">
      <div className="flex justify-between items-center"> {/* mb-4 は親の space-y-4 で代替 */}
        {/* タイトルスタイルを ReviewPanel に合わせ、アイコンを追加 */}
        <h2 className="text-lg font-semibold flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 text-gray-600 flex-shrink-0" />
          関連する計算ミス
        </h2>
        <button
          onClick={handleOpenMistakeDialog}
          className="btn btn-secondary btn-sm flex items-center" // ボタンサイズは維持
          disabled={!problemNoteId} // noteId がないと無効
        >
          <PlusCircle className="w-4 h-4 mr-1" />
          計算ミスを登録
        </button>
      </div>

      {/* 計算ミスリスト */}
      {isLoadingMistakes && <p>計算ミスを読み込み中...</p>}
      {mistakesError && !isLoadingMistakes && (
        <div className="bg-orange-100 border border-orange-400 text-orange-700 px-4 py-3 rounded mb-4 flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 mt-0.5" />
          <div>
            <p className="font-semibold">計算ミスの読み込みに失敗しました</p>
            <p>{mistakesError.message}</p>
          </div>
        </div>
      )}
      {!isLoadingMistakes && !mistakesError && (
        calculationMistakes && calculationMistakes.length > 0 ? (
          // リストアイテムのテキスト色を調整
          <ul className="list-disc pl-5 space-y-2 text-base-content/80">
            {calculationMistakes.map((mistake) => (
              <li key={mistake.id}>
                {/* TODO: 種類名を表示するには listTypes も必要になる。一旦 description のみ表示 */}
                <p className="font-medium">内容:</p>
                <p className="ml-2 whitespace-pre-wrap">{mistake.description}</p>
                <p className="text-xs text-gray-500 ml-2">
                  登録日時: {new Date(mistake.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">関連する計算ミスはありません。</p>
        )
      )}

      {/* 計算ミス登録ダイアログ */}
      {problemNoteId !== undefined && ( // problemNoteId がないとダイアログは表示しない
        <CalculationMistakeDialog
          isOpen={isMistakeDialogOpen}
          onClose={handleCloseMistakeDialog}
          problemNoteId={problemNoteId} // 現在の問題の noteId を渡す
        />
      )}
    </div>
  );
};
