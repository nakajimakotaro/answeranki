import { Clock, Play, Pause, RotateCcw, ArrowRightLeft } from 'lucide-react'; // ArrowRightLeft を追加
import { TimerMode, TimerSectionProps } from './types';

const TimerSection = ({
  timerMode, // 追加
  elapsedTime, // 解答時間 (ms)
  reviewElapsedTime, // 追加: 復習時間 (ms)
  timerRunning,
  onStartTimer,
  onPauseTimer,
  onResetTimer,
  onToggleMode, // 追加
  formatTime,
}: TimerSectionProps) => {
  return (
    // 背景色、cursor-pointer, onClick を削除
    <div className="p-4 border-b flex-shrink-0">
      {/* items-start から items-end に変更してボタンを下に揃える */}
      <div className="flex justify-between items-end">
        {/* タイトルと時間表示を縦に並べるためのコンテナ */}
        <div className="flex flex-col">
          <h4 className="font-medium text-sm text-gray-700 flex items-center mb-0.5">
            <Clock className="w-4 h-4 mr-1" />
            {timerMode === 'solving' ? '解答タイマー' : '復習タイマー'}
          </h4>
          <span className={`text-lg font-mono leading-tight ${timerMode === 'solving' ? 'text-green-700' : 'text-blue-700'}`}> {/* leading-tight を追加 */}
            {formatTime(timerMode === 'solving' ? elapsedTime : reviewElapsedTime)}
          </span>
        </div>
        {/* ボタン群 */}
        <div className="flex space-x-1 flex-shrink-0"> {/* flex-shrink-0 を追加 */}
          <button
            onClick={onStartTimer}
            disabled={timerRunning}
            className={`p-1.5 rounded ${
              timerRunning
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                // timerMode に応じてボタンの色を変更
                : timerMode === 'solving'
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
            aria-label={timerMode === 'solving' ? '解答開始' : '復習開始'}
          >
            <Play className="w-4 h-4" />
          </button>
          <button
            onClick={onPauseTimer}
            disabled={!timerRunning}
            className={`p-1.5 rounded ${
              !timerRunning
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
            }`}
             aria-label="タイマー一時停止"
          >
            <Pause className="w-4 h-4" />
          </button>
          <button
            onClick={onResetTimer}
            className="p-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200"
             aria-label="タイマーリセット"
          >
            {/* Reset ボタンのラベルも変更 */}
            <RotateCcw className="w-4 h-4" />
          </button>
          {/* モード切替ボタンを追加 */}
          <button
            onClick={onToggleMode}
            className="p-1.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
            aria-label="解答/復習モード切替"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* モード切替の説明を削除 */}
      {/* <p className="text-xs text-gray-500 mt-1 text-right"> ... </p> */}
    </div>
  );
};

export default TimerSection;
