import React, { useState } from 'react';
import { trpc } from '../lib/trpc';
import { CalculationMistakeDialog } from '../components/CalculationMistakeDialog'; // ダイアログをインポート

export const CalculationMistakesPage: React.FC = () => {
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false); // ダイアログ表示状態

  // 種類一覧を取得
  const { data: types, isLoading: isLoadingTypes, error: errorTypes } = trpc.calculationMistake.listTypes.useQuery();

  // 詳細一覧を取得 (選択された種類IDが変わったら再取得)
  const { data: details, isLoading: isLoadingDetails, error: errorDetails } = trpc.calculationMistake.listDetails.useQuery(
    { typeId: selectedTypeId ?? undefined } // null の場合は undefined を渡す (全件取得)
    // enabled オプションを削除し、常にクエリを実行
  );

  const handleTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTypeId(event.target.value || null); // 未選択の場合は null
  };

  const openDialog = () => setIsDialogOpen(true);
  const closeDialog = () => setIsDialogOpen(false);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">計算ミス一覧</h1>
        <button className="btn btn-primary" onClick={openDialog}>計算ミスを登録</button>
      </div>

      {/* 種類選択 */}
      <div className="mb-4">
        <label htmlFor="type-select" className="block text-sm font-medium text-gray-700 mb-1">
          ミスの種類で絞り込む:
        </label>
        <select
          id="type-select"
          className="select select-bordered w-full max-w-xs"
          value={selectedTypeId ?? ''}
          onChange={handleTypeChange}
          disabled={isLoadingTypes}
        >
          <option value="">すべての種類</option>
          {types?.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        {isLoadingTypes && <span className="loading loading-spinner loading-sm ml-2"></span>}
        {errorTypes && <p className="text-red-500 text-sm mt-1">種類の読み込みに失敗しました: {errorTypes.message}</p>}
      </div>

      {/* 詳細一覧 */}
      {/* selectedTypeId の条件を削除し、常に表示を試みる */}
      <div className="overflow-x-auto">
        {isLoadingDetails && <p>詳細を読み込み中...</p>}
        {errorDetails && <p className="text-red-500">詳細の読み込みに失敗しました: {errorDetails.message}</p>}
          {details && details.length > 0 && (
            <table className="table w-full">
              <thead>
                <tr>
                  <th>詳細</th>
                  <th>登録日時</th>
                  {/* TODO: 必要に応じて他の列を追加 */}
                </tr>
              </thead>
              <tbody>
                {details.map((detail) => (
                  <tr key={detail.id}>
                    <td>{detail.description}</td>
                    <td>{new Date(detail.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {details && details.length === 0 && !isLoadingDetails && (
            <p>{selectedTypeId ? '選択された種類の計算ミスはありません。' : '登録されている計算ミスはありません。'}</p>
          )}
      </div>
      {/* {!selectedTypeId && <p>ミスの種類を選択してください。</p>} を削除 */}

      {/* 登録ダイアログ */}
      <CalculationMistakeDialog isOpen={isDialogOpen} onClose={closeDialog} />
    </div>
  );
};
