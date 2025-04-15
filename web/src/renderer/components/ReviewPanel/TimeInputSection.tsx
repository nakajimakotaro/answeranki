import { Clock } from 'lucide-react';
import { TimeInputSectionProps, TimerMode } from './types'; // TimerMode をインポート

const TimeInputSection = ({
  solvingTime,
  reviewTime,
  timerRunning,
  timerMode, // timerMode を受け取る
  onSolvingTimeChange,
  onReviewTimeChange,
}: TimeInputSectionProps) => {
  return (
    <div className="border-b py-3 mb-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="solving-time" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1 text-gray-500" />
            解答時間
          </label>
          <input
            id="solving-time"
            type="text"
            placeholder="0:00"
            value={solvingTime}
            onChange={(e) => onSolvingTimeChange(e.target.value)}
            pattern="[0-9]+:[0-5][0-9]" // Basic pattern, consider more robust validation
            title="形式: 分:秒 (例: 5:30)"
            // 解答モードがアクティブな場合、または解答モードでタイマー実行中にスタイルを適用
            className={`border rounded p-1.5 w-full text-center font-mono transition-colors duration-200 ${
              timerMode === 'solving' ? 'bg-green-50' : '' // アクティブモードの背景色
            } ${
              timerRunning && timerMode === 'solving' ? 'bg-gray-100 cursor-not-allowed' : '' // 実行中の無効化スタイル (優先)
            }`}
            disabled={timerRunning && timerMode === 'solving'}
          />
        </div>

        <div>
          <label htmlFor="review-time" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1 text-gray-500" />
            復習時間
          </label>
          <input
            id="review-time"
            type="text"
            placeholder="0:00"
            value={reviewTime}
            onChange={(e) => onReviewTimeChange(e.target.value)}
            pattern="[0-9]+:[0-5][0-9]" // Basic pattern
            title="形式: 分:秒 (例: 2:15)"
            // 復習モードがアクティブな場合、または復習モードでタイマー実行中にスタイルを適用
            className={`border rounded p-1.5 w-full text-center font-mono transition-colors duration-200 ${
              timerMode === 'review' ? 'bg-blue-50' : '' // アクティブモードの背景色
            } ${
              timerRunning && timerMode === 'review' ? 'bg-gray-100 cursor-not-allowed' : '' // 実行中の無効化スタイル (優先)
            }`}
            disabled={timerRunning && timerMode === 'review'}
          />
        </div>
      </div>
    </div>
  );
};

export default TimeInputSection;
