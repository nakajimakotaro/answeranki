import React, { useState } from 'react';
import { Link } from 'react-router-dom'; // Link をインポート
import { trpc } from '../lib/trpc';
import { CalculationMistakeDialog } from '../components/CalculationMistakeDialog'; // ダイアログをインポート
import type { CalculationMistakeDetail } from 'shared/schemas/calculationMistake'; // 型をインポート

export const CalculationMistakesPage: React.FC = () => {
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false); // ダイアログ表示状態
  const [editingMistake, setEditingMistake] = useState<CalculationMistakeDetail | null>(null); // 編集中のミス

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

  const openNewDialog = () => {
    setEditingMistake(null); // 新規登録時は編集データをクリア
    setIsDialogOpen(true);
  };
  const openEditDialog = (mistake: CalculationMistakeDetail) => {
    setEditingMistake(mistake);
    setIsDialogOpen(true);
  };
  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingMistake(null); // ダイアログを閉じたら編集データもクリア
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">計算ミス一覧</h1>
        <button className="btn btn-primary" onClick={openNewDialog}>計算ミスを登録</button>
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
                  <th>問題へ</th> {/* 列ヘッダーを追加 */}
                  <th>操作</th> {/* 操作列ヘッダーを追加 */}
                </tr>
              </thead>
              <tbody>
                {details.map((detail) => (
                  <tr key={detail.id}>
                    <td>{detail.description}</td>
                    <td>{new Date(detail.createdAt).toLocaleString()}</td>
                    <td> {/* 問題へのリンク列 */}
                      {detail.problemNoteId ? (
                        <Link to={`/problem/${detail.problemNoteId}`} className="btn btn-sm btn-outline whitespace-nowrap">
                          詳細
                        </Link>
                      ) : (
                        '-' // リンクがない場合はハイフン表示
                      )}
                    </td>
                    <td> {/* 操作列 */}
                      <button
                        className="btn btn-sm btn-outline btn-info whitespace-nowrap"
                        onClick={() => openEditDialog(detail)}
                      >
                        編集
                      </button>
                    </td>
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

      {/* 登録/編集ダイアログ */}
      <CalculationMistakeDialog
        isOpen={isDialogOpen}
        onClose={closeDialog}
        initialData={editingMistake ?? undefined} // 編集データを渡す
      />
    </div>
  );
};
