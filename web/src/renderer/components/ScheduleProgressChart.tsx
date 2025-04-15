import { useState, useEffect, useMemo } from 'react';
import { trpc } from '../lib/trpc.js';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../../../server/src/router';
import { BarChart2, BookOpen, AlertTriangle, Loader2 } from 'lucide-react';

type RouterOutput = inferRouterOutputs<AppRouter>;
type TextbookOutput = RouterOutput['textbook']['getTextbooks'][number];
type ScheduleOutput = RouterOutput['schedule']['listSchedules'][number];

interface ProcessedProgressDataWithoutSchedule {
  hasSchedule: false;
  textbook: TextbookOutput;
}

interface ProcessedProgressDataWithSchedule {
  hasSchedule: true;
  textbook: TextbookOutput;
  schedule: ScheduleOutput;
  progress: {
    totalDays: number;
    daysElapsed: number;
    percentComplete: number;
    isOnTrack: boolean;
  };
}

type ProcessedProgressData = ProcessedProgressDataWithoutSchedule | ProcessedProgressDataWithSchedule;

interface ScheduleProgressChartProps {
  initialTextbookId?: string;
}

const ScheduleProgressChart = ({ initialTextbookId }: ScheduleProgressChartProps) => {
  const [selectedTextbookId, setSelectedTextbookId] = useState<string | undefined>(initialTextbookId);

  const { data: textbooksData, isLoading: isLoadingTextbooks, error: errorTextbooks } = trpc.textbook.getTextbooks.useQuery(
      undefined,
      {
          staleTime: 5 * 60 * 1000,
      }
  );

  useEffect(() => {
      if (textbooksData && textbooksData.length > 0) {
          const currentSelectionValid = selectedTextbookId !== undefined && textbooksData.some((t: TextbookOutput) => t.id === selectedTextbookId);

          if (initialTextbookId !== undefined && selectedTextbookId !== initialTextbookId) {
              setSelectedTextbookId(initialTextbookId);
          } else if (selectedTextbookId === undefined) {
              setSelectedTextbookId(initialTextbookId ?? textbooksData[0].id);
          } else if (!currentSelectionValid) {
              setSelectedTextbookId(textbooksData[0].id);
          }
      } else if (textbooksData && textbooksData.length === 0) {
          setSelectedTextbookId(undefined);
      }
  }, [textbooksData, selectedTextbookId, initialTextbookId]);

  const { data: schedulesData, isLoading: isLoadingSchedules, error: errorSchedules } = trpc.schedule.listSchedules.useQuery(
      undefined,
      {
          staleTime: 5 * 60 * 1000,
      }
  );

  const progressData: ProcessedProgressData | null = useMemo(() => {
      if (!selectedTextbookId || !textbooksData) return null;
      
      const currentTextbook = textbooksData.find((t: TextbookOutput) => t.id === selectedTextbookId);
      if (!currentTextbook) return null;
      
      // スケジュールデータが存在するか確認
      if (!schedulesData) return { hasSchedule: false, textbook: currentTextbook };
      
      // 選択された教科書のスケジュールを検索
      const textbookSchedule = schedulesData.find((s: ScheduleOutput) => s.textbook_id === selectedTextbookId);
      if (!textbookSchedule) return { hasSchedule: false, textbook: currentTextbook };
      
      // 進捗状況を計算
      const startDate = new Date(textbookSchedule.start_date);
      const endDate = new Date(textbookSchedule.end_date);
      const today = new Date();
      
      // 総日数
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // 経過日数（今日が開始日より前の場合は0）
      const daysElapsed = Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      // 完了率
      const percentComplete = Math.min(100, Math.round((daysElapsed / totalDays) * 100));
      
      // スケジュール通りかどうか（仮の実装、実際には学習ログなどから計算する必要がある）
      const isOnTrack = true;
      
      return {
          hasSchedule: true,
          textbook: currentTextbook,
          schedule: textbookSchedule,
          progress: {
              totalDays,
              daysElapsed,
              percentComplete,
              isOnTrack
          }
      };
  }, [selectedTextbookId, textbooksData, schedulesData]);

  const isLoading = isLoadingTextbooks || isLoadingSchedules;
  const queryError = errorTextbooks || errorSchedules;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (queryError) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>データの読み込み中にエラーが発生しました: {queryError.message}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold flex items-center">
          <BarChart2 className="mr-2" />
          スケジュール進捗状況
        </h2>

        <div className="w-64">
          <select
            className="w-full p-2 border border-gray-300 rounded-md"
            value={selectedTextbookId || ''}
            onChange={(e) => setSelectedTextbookId(e.target.value ? e.target.value : undefined)}
            disabled={!textbooksData || textbooksData.length === 0}
          >
            <option value="">参考書を選択</option>
            {textbooksData?.map((textbook: TextbookOutput) => (
              <option key={textbook.id} value={textbook.id}>
                {textbook.title} ({textbook.subject})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedTextbookId || !progressData ? (
         <div className="text-center py-8 text-gray-500">
           <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
           <p>{!textbooksData || textbooksData.length === 0 ? '利用可能な参考書がありません。' : '表示する参考書を選択してください。'}</p>
         </div>
      ) : !progressData.hasSchedule ? (
        <div className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-lg text-gray-600">
            「{progressData.textbook.title}」のスケジュールが設定されていません
          </p>
          <p className="text-sm text-gray-500 mt-2">
            スケジュールを設定すると進捗状況を確認できます
          </p>
        </div>
      ) : (
        <div className="py-4">
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">進捗状況</span>
              <span className="text-sm font-medium">{progressData.progress.percentComplete}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full ${progressData.progress.isOnTrack ? 'bg-green-600' : 'bg-yellow-500'}`} 
                style={{ width: `${progressData.progress.percentComplete}%` }}
              ></div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">開始日</p>
              <p className="text-sm font-medium">{new Date(progressData.schedule.start_date).toLocaleDateString('ja-JP')}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">終了日</p>
              <p className="text-sm font-medium">{new Date(progressData.schedule.end_date).toLocaleDateString('ja-JP')}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">経過日数</p>
              <p className="text-sm font-medium">{progressData.progress.daysElapsed} / {progressData.progress.totalDays}日</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">1日の目標</p>
              <p className="text-sm font-medium">{progressData.schedule.daily_goal || '未設定'}</p>
            </div>
          </div>
          
          <div className="text-xs text-gray-500 mt-2">
            {progressData.progress.isOnTrack 
              ? '現在のペースでスケジュール通りに進んでいます。' 
              : '予定より遅れています。ペースを上げましょう。'}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleProgressChart;
