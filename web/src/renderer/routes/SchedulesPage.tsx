import { useState, useRef, useMemo, useEffect } from 'react';
import {
  parseISO,
  differenceInDays,
  startOfToday,
  isBefore,
  isAfter,
  isValid,
  isEqual,
  startOfDay,
  format,
} from 'date-fns';
import { trpc } from '../lib/trpc';
import type { StudySchedule } from '@shared/schemas/schedule';
import type { TimelineEvent as SharedTimelineEvent } from '@shared/types/timeline';
import { BookOpen } from 'lucide-react';
import YearlyActivityCalendar from '../components/YearlyActivityCalendar';
import ScheduleProgressChart from '../components/ScheduleProgressChart';
import TextbookStackedProgress from '../components/TextbookStackedProgress';
import StudyGanttChart from '../components/StudyGanttChartComponent';

// tRPC の TimelineEvent 型 (Date オブジェクトを含む)
interface TimelineEventWithDate extends Omit<SharedTimelineEvent, 'startDate' | 'endDate' | 'details'> {
  startDate: Date;
  endDate?: Date;
  details: StudySchedule | any;
}


const SchedulesPage = () => {
  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const [ganttContainerWidth, setGanttContainerWidth] = useState<number | undefined>(undefined);
  const [ganttViewType, setGanttViewType] = useState<'daily' | 'yearly'>('daily');

  // データ取得 (tRPC hook)
  const { data: rawEvents, isLoading, error: queryError } = trpc.schedule.getTimelineEvents.useQuery();

  // 取得したデータを Date オブジェクトに変換
  const timelineEvents = useMemo((): TimelineEventWithDate[] => {
    if (!rawEvents) return [];
    return rawEvents.map((event) => {
      const startDate = new Date(event.startDate);
      const endDate = event.endDate ? new Date(event.endDate) : undefined;

      return {
        ...event,
        startDate,
        endDate,
        details: event.details,
      };
    });
  }, [rawEvents]);

  // timelineEvents からスケジュールデータのみを抽出
  const schedulesData = useMemo((): StudySchedule[] => {
    return timelineEvents
      .filter(event => event.type === 'schedule')
      .map(event => event.details as StudySchedule);
  }, [timelineEvents]);


  // 日数を計算
  const calculateDays = (startDate: Date, endDate: Date): number => {
    if (isBefore(endDate, startDate)) return 0;
    return differenceInDays(endDate, startDate) + 1;
  };

  // 残り日数を計算 
  const calculateRemainingDays = (endDate: Date): number => {
    const today = startOfToday();
    if (isBefore(endDate, today)) return 0;
    return differenceInDays(endDate, today) + 1;
  };

  // 進捗状況を計算
  const calculateProgress = (startDate: Date, endDate: Date): number => {
    const today = startOfToday();
    if (isBefore(today, startDate)) return 0;
    if (isAfter(today, endDate) || isEqual(today, endDate)) return 100;

    const totalDays = calculateDays(startDate, endDate);
    if (totalDays <= 0) return 0;

    // 開始日から今日までの日数を計算
    // elapsedDays の計算は startOfDay を使う必要はない（today は既に startOfToday() されている）
    const elapsedDays = differenceInDays(today, startDate) + 1;

    return Math.round((elapsedDays / totalDays) * 100);
  };


  // コンテナ幅を監視する
  useEffect(() => {
    const container = ganttContainerRef.current;
    if (!container) return;

    let observer: ResizeObserver | null = null;
    const handleResize = (entries: ResizeObserverEntry[]) => {
      for (let entry of entries) {
        const newWidth = Math.floor(entry.contentRect.width);
        setGanttContainerWidth(prevWidth => {
          if (prevWidth !== newWidth && newWidth > 0) {
            return newWidth;
          }
          return prevWidth;
        });
      }
    };
    observer = new ResizeObserver(handleResize);
    observer.observe(container);
    const initialWidth = Math.floor(container.clientWidth);
    if (initialWidth > 0) {
      setGanttContainerWidth(initialWidth);
    }
    return () => {
      if (observer) observer.disconnect();
    };
  }, []);


  if (isLoading) {
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
      </div>

      {queryError && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          エラー: {queryError.message}
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
              events={timelineEvents} // Pass the fetched and processed events
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
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {schedulesData.length > 0 ? (
              schedulesData.map((schedule) => {
                const startDateObj = schedule.start_date;
                const endDateObj = schedule.end_date;

                const totalDays = calculateDays(startDateObj, endDateObj);
                const remainingDays = calculateRemainingDays(endDateObj);
                const progress = calculateProgress(startDateObj, endDateObj);

                return (
                  <tr key={schedule.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <BookOpen className="h-5 w-5 text-gray-400 mr-2" />
                        <div className="text-sm font-medium text-gray-900">
                          {schedule.textbook_title}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {schedule.textbook_subject}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {/* Format Date objects before rendering */}
                      <div>{format(startDateObj, 'yyyy/MM/dd')} 〜 {format(endDateObj, 'yyyy/MM/dd')}</div>
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
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  スケジュールが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SchedulesPage;
