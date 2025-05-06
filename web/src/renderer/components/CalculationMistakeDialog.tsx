import React, { useState, useEffect, useMemo } from 'react'; // useMemo をインポート
import ReactDOM from 'react-dom';
import { trpc } from '../lib/trpc';
import { CalculationMistakeType, CalculationMistakeDetail } from '@shared/schemas/calculationMistake'; // CalculationMistakeDetail をインポート

interface CalculationMistakeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  problemNoteId?: number;
  initialData?: CalculationMistakeDetail; // 編集用の初期データ
}

export const CalculationMistakeDialog: React.FC<CalculationMistakeDialogProps> = ({
  isOpen,
  onClose,
  problemNoteId,
  initialData,
}) => {
  const utils = trpc.useUtils();
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [newTypeName, setNewTypeName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [showNewTypeInput, setShowNewTypeInput] = useState<boolean>(false);
  const isEditing = useMemo(() => !!initialData, [initialData]); // 編集モードかどうか

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

  // 詳細を更新するミューテーション
  const updateDetailMutation = trpc.calculationMistake.updateDetail.useMutation({
    onSuccess: () => {
      utils.calculationMistake.listDetails.invalidate(); // 詳細リストを再取得
      onClose(); // ダイアログを閉じる
    },
    onError: (error) => {
      console.error("Failed to update detail:", error);
      alert(`計算ミスの更新に失敗しました: ${error.message}`);
    }
  });

  // ダイアログが開かれたとき、または initialData が変更されたときに state を初期化/リセット
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // 編集モード: initialData から state を設定
        setSelectedTypeId(initialData.typeId);
        setDescription(initialData.description);
        setShowNewTypeInput(false); // 編集時は新規追加フォームを非表示
        setNewTypeName('');
      } else {
        // 新規登録モード: state をリセット
        setSelectedTypeId('');
        setDescription('');
        setShowNewTypeInput(false);
        setNewTypeName('');
        // problemNoteId は props から直接参照するため、state に保持しない
      }
    }
    // isOpen が false になった時 (閉じた時) はリセット不要 (onClose で親が initialData を null にするため、次回開く時にリセットされる)
  }, [isOpen, initialData]);

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

    const mutationData = {
      typeId: selectedTypeId,
      description: description.trim(),
      // problemNoteId は編集時には更新しない (関連付けは変更不可とする)
      // 新規登録時のみ problemNoteId を渡す
      problemNoteId: isEditing ? undefined : problemNoteId,
    };

    if (isEditing && initialData) {
      // 更新
      updateDetailMutation.mutate({
        id: initialData.id, // 更新対象のID
        ...mutationData,
      });
    } else {
      // 新規作成
      createDetailMutation.mutate(mutationData);
    }
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
        <h3 className="font-bold text-lg mb-5 text-center">
          {isEditing ? '計算ミスを編集' : '計算ミスを登録'}
        </h3>
        {/* problemNoteId は新規登録時のみ表示 */}
        {!isEditing && problemNoteId && (
          <p className="text-sm text-gray-500 mb-5 text-center">問題ノートID: {problemNoteId}</p>
        )}
        {/* 編集時は編集対象のIDを表示（デバッグ用、必要なら削除） */}
        {isEditing && initialData && (
           <p className="text-xs text-gray-400 mb-3 text-center">編集中のID: {initialData.id}</p>
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
              disabled={isLoadingTypes || createTypeMutation.isPending || isEditing} // 編集時は新規追加不可
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
                disabled={createTypeMutation.isPending || isEditing} // 編集時は新規追加不可
              />
              <button
                className="btn btn-primary whitespace-nowrap"
                onClick={handleCreateType}
                disabled={!newTypeName.trim() || createTypeMutation.isPending || isEditing} // 編集時は新規追加不可
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
            disabled={createDetailMutation.isPending || updateDetailMutation.isPending}
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
            disabled={
              !selectedTypeId ||
              !description.trim() ||
              createDetailMutation.isPending ||
              updateDetailMutation.isPending ||
              createTypeMutation.isPending // 新規タイプ作成中も無効
            }
          >
            {(createDetailMutation.isPending || updateDetailMutation.isPending) ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              isEditing ? '更新' : '保存'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body // レンダリング先の要素
  );
};
