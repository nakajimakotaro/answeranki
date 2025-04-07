import { useState, useEffect, useMemo } from 'react';
import { parseISO, differenceInDays, startOfToday, isValid, format } from 'date-fns';
import { trpc } from '../lib/trpc.js'; // Import tRPC client
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../../../server/src/router'; // Adjust path if needed
import type { Exam } from '@shared/types/exam'; // Import shared Exam type
import type { StudySchedule, StudyLog } from '@shared/schemas/schedule'; // Import types from shared schema
import { BarChart2, Calendar, BookOpen, AlertTriangle, CheckCircle, Clock, Loader2 } from 'lucide-react';

// Infer tRPC types
type RouterOutput = inferRouterOutputs<AppRouter>;
type TextbookOutput = RouterOutput['textbook']['getTextbooks'][number];
// Assuming getTimelineEvents returns objects matching this structure after potential date transformation
// If the server returns date strings, parsing needs to happen client-side.
// Let's assume the hook's data is already parsed or we parse it in useMemo.
type TimelineEventOutput = RouterOutput['schedule']['getTimelineEvents'][number];
// Assuming a getProgress procedure exists - Commented out until implemented
// IMPORTANT: Adjust 'schedule.getProgress' if the actual procedure path is different
// type ProgressOutput = RouterOutput['schedule']['getProgress'];

// Define the structure for processed progress data set in state
interface ProcessedProgressData {
  hasSchedule: true;
  textbook: TextbookOutput; // Use inferred type
  schedule: StudySchedule; // Use imported type
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  idealProgress: number; // Calculated ideal solved problems
  actualProgress: number; // Actual solved problems from service
  progressDifference: number;
  progressStatus: string;
  dailyTarget: number;
  dailyData: { date: string; actual: number; planned: number }[];
  cumulativeData: { date: string; actual: number; ideal: number }[];
  totalProblems: number; // Total problems from textbook
}

interface ScheduleProgressChartProps {
  initialTextbookId?: number; // Allow initial textbook selection via prop
}

const ScheduleProgressChart = ({ initialTextbookId }: ScheduleProgressChartProps) => {
  const [selectedTextbookId, setSelectedTextbookId] = useState<number | undefined>(initialTextbookId);

  // --- tRPC Queries ---
  const { data: textbooksData, isLoading: isLoadingTextbooks, error: errorTextbooks } = trpc.textbook.getTextbooks.useQuery(
      undefined, // No input
      {
          staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      }
  );

  // Effect to set initial selected textbook ID based on query data and prop
  useEffect(() => {
      if (textbooksData && textbooksData.length > 0) {
          const currentSelectionValid = selectedTextbookId !== undefined && textbooksData.some(t => t.id === selectedTextbookId);

          if (initialTextbookId !== undefined && selectedTextbookId !== initialTextbookId) {
              // Prop provided and different from current selection, update to prop
              setSelectedTextbookId(initialTextbookId);
          } else if (selectedTextbookId === undefined) {
               // No selection yet, set based on prop or first item
              setSelectedTextbookId(initialTextbookId ?? textbooksData[0].id);
          } else if (!currentSelectionValid) {
              // Current selection is invalid (e.g., textbook deleted), select first or clear
              setSelectedTextbookId(textbooksData[0].id);
          }
          // If prop is undefined and a valid selection exists, keep it.
      } else if (textbooksData && textbooksData.length === 0) {
          // No textbooks available, clear selection
          setSelectedTextbookId(undefined);
      }
      // Add initialTextbookId to dependency array if it can change after initial render
  }, [textbooksData, selectedTextbookId, initialTextbookId]);


  const { data: rawTimelineEvents, isLoading: isLoadingTimeline, error: errorTimeline } = trpc.schedule.getTimelineEvents.useQuery(
      undefined, // Fetch all events, or add date range filters if needed
      { staleTime: 5 * 60 * 1000 }
  );

  // Process timeline events (parse dates, filter exams) once raw data is available
  const { exams, mockExams } = useMemo(() => {
      if (!rawTimelineEvents) return { exams: [], mockExams: [] };

      // Ensure rawTimelineEvents is an array before processing
      const eventsToProcess = Array.isArray(rawTimelineEvents) ? rawTimelineEvents : [];

      const processedEvents = eventsToProcess.map(event => {
          // Attempt to parse dates, default to null if invalid
          const startDate = event.startDate ? parseISO(event.startDate) : null;
          const endDate = event.endDate ? parseISO(event.endDate) : null;

          return {
              ...event,
              // Ensure details are compatible with Exam type if type is exam/mock_exam
              details: (event.type === 'exam' || event.type === 'mock_exam') ? event.details as Exam : event.details,
              startDate: startDate && isValid(startDate) ? startDate : null, // Store Date or null
              endDate: endDate && isValid(endDate) ? endDate : undefined, // Store Date or undefined
          };
      }).filter(event => event.startDate !== null); // Filter out events with invalid start dates

      const extractedExams = processedEvents
          .filter((event): event is typeof event & { type: 'exam', details: Exam, startDate: Date } =>
              event.type === 'exam' && !!event.details && typeof event.details === 'object' && 'is_mock' in event.details && !event.details.is_mock
          )
          .map(event => event.details);

      const extractedMockExams = processedEvents
          .filter((event): event is typeof event & { type: 'mock_exam', details: Exam, startDate: Date } =>
              event.type === 'mock_exam' && !!event.details && typeof event.details === 'object' && 'is_mock' in event.details && event.details.is_mock === true
          )
          .map(event => event.details);

      return { exams: extractedExams, mockExams: extractedMockExams };
  }, [rawTimelineEvents]);


  // TODO: Implement `getProgress` procedure on the server (server/src/routers/schedule.ts)
  // Fetch progress data for the selected textbook
  // const { data: progressResult, isLoading: isLoadingProgress, error: errorProgress } = trpc.schedule.getProgress.useQuery(
  //     { textbookId: selectedTextbookId! }, // Input object
  //     {
  //         enabled: selectedTextbookId !== undefined, // Only run query if an ID is selected
  //         staleTime: 1 * 60 * 1000, // Cache progress for 1 minute
  //     }
  // );

  // TODO: Uncomment and adjust this useMemo when getProgress is implemented
  // Process progress data once it's loaded
  const progressData: ProcessedProgressData | { hasSchedule: false; textbook: TextbookOutput } | null = useMemo(() => {
      // Temporarily return null as getProgress is not implemented
      if (!selectedTextbookId || !textbooksData) return null;
       const currentTextbook = textbooksData?.find(t => t.id === selectedTextbookId);
       if (!currentTextbook) return null;
       // Return a placeholder indicating no schedule data is available yet
       // This will be replaced by the actual logic when getProgress is ready
       return { hasSchedule: false, textbook: currentTextbook };

      // --- Original processing logic (keep for when getProgress is ready) ---
      /*
      if (!selectedTextbookId || !progressResult || !textbooksData) return null;
      const currentTextbook = textbooksData?.find(t => t.id === selectedTextbookId);
      if (!currentTextbook) return null;
      if (!progressResult.schedule) {
          return { hasSchedule: false, textbook: currentTextbook };
      }
      const { schedule, progress: rawProgress, logs } = progressResult;
      const startDate = parseISO(schedule.start_date);
      const endDate = parseISO(schedule.end_date);
      const today = startOfToday();
      if (!isValid(startDate) || !isValid(endDate)) {
          console.error("Invalid schedule dates received:", schedule.start_date, schedule.end_date);
          return null;
      }
      const totalDays = Math.max(1, differenceInDays(endDate, startDate) + 1);
      const elapsedDays = Math.min(Math.max(0, differenceInDays(today, startDate) + 1), totalDays);
      const remainingDays = Math.max(0, totalDays - elapsedDays);
      const totalProblems = currentTextbook.total_problems || 0;
      const actualProgress = rawProgress?.solvedProblems ?? 0;
      const dailyIdealProgress = totalProblems > 0 && totalDays > 0 ? totalProblems / totalDays : 0;
      const idealProgress = Math.min(Math.round(dailyIdealProgress * elapsedDays), totalProblems);
      const progressDifference = actualProgress - idealProgress;
      const progressStatus = progressDifference >= 0 ? '順調' : '遅れ';
      const dailyTarget = remainingDays > 0 && totalProblems > 0
          ? Math.ceil(Math.max(0, totalProblems - actualProgress) / remainingDays)
          : (totalProblems > 0 ? totalProblems - actualProgress : 0);
      const safeLogs: StudyLog[] = Array.isArray(logs) ? logs : [];
      const dailyData = safeLogs.map((log: StudyLog) => ({
          date: log.date,
          actual: log.actual_amount || 0,
          planned: Math.round(dailyIdealProgress)
      }));
      let cumulativeActual = 0;
      const cumulativeData = Array.from({ length: totalDays }, (_, i) => {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + i);
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          const logForDay = dailyData.find(d => d.date === dateStr);
          cumulativeActual += logForDay?.actual || 0;
          const idealForDay = Math.min(Math.round(dailyIdealProgress * (i + 1)), totalProblems);
          return { date: dateStr, actual: cumulativeActual, ideal: idealForDay };
      }).filter(d => parseISO(d.date) <= today);
      return {
          hasSchedule: true, textbook: currentTextbook, schedule, totalDays, elapsedDays,
          remainingDays, idealProgress, actualProgress, progressDifference, progressStatus,
          dailyTarget, dailyData, cumulativeData, totalProblems,
      };
      */
  // }, [selectedTextbookId, /* progressResult, */ textbooksData]); // Add progressResult back when uncommenting
  }, [selectedTextbookId, textbooksData]); // Dependencies for temporary state

  // Combined loading state - use `isLoading` from TanStack Query v5
  // Remove isLoadingProgress for now
  const isLoading = isLoadingTextbooks || isLoadingTimeline; // || (selectedTextbookId !== undefined && isLoadingProgress);
  // Combined error state
  // Remove errorProgress for now
  const queryError = errorTextbooks || errorTimeline; // || (selectedTextbookId !== undefined ? errorProgress : null);


  // 日付をフォーマット (MM/DD) using date-fns
  const formatDate = (dateString: string): string => {
     try {
        const date = parseISO(dateString);
        if (!isValid(date)) return "無効";
        return format(date, 'M/d');
     } catch {
        return "無効";
     }
  };

  // ローディング表示
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // エラー表示
  if (queryError) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>データの読み込み中にエラーが発生しました: {queryError.message}</p>
        {/* Consider adding refetch buttons */}
      </div>
    );
  }

  // メインコンテンツ
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
            disabled={!textbooksData || textbooksData.length === 0} // Disable if no textbooks
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

      {/* No textbook selected or no progress data yet */}
      {!selectedTextbookId || !progressData ? (
         <div className="text-center py-8 text-gray-500">
           <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
           <p>{!textbooksData || textbooksData.length === 0 ? '利用可能な参考書がありません。' : '表示する参考書を選択してください。'}</p>
         </div>
      ) : (
        // Check if progressData is not null before accessing its properties
        progressData.hasSchedule ? (
          // Case: Schedule exists, display progress details
          // This block is currently unreachable as getProgress is not implemented
          null // Render nothing for now. TODO: Restore JSX when getProgress is implemented.
        ) : (
           // Case: No schedule found for the selected textbook (progressData.hasSchedule is false)
           <div className="text-center py-8">
             <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
             <p className="text-lg text-gray-600">
                {/* Safely access textbook title even when hasSchedule is false */}
                「{progressData.textbook.title}」のスケジュールが設定されていません
              </p>
              <p className="text-sm text-gray-500 mt-2">
                スケジュールを設定すると進捗状況を確認できます
              </p>
            </div> // Ends inner FALSE block
          ) // Closes inner ternary (progressData.hasSchedule ? ... : ...)
      ) // Closes outer ternary's ELSE block (!selectedTextbookId || !progressData ? ... : ...)
    } // Closes JSX expression block
    </div> // Line 565: Closing div for the main component container
  );
};

export default ScheduleProgressChart;
