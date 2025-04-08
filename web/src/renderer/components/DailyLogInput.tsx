import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { StudyLog } from '@shared/schemas/schedule';
import { trpc } from '../lib/trpc.js';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../../../server/src/router';

type RouterOutput = inferRouterOutputs<AppRouter>;
type TextbookOutput = RouterOutput['textbook']['getTextbooks'][number];


export interface DailyLogInputProps {
  textbooks: TextbookOutput[];
  date: Date;
  onLogUpdated: () => void;
  existingLogs: StudyLog[];
}

const DailyLogInput: React.FC<DailyLogInputProps> = ({
  textbooks,
  date,
  onLogUpdated,
  existingLogs = []
}) => {
  // 状態管理
  const [selectedTextbook, setSelectedTextbook] = useState<TextbookOutput | null>(null);
  const [actualAmount, setActualAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [existingLog, setExistingLog] = useState<StudyLog | null>(null);

  // Helper to reset form state
  const resetForm = () => {
      setSelectedTextbook(null);
      setActualAmount(0);
      setNotes('');
      setExistingLog(null);
      setValidationError(null);
  };

  const utils = trpc.useUtils();

  const createLogMutation = trpc.schedule.createLog.useMutation({
    onSuccess: () => {
      setSuccess('学習ログを保存しました');
      onLogUpdated(); // 親コンポーネントに更新を通知
      utils.schedule.listLogs.invalidate(); // キャッシュを無効化
      resetForm();
      setTimeout(() => setSuccess(null), 3000); // 3秒後に成功メッセージをクリア
    },
  });

  const updateLogMutation = trpc.schedule.updateLog.useMutation({
    onSuccess: () => {
      setSuccess('学習ログを更新しました');
      onLogUpdated(); // 親コンポーネントに更新を通知
      utils.schedule.listLogs.invalidate(); // キャッシュを無効化
      setTimeout(() => setSuccess(null), 3000); // 3秒後に成功メッセージをクリア
    },
  });


  // 参考書が選択されたときの処理
  useEffect(() => {
    setValidationError(null);
    setSuccess(null);
    if (selectedTextbook && selectedTextbook.id) {
      const log = existingLogs.find(l => l.textbook_id === selectedTextbook.id);

      if (log) {
        setExistingLog(log);
        setActualAmount(log.actual_amount);
        setNotes(log.notes || '');
      } else {
        setExistingLog(null);
      }
    } else {
         setExistingLog(null);
    }
  }, [selectedTextbook, existingLogs]);

  // 学習ログを保存/更新する
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTextbook || !selectedTextbook.id) {
      setValidationError('参考書を選択してください');
      return;
    }

    setValidationError(null);
    setSuccess(null);

    const logInputData = {
        date,
        textbook_id: selectedTextbook.id,
        actual_amount: actualAmount,
        notes: notes || undefined,
    };

    if (existingLog && existingLog.id) {
      // 既存のログを更新
        await updateLogMutation.mutateAsync({
            id: existingLog.id,
            ...logInputData
        });
      } else {
        await createLogMutation.mutateAsync(logInputData);
    }
  };

  const isPending = createLogMutation.isPending || updateLogMutation.isPending;

  return (
    <div>
      {validationError && (
        <div className="mb-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          {validationError}
        </div>
      )}

      {/* 保存・更新成功メッセージ */}
      {success && (
        <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* 参考書選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              参考書
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              value={selectedTextbook?.id || ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                const selected = textbooks.find(t => t.id === id) || null;
                setSelectedTextbook(selected);
              }}
              disabled={isPending}
            >
              <option value="">参考書を選択してください</option>
              {textbooks.map((textbook) => (
                <option key={textbook.id} value={textbook.id}>
                  {textbook.title} ({textbook.subject})
                </option>
              ))}
            </select>
          </div>

          {/* 日付表示 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              日付
            </label>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded-md bg-gray-100"
              value={format(date, 'yyyy-MM-dd')}
              disabled
            />
          </div>
        </div>

        <div className="mb-4">
          {/* 実際の問題数 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              解いた問題数
            </label>
            <input
              type="number"
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              value={actualAmount}
              onChange={(e) => setActualAmount(Number(e.target.value))}
              min={0}
              disabled={isPending}
            />
          </div>
        </div>

        {/* メモ */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            メモ
          </label>
          <textarea
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            disabled={isPending}
          />
        </div>

        {/* 送信ボタン */}
        <div className="flex justify-end">
          <button
            type="submit"
            className={`px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isPending}
          >
            {isPending ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {existingLog ? '更新中...' : '保存中...'}
              </span>
            ) : existingLog ? '更新' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DailyLogInput;
