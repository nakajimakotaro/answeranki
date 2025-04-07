import { useState, useEffect, useMemo } from 'react';
import { parseISO } from 'date-fns';
import { trpc } from '../lib/trpc.js';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../../../server/src/router';
import type { StudySchedule } from '@shared/schemas/schedule';
import { BarChart2, BookOpen, AlertTriangle, Loader2 } from 'lucide-react';

type RouterOutput = inferRouterOutputs<AppRouter>;
type TextbookOutput = RouterOutput['textbook']['getTextbooks'][number];

interface ProcessedProgressDataPlaceholder {
  hasSchedule: false;
  textbook: TextbookOutput;
}

interface ScheduleProgressChartProps {
  initialTextbookId?: number;
}

const ScheduleProgressChart = ({ initialTextbookId }: ScheduleProgressChartProps) => {
  const [selectedTextbookId, setSelectedTextbookId] = useState<number | undefined>(initialTextbookId);

  const { data: textbooksData, isLoading: isLoadingTextbooks, error: errorTextbooks } = trpc.textbook.getTextbooks.useQuery(
      undefined,
      {
          staleTime: 5 * 60 * 1000,
      }
  );

  useEffect(() => {
      if (textbooksData && textbooksData.length > 0) {
          const currentSelectionValid = selectedTextbookId !== undefined && textbooksData.some(t => t.id === selectedTextbookId);

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

  const progressData: ProcessedProgressDataPlaceholder | null = useMemo(() => {
      if (!selectedTextbookId || !textbooksData) return null;
       const currentTextbook = textbooksData?.find(t => t.id === selectedTextbookId);
       if (!currentTextbook) return null;
       return { hasSchedule: false, textbook: currentTextbook };
  }, [selectedTextbookId, textbooksData]);

  const isLoading = isLoadingTextbooks;
  const queryError = errorTextbooks;

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
            onChange={(e) => setSelectedTextbookId(e.target.value ? Number(e.target.value) : undefined)}
            disabled={!textbooksData || textbooksData.length === 0}
          >
            <option value="">参考書を選択</option>
            {textbooksData?.map((textbook) => (
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
      ) : (
        <div className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-lg text-gray-600">
            「{progressData.textbook.title}」のスケジュールが設定されていません
          </p>
          <p className="text-sm text-gray-500 mt-2">
            スケジュールを設定すると進捗状況を確認できます
          </p>
        </div>
      )}
    </div>
  );
};

export default ScheduleProgressChart;
