import { useState, useEffect } from 'react';
import { Textbook, StudyLog, scheduleService } from '../services/scheduleService';

// コンポーネントのプロパティ型定義
export interface DailyLogInputProps {
  textbooks: Textbook[];
  date: string;
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
  const [selectedTextbook, setSelectedTextbook] = useState<Textbook | null>(null);
  const [actualAmount, setActualAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [existingLog, setExistingLog] = useState<StudyLog | null>(null);

  // 参考書が選択されたときの処理
  useEffect(() => {
    if (selectedTextbook && selectedTextbook.id) {
      // 既存のログを検索
      const log = existingLogs.find(l => l.textbook_id === selectedTextbook.id);
      
      if (log) {
        setExistingLog(log);
        setActualAmount(log.actual_amount);
        setNotes(log.notes || '');
      } else {
        setExistingLog(null);
        setActualAmount(0);
        setNotes('');
      }
    }
  }, [selectedTextbook, existingLogs]);

  // 学習ログを保存する
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTextbook || !selectedTextbook.id) {
      setError('参考書を選択してください');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const logData: Omit<StudyLog, 'id'> = {
        date,
        textbook_id: selectedTextbook.id,
        planned_amount: 0, // 予定問題数は常に0に設定
        actual_amount: actualAmount,
        notes: notes || undefined
      };
      
      if (existingLog && existingLog.id) {
        // 既存のログを更新
        await scheduleService.updateLog(existingLog.id, logData);
        setSuccess('学習ログを更新しました');
      } else {
        // 新しいログを作成
        await scheduleService.createLog(logData);
        setSuccess('学習ログを保存しました');
      }
      
      // 親コンポーネントに通知
      onLogUpdated();
      
      // フォームをリセット
      setSelectedTextbook(null);
      setActualAmount(0);
      setNotes('');
      
    } catch (err) {
      console.error('Error saving study log:', err);
      setError('学習ログの保存中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
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
              disabled={loading}
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
              disabled={loading}
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
            disabled={loading}
          />
        </div>
        
        {/* 送信ボタン */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                保存中...
              </span>
            ) : existingLog ? '更新' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DailyLogInput;
