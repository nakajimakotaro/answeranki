import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom'; // ReactDOM をインポート
import { trpc } from '../lib/trpc';
import { CalculationMistakeType } from '@shared/schemas/calculationMistake'; // 型をインポート

interface CalculationMistakeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  problemNoteId?: number; // オプションで問題IDを受け取る (フェーズ3用)
}

export const CalculationMistakeDialog: React.FC<CalculationMistakeDialogProps> = ({ isOpen, onClose, problemNoteId }) => {
  const utils = trpc.useUtils();
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [newTypeName, setNewTypeName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [showNewTypeInput, setShowNewTypeInput] = useState<boolean>(false);

  // 種類一覧を取得
  const { data: types, isLoading: isLoadingTypes, error: errorTypes } = trpc.calculationMistake.listTypes.useQuery();

  // 新しい種類を作成するミューテーション
  const createTypeMutation = trpc.calculationMistake.createType.useMutation({
    onSuccess: (data) => { // data は number | null
      utils.calculationMistake.listTypes.invalidate(); // 種類リストを再取得
      if (typeof data === 'number') { // 成功時にノートID (number) が返る
        setSelectedTypeId(String(data)); // 新しく作成した種類を選択 (IDは文字列として扱う)
        setNewTypeName(''); // 入力フィールドをクリア
        setShowNewTypeInput(false); // 入力フィールドを隠す
      } else {
        // 成功したが noteId が null または予期せぬ形式の場合
        setSelectedTypeId(''); // 選択を解除
        console.warn("New type created, but couldn't automatically select it. Received:", data);
      }
    },
    onError: (error) => {
      // TODO: エラー表示 (例: トースト通知)
      console.error("Failed to create type:", error);
      alert(`種類の作成に失敗しました: ${error.message}`);
    }
  });

  // 詳細を作成するミューテーション
  const createDetailMutation = trpc.calculationMistake.createDetail.useMutation({
    onSuccess: () => {
      utils.calculationMistake.listDetails.invalidate(); // 詳細リストを再取得
      onClose(); // ダイアログを閉じる
    },
    onError: (error) => {
      // TODO: エラー表示
      console.error("Failed to create detail:", error);
      alert(`計算ミスの登録に失敗しました: ${error.message}`);
    }
  });

  // ダイアログが閉じられたときに state をリセット
  useEffect(() => {
    if (!isOpen) {
      setSelectedTypeId('');
      setNewTypeName('');
      setDescription('');
      setShowNewTypeInput(false);
    }
  }, [isOpen]);

  const handleCreateType = () => {
    if (newTypeName.trim()) {
      createTypeMutation.mutate({ name: newTypeName.trim() });
    }
  };

  const handleSave = () => {
    if (!selectedTypeId || !description.trim()) {
      alert('ミスの種類と詳細を入力してください。');
      return;
    }
    createDetailMutation.mutate({
      typeId: selectedTypeId,
      description: description.trim(),
      problemNoteId: problemNoteId, // problemNoteId があれば渡す
    });
  };

  if (!isOpen) {
    return null;
  }

  // Portal を使用して document.body にレンダリング
  return ReactDOM.createPortal(
    <div className="modal modal-open">
      {/* modal-backdrop を追加して背景をクリックで閉じられるようにする（オプション） */}
      {/* <div className="modal-backdrop" onClick={onClose}></div> */}
      <div className="modal-box w-11/12 max-w-md mx-auto relative p-6">
        <h3 className="font-bold text-lg mb-5 text-center">計算ミスを登録</h3>
        {problemNoteId && (
          <p className="text-sm text-gray-500 mb-5 text-center">問題ノートID: {problemNoteId}</p>
        )}

        {/* 種類選択 */}
        <div className="form-control mb-5">
          <div className="mb-2 font-medium">ミスの種類</div>
          <div className="flex items-center gap-2">
            <select
              className="select select-bordered w-full"
              value={selectedTypeId}
              onChange={(e) => {
                setSelectedTypeId(e.target.value);
                setShowNewTypeInput(false); // 既存選択時は新規入力欄を隠す
              }}
              disabled={isLoadingTypes || createTypeMutation.isPending}
            >
              <option value="" disabled>種類を選択...</option>
              {types?.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn-sm btn-outline whitespace-nowrap"
              onClick={() => {
                setShowNewTypeInput(!showNewTypeInput);
                setSelectedTypeId(''); // 新規追加モード時は選択解除
              }}
              disabled={isLoadingTypes || createTypeMutation.isPending}
            >
              {showNewTypeInput ? 'キャンセル' : '新規追加'}
            </button>
          </div>
          {isLoadingTypes && <span className="loading loading-spinner loading-sm mt-2"></span>}
          {errorTypes && <p className="text-red-500 text-sm mt-2">種類の読み込みに失敗しました: {errorTypes.message}</p>}
        </div>

        {/* 新規種類追加 */}
        {showNewTypeInput && (
          <div className="form-control mb-5 p-4 border rounded-md bg-base-200">
             <div className="mb-2 font-medium">新しいミスの種類名</div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="例: 符号ミス"
                className="input input-bordered w-full"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                disabled={createTypeMutation.isPending}
              />
              <button
                className="btn btn-primary whitespace-nowrap"
                onClick={handleCreateType}
                disabled={!newTypeName.trim() || createTypeMutation.isPending}
              >
                {createTypeMutation.isPending ? <span className="loading loading-spinner loading-xs"></span> : '追加'}
              </button>
            </div>
             {createTypeMutation.error && <p className="text-red-500 text-sm mt-2">種類の追加に失敗しました: {createTypeMutation.error.message}</p>}
          </div>
        )}

        {/* 詳細入力 */}
        <div className="form-control mb-6">
          <div className="mb-2 font-medium">ミスの詳細</div>
          <textarea
            className="textarea textarea-bordered h-32 w-full"
            placeholder="どのようなミスをしたか具体的に記述..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={createDetailMutation.isPending}
          ></textarea>
        </div>

        {/* アクションボタン */}
        <div className="flex justify-end gap-2">
          <button 
            className="btn btn-outline" 
            onClick={onClose} 
            disabled={createDetailMutation.isPending || createTypeMutation.isPending}
          >
            閉じる
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!selectedTypeId || !description.trim() || createDetailMutation.isPending || createTypeMutation.isPending}
          >
            {createDetailMutation.isPending ? <span className="loading loading-spinner loading-xs"></span> : '保存'}
          </button>
        </div>
      </div>
    </div>,
    document.body // レンダリング先の要素
  );
};
