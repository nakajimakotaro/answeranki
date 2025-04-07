import { useState, useEffect } from 'react';
// Import StudyLog type from shared schema definitions
import type { StudyLog } from '@shared/schemas/schedule'; // Assuming StudyLog is here, adjust if needed
import { trpc } from '../lib/trpc.js'; // Import tRPC client
import type { inferRouterOutputs } from '@trpc/server'; // Import helper type
// Adjust the path to your AppRouter definition if necessary
import type { AppRouter } from '../../../../server/src/router';

// Infer the output type for the getTextbooks procedure
type RouterOutput = inferRouterOutputs<AppRouter>;
// Correct path based on the router definition
type TextbookOutput = RouterOutput['textbook']['getTextbooks'][number];


// コンポーネントのプロパティ型定義
export interface DailyLogInputProps {
  textbooks: TextbookOutput[]; // Use inferred Textbook type
  date: string;
  onLogUpdated: () => void;
  existingLogs: StudyLog[]; // Ensure this StudyLog type matches the import
}

const DailyLogInput: React.FC<DailyLogInputProps> = ({
  textbooks,
  date,
  onLogUpdated,
  existingLogs = []
}) => {
  // 状態管理
  const [selectedTextbook, setSelectedTextbook] = useState<TextbookOutput | null>(null); // Use inferred type
  const [actualAmount, setActualAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [existingLog, setExistingLog] = useState<StudyLog | null>(null);

  // Helper to reset form state
  const resetForm = () => {
      setSelectedTextbook(null);
      setActualAmount(0);
      setNotes('');
      setExistingLog(null);
      setError(null); // Clear error on reset
      // Keep success message briefly? Or clear immediately? Clearing for now.
      // setSuccess(null);
  };

  // tRPC Mutations
  const utils = trpc.useUtils(); // For potential cache invalidation

  const createLogMutation = trpc.schedule.createLog.useMutation({
    onSuccess: () => {
      setSuccess('学習ログを保存しました');
      onLogUpdated(); // Notify parent
      utils.schedule.listLogs.invalidate(); // Invalidate log list query cache
      resetForm();
      setTimeout(() => setSuccess(null), 3000); // Clear success message after 3s
    },
    onError: (err) => {
      console.error('Error creating study log:', err);
      setError(`学習ログの保存中にエラーが発生しました: ${err.message}`);
      setSuccess(null); // Clear success message on error
    },
  });

  const updateLogMutation = trpc.schedule.updateLog.useMutation({
    onSuccess: () => {
      setSuccess('学習ログを更新しました');
      onLogUpdated(); // Notify parent
      utils.schedule.listLogs.invalidate(); // Invalidate log list query cache
      // Decide if form should reset after update, maybe just clear success/error
      // resetForm();
      setTimeout(() => setSuccess(null), 3000); // Clear success message after 3s
    },
    onError: (err) => {
      console.error('Error updating study log:', err);
      setError(`学習ログの更新中にエラーが発生しました: ${err.message}`);
      setSuccess(null); // Clear success message on error
    },
  });


  // 参考書が選択されたときの処理
  useEffect(() => {
    setError(null); // Clear errors when selection changes
    setSuccess(null); // Clear success when selection changes
    if (selectedTextbook && selectedTextbook.id) {
      // 既存のログを検索
      const log = existingLogs.find(l => l.textbook_id === selectedTextbook.id);

      if (log) {
        setExistingLog(log);
        setActualAmount(log.actual_amount);
        setNotes(log.notes || '');
      } else {
        setExistingLog(null);
        // Don't reset amount/notes if just switching between textbooks without logs
        // setActualAmount(0);
        // setNotes('');
      }
    } else {
        // Clear form only if selection is cleared, not just changed
         setExistingLog(null);
         // setActualAmount(0); // Keep values if user deselects temporarily?
         // setNotes('');
    }
  }, [selectedTextbook, existingLogs]);

  // 学習ログを保存/更新する
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTextbook || !selectedTextbook.id) {
      setError('参考書を選択してください');
      return;
    }

    // Clear previous errors/success messages before attempting mutation
    setError(null);
    setSuccess(null);

    // Input data structure should match the Zod schema defined in the tRPC router
    // Assuming createLog input: { date: string, textbook_id: number, actual_amount: number, notes?: string }
    // Assuming updateLog input: { id: number, date: string, textbook_id: number, actual_amount: number, notes?: string }
    const logInputData = {
        date,
        textbook_id: selectedTextbook.id,
        actual_amount: actualAmount,
        notes: notes || undefined, // Send undefined if notes are empty
        // planned_amount is likely calculated or not needed for log creation/update
    };

    try {
      if (existingLog && existingLog.id) {
        // 既存のログを更新
        // Pass the full object expected by the mutation input schema
        await updateLogMutation.mutateAsync({
            id: existingLog.id,
            ...logInputData
            // Ensure all required fields by the Zod schema are included
        });
        // Success/reset handled by onSuccess callback
      } else {
        // 新しいログを作成
        await createLogMutation.mutateAsync(logInputData);
         // Success/reset handled by onSuccess callback
      }
    } catch (err) {
      // Error is handled by the onError callback in useMutation hooks
      // This catch block might not be strictly necessary unless mutateAsync throws differently
      console.error("Mutation initiation failed:", err);
       if (!error) { // Set a generic error if onError didn't set one
           setError('ログの保存/更新リクエストに失敗しました。');
       }
    }
  };

  // Determine loading state from either mutation (use isPending for TanStack Query v5+)
  const isPending = createLogMutation.isPending || updateLogMutation.isPending;

  return (
    <div>
      {/* Display mutation errors */}
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Display mutation success */}
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
              disabled={isPending} // Use mutation pending state
            >
              <option value="">参考書を選択してください</option>
              {/* Ensure textbook object matches the expected Textbook type */}
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
              value={date}
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
              disabled={isPending} // Use mutation pending state
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
            disabled={isPending} // Use mutation pending state
          />
        </div>

        {/* 送信ボタン */}
        <div className="flex justify-end">
          <button
            type="submit"
            className={`px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isPending} // Use mutation pending state
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
