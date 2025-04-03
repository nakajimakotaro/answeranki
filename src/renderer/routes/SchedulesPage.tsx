import { useState, useEffect, useRef } from 'react';
import {
  parseISO,
  differenceInDays,
  startOfToday,
  isBefore,
  isAfter,
  isValid,
  isEqual,
} from 'date-fns';
import { scheduleService, StudySchedule, TimelineEvent } from '../services/scheduleService'; // Textbook を削除
import { BookOpen } from 'lucide-react'; // Calendar, Plus, Edit, Trash, Clock を削除
import YearlyActivityCalendar from '../components/YearlyActivityCalendar';
import ScheduleProgressChart from '../components/ScheduleProgressChart';
import TextbookStackedProgress from '../components/TextbookStackedProgress';
import StudyGanttChart from '../components/StudyGanttChartComponent';

const SchedulesPage = () => {
  const ganttContainerRef = useRef<HTMLDivElement>(null); // ガントチャートコンテナの参照
  const [ganttContainerWidth, setGanttContainerWidth] = useState<number | undefined>(undefined); // コンテナ幅の状態
  const [ganttViewType, setGanttViewType] = useState<'daily' | 'yearly'>('daily');

  // 状態管理
  const [schedules, setSchedules] = useState<StudySchedule[]>([]);
  // const [textbooks, setTextbooks] = useState<Textbook[]>([]); // textbooks state を削除
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // isModalOpen, editingSchedule, フォーム状態, weekdayGoals, setEvenWeekdayGoals, calculateEndDate を削除

  // データ取得
  useEffect(() => {
    fetchData();
  }, []);

  // スケジュールとタイムラインイベントを取得
  const fetchData = async () => {
    try {
      setLoading(true);
      const events = await scheduleService.getTimelineEvents();

      // timelineEvents から type が 'schedule' のものだけをフィルタリングし、details を抽出
      const schedulesData = events
        .filter(event => event.type === 'schedule')
        .map(event => event.details as StudySchedule);

      setTimelineEvents(events);
      setSchedules(schedulesData);
      // setTextbooks(textbooksData); // textbooksData の取得と設定を削除
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('データの取得中にエラーが発生しました');
      setLoading(false);
    }
  };

  // openCreateModal, openEditModal, handleSaveSchedule, handleDeleteSchedule を削除

  // 日数を計算 (date-fns を使用)
  const calculateDays = (startDate: string, endDate: string): number => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (!isValid(start) || !isValid(end) || isBefore(end, start)) return 0;
    // differenceInDays は期間内の「満日数」を返すため、+1 して両端を含む日数にする
    return differenceInDays(end, start) + 1;
  };

  // 残り日数を計算 (date-fns を使用)
  const calculateRemainingDays = (endDate: string): number => {
    const today = startOfToday();
    const end = parseISO(endDate);
    if (!isValid(end) || isBefore(end, today)) return 0; // 終了日が過去または無効なら0日
    // differenceInDays は期間内の「満日数」を返すため、+1 して今日と終了日を含む残り日数にする
    return differenceInDays(end, today) + 1;
  };

  // 進捗状況を計算 (date-fns を使用)
  const calculateProgress = (startDate: string, endDate: string): number => {
    const today = startOfToday();
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    if (!isValid(start) || !isValid(end) || isBefore(end, start)) return 0; // 無効な期間

    if (isBefore(today, start)) return 0; // 開始前
    if (isAfter(today, end) || isEqual(today, end)) return 100; // 終了後または終了日当日

    const totalDays = calculateDays(startDate, endDate);
    // 開始日から今日までの日数を計算
    const elapsedDays = differenceInDays(today, start) + 1;

    return totalDays > 0 ? Math.round((elapsedDays / totalDays) * 100) : 0;
  };

  // getTextbookTitle を削除 (schedules に textbook_title が含まれるため)

  // コンテナ幅を監視する useEffect
  useEffect(() => {
    if (loading) {
      return; // loading 中は実行しない
    }

    const container = ganttContainerRef.current;
    if (!container) {
      return; // コンテナが見つからない場合は何もしない
    }

    let observer: ResizeObserver | null = null;

    // ResizeObserver のコールバック
    const handleResize = (entries: ResizeObserverEntry[]) => {
      for (let entry of entries) {
        const newWidth = Math.floor(entry.contentRect.width);
        // 幅が実際に変更され、0より大きい場合のみ更新
        setGanttContainerWidth(prevWidth => {
          if (prevWidth !== newWidth && newWidth > 0) {
            return newWidth;
          }
          return prevWidth;
        });
      }
    };

    // ResizeObserver のインスタンスを作成
    observer = new ResizeObserver(handleResize);
    observer.observe(container);

    // 初期幅を設定
    const initialWidth = Math.floor(container.clientWidth);
    if (initialWidth > 0) {
      setGanttContainerWidth(initialWidth);
    }

    // クリーンアップ
    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [loading]); // loading を依存配列に追加

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">スケジュール管理</h1>
        {/* 新規作成ボタンを削除 */}
      </div>

      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* ガントチャート */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">受験勉強スケジュール</h2>
          {/* ビュー切り替えボタン */}
          <div className="flex space-x-2">
            <button
              onClick={() => setGanttViewType('daily')}
              className={`px-3 py-1 rounded-md text-sm ${
                ganttViewType === 'daily'
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              日次 (近3週)
            </button>
            <button
              onClick={() => setGanttViewType('yearly')}
              className={`px-3 py-1 rounded-md text-sm ${
                ganttViewType === 'yearly'
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              月次 (25/4-26/3)
            </button>
          </div>
        </div>
        {/* ref を設定し、高さを指定 */}
        <div ref={ganttContainerRef} className="h-96 w-full">
          {/* ganttContainerWidth が有効な値の場合のみレンダリング */}
          {ganttContainerWidth && ganttContainerWidth > 0 ? (
            <StudyGanttChart
              events={timelineEvents}
              containerWidth={ganttContainerWidth}
              containerHeight={384} // h-96 = 24rem = 384px
              viewType={ganttViewType as 'daily' | 'yearly'}
              className="w-full"
            />
          ) : (
            <div className="flex justify-center items-center h-full text-gray-500">
              チャートを読み込み中...
            </div>
          )}
        </div>
      </div>

      {/* 参考書積み上げ進捗 */}
      <div className="mb-8">
        <TextbookStackedProgress />
      </div>

      {/* 年間アクティビティカレンダー */}
      <div className="mb-8">
        <YearlyActivityCalendar />
      </div>

      {/* 進捗状況チャート */}
      <div className="mb-8">
        <ScheduleProgressChart />
      </div>

      {/* スケジュール一覧 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">参考書</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">期間</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">1日の目標</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">バッファ</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">進捗</th>
              {/* 操作列ヘッダーを削除 */}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {schedules.length > 0 ? (
              schedules.map((schedule) => {
                const totalDays = calculateDays(schedule.start_date, schedule.end_date);
                const remainingDays = calculateRemainingDays(schedule.end_date);
                const progress = calculateProgress(schedule.start_date, schedule.end_date);

                return (
                  <tr key={schedule.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <BookOpen className="h-5 w-5 text-gray-400 mr-2" />
                        <div className="text-sm font-medium text-gray-900">
                          {schedule.textbook_title} {/* getTextbookTitle 呼び出しを削除 */}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {schedule.textbook_subject}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{schedule.start_date} 〜 {schedule.end_date}</div>
                      <div className="text-xs">
                        {totalDays}日間（残り{remainingDays > 0 ? remainingDays : 0}日）
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {schedule.daily_goal || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {schedule.buffer_days || 0}日
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-primary h-2.5 rounded-full"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500">{progress}%</span>
                    </td>
                    {/* 操作列セルを削除 */}
                  </tr>
                );
              })
            ) : (
              <tr>
                {/* colSpan を 5 に変更 */}
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  スケジュールが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* スケジュール編集モーダルを削除 */}
    </div>
  );
};

export default SchedulesPage;
