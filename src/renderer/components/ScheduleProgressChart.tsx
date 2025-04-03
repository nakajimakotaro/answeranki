import { useState, useEffect } from 'react';
import { parseISO, differenceInDays, startOfToday, isValid, format } from 'date-fns'; // Import date-fns functions
import { scheduleService, Textbook, StudySchedule, StudyLog, TimelineEvent, Progress } from '../services/scheduleService'; // Import necessary types
import { Exam } from '../../../shared/types/exam'; // Import shared Exam type
import { BarChart2, Calendar, BookOpen, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

// Define MockExam type locally as it's derived from TimelineEvent
// Note: This might be redundant if the shared Exam type covers mock exams via the is_mock flag.
// Consider using the shared Exam type directly if applicable.
interface MockExam {
  id: number;
  name: string;
  date: string;
  exam_type: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Define the structure for processed progress data set in state
interface ProcessedProgressData {
  hasSchedule: true;
  textbook: Textbook;
  schedule: StudySchedule;
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
  textbookId?: number; // Allow initial textbook selection via prop
}

/**
 * スケジュール進捗チャートコンポーネント
 * 実際の進捗と予定の進捗を比較して表示する
 */
const ScheduleProgressChart = ({ textbookId }: ScheduleProgressChartProps) => {
  // 状態管理
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [selectedTextbookId, setSelectedTextbookId] = useState<number | undefined>(textbookId);
  const [progressData, setProgressData] = useState<ProcessedProgressData | { hasSchedule: false; textbook: Textbook } | null>(null); // Use new interface
  const [mockExams, setMockExams] = useState<Exam[]>([]); // Use shared Exam type for mock exams
  const [exams, setExams] = useState<Exam[]>([]); // Use shared Exam type for real exams
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]); // Keep timeline events if needed elsewhere, though maybe not
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // データ取得 (Textbooks and TimelineEvents)
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [textbooksData, timelineEventsData] = await Promise.all([
          scheduleService.getTextbooks(),
          scheduleService.getTimelineEvents() // Fetch all timeline events
        ]);

        setTextbooks(textbooksData);
        setTimelineEvents(timelineEventsData); // Store raw timeline events

        // Extract exams and mock exams from timeline events using shared Exam type
        const extractedExams = timelineEventsData
          .filter((event): event is TimelineEvent & { details: Exam } => event.type === 'exam')
          .map(event => event.details);
        const extractedMockExams = timelineEventsData
          // Use the shared Exam type and filter by is_mock flag if details is Exam
          .filter((event): event is TimelineEvent & { details: Exam } =>
            event.type === 'mock_exam' && typeof event.details === 'object' && event.details !== null && 'is_mock' in event.details && event.details.is_mock === true
          )
          .map(event => event.details);

        setExams(extractedExams);
        setMockExams(extractedMockExams); // This now holds Exam objects where is_mock is true

        // Determine initial selected textbook ID
        const initialIdToSelect = textbookId ?? (textbooksData.length > 0 ? textbooksData[0].id : undefined);

        if (initialIdToSelect !== undefined) {
          setSelectedTextbookId(initialIdToSelect);
          // fetchProgressData will be triggered by the state change via the next useEffect
        } else {
          setProgressData(null); // No textbook to show progress for
          setLoading(false); // No progress to fetch
        }

      } catch (err) {
        console.error('Error fetching initial data:', err);
        setError('初期データの取得中にエラーが発生しました');
        setLoading(false);
      }
    };
    loadInitialData();
  }, [textbookId]); // Rerun if the textbookId prop changes

  // Fetch progress data when selectedTextbookId changes
  useEffect(() => {
    if (selectedTextbookId !== undefined) {
      fetchProgressData(selectedTextbookId);
    } else {
      // Clear progress data if no textbook is selected
      setProgressData(null);
      // Ensure loading is false if we cleared selection
      if (loading) setLoading(false);
    }
  }, [selectedTextbookId]);

  // 進捗データを取得して加工する関数
  const fetchProgressData = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      const progressResult = await scheduleService.getProgress(id);

      if (!progressResult.schedule) {
        setProgressData({
          hasSchedule: false,
          textbook: progressResult.textbook,
        });
        setLoading(false);
        return;
      }

      // Calculations using date-fns
      const { textbook, schedule, progress: rawProgress, logs } = progressResult;
      const startDate = parseISO(schedule.start_date);
      const endDate = parseISO(schedule.end_date);
      const today = startOfToday(); // Use startOfToday

      // Validate dates
      if (!isValid(startDate) || !isValid(endDate)) {
          throw new Error("Invalid schedule dates");
      }

      // Calculate days using differenceInDays, add 1 for inclusive count
      const totalDays = Math.max(1, differenceInDays(endDate, startDate) + 1);
      const elapsedDays = Math.min(
        Math.max(0, differenceInDays(today, startDate) + 1), // Add 1 for inclusive
        totalDays
      );
      const remainingDays = Math.max(0, totalDays - elapsedDays);
      const totalProblems = textbook.total_problems || 0;
      const actualProgress = rawProgress.solvedProblems || 0;

      const dailyIdealProgress = totalProblems > 0 && totalDays > 0 ? totalProblems / totalDays : 0;
      const idealProgress = Math.min(
        Math.round(dailyIdealProgress * elapsedDays),
        totalProblems
      );

      const progressDifference = actualProgress - idealProgress;
      const progressStatus = progressDifference >= 0 ? '順調' : '遅れ';
      const dailyTarget = remainingDays > 0 && totalProblems > 0
        ? Math.ceil(Math.max(0, totalProblems - actualProgress) / remainingDays)
        : (totalProblems > 0 ? totalProblems - actualProgress : 0); // If no remaining days, target is remaining problems

      const dailyData = logs.map((log: StudyLog) => ({
        date: log.date,
        actual: log.actual_amount || 0,
        planned: Math.round(dailyIdealProgress)
      }));

      let cumulativeActual = 0;
      let cumulativeIdeal = 0;
      const cumulativeData = dailyData.map((day) => {
        cumulativeActual += day.actual;
        cumulativeIdeal += day.planned;
        return {
          date: day.date,
          actual: cumulativeActual,
          ideal: cumulativeIdeal
        };
      });

      // Set state with the processed data structure
      setProgressData({
        hasSchedule: true,
        textbook,
        schedule,
        totalDays,
        elapsedDays,
        remainingDays,
        idealProgress,
        actualProgress,
        progressDifference,
        progressStatus,
        dailyTarget,
        dailyData,
        cumulativeData,
        totalProblems,
      });

      setLoading(false);
    } catch (err) {
      console.error('Error fetching progress data:', err);
      setError('進捗データの取得中にエラーが発生しました');
      setLoading(false);
    }
  };

  // 日付をフォーマット (MM/DD) using date-fns
  const formatDate = (dateString: string): string => {
     try {
        const date = parseISO(dateString); // Assume 'yyyy-MM-dd' format
        if (!isValid(date)) return "無効";
        return format(date, 'M/d'); // Format as Month/Day
     } catch {
        return "無効";
     }
  };

  // ローディング表示
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // エラー表示
  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>{error}</p>
        <button
          className="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm"
          onClick={() => selectedTextbookId && fetchProgressData(selectedTextbookId)}
        >
          再読み込み
        </button>
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
            disabled={textbooks.length === 0} // Disable if no textbooks
          >
            <option value="">参考書を選択</option>
            {textbooks.map((textbook) => (
              <option key={textbook.id} value={textbook.id}>
                {textbook.title} ({textbook.subject})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* No textbook selected or no progress data */}
      {!selectedTextbookId || !progressData ? (
         <div className="text-center py-8 text-gray-500">
           <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
           <p>表示する参考書を選択してください。</p>
         </div>
      ) : (
        <div>
          {/* Case: No schedule found for the selected textbook */}
          {progressData.hasSchedule === false ? (
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
            // Case: Schedule exists, display progress details
            <>
              {/* 進捗サマリー */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Overall Progress */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <BookOpen className="h-5 w-5 text-gray-500 mr-2" />
                    <h3 className="font-medium">全体の進捗</h3>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-3xl font-bold">
                        {progressData.actualProgress}/{progressData.totalProblems}
                      </p>
                      <p className="text-sm text-gray-500">
                        問題 ({progressData.totalProblems > 0 ? Math.round((progressData.actualProgress / progressData.totalProblems) * 100) : 0}%)
                      </p>
                    </div>
                    {/* Progress Circle (Simplified) */}
                    <div className="relative h-16 w-16">
                       <svg className="w-full h-full" viewBox="0 0 36 36">
                         <path
                           className="text-gray-200"
                           strokeWidth="3.8"
                           stroke="currentColor"
                           fill="none"
                           d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                         />
                         <path
                           className="text-primary"
                           strokeWidth="3.8"
                           strokeDasharray={`${progressData.totalProblems > 0 ? (progressData.actualProgress / progressData.totalProblems) * 100 : 0}, 100`}
                           strokeLinecap="round"
                           stroke="currentColor"
                           fill="none"
                           d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                         />
                       </svg>
                       <div className="absolute inset-0 flex items-center justify-center">
                         <span className="text-xs font-medium">
                           {progressData.totalProblems > 0 ? Math.round((progressData.actualProgress / progressData.totalProblems) * 100) : 0}%
                         </span>
                       </div>
                     </div>
                  </div>
                </div>

                {/* Period Progress */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <Calendar className="h-5 w-5 text-gray-500 mr-2" />
                    <h3 className="font-medium">期間の進捗</h3>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-3xl font-bold">
                        {progressData.elapsedDays}/{progressData.totalDays}
                      </p>
                      <p className="text-sm text-gray-500">
                        日 ({progressData.totalDays > 0 ? Math.round((progressData.elapsedDays / progressData.totalDays) * 100) : 0}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">残り</p>
                      <p className="text-xl font-bold">{progressData.remainingDays}日</p>
                    </div>
                  </div>
                  <div className="mt-2 bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full"
                      style={{ width: `${progressData.totalDays > 0 ? (progressData.elapsedDays / progressData.totalDays) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>

                {/* Status */}
                <div className={`p-4 rounded-lg ${progressData.progressDifference >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center mb-2">
                    <Clock className="h-5 w-5 text-gray-500 mr-2" />
                    <h3 className="font-medium">進捗状況</h3>
                  </div>
                  <div className="flex items-center">
                    {progressData.progressDifference >= 0 ? (
                      <CheckCircle className="h-8 w-8 text-green-500 mr-3" />
                    ) : (
                      <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
                    )}
                    <div>
                      <p className="font-bold text-lg">
                        {progressData.progressStatus}
                      </p>
                      <p className="text-sm">
                        {progressData.progressDifference >= 0
                          ? `予定より${progressData.progressDifference}問先行`
                          : `予定より${Math.abs(progressData.progressDifference)}問遅れ`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm text-gray-600">
                      1日あたり<span className="font-bold">{progressData.dailyTarget}問</span>で完了予定
                    </p>
                  </div>
                </div>
              </div>

              {/* 進捗グラフ */}
              <div className="mt-8">
                <h3 className="text-lg font-medium mb-4">累積進捗グラフ</h3>
                <div className="relative h-64 border border-gray-200 rounded-lg p-4">
                  {/* Y軸 */}
                  <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-gray-500 py-2 pr-1 text-right">
                    <span>{progressData.totalProblems}</span>
                    {progressData.totalProblems > 0 && (
                       <>
                         <span>{Math.round(progressData.totalProblems * 0.75)}</span>
                         <span>{Math.round(progressData.totalProblems * 0.5)}</span>
                         <span>{Math.round(progressData.totalProblems * 0.25)}</span>
                       </>
                    )}
                    <span>0</span>
                  </div>

                  {/* グラフエリア */}
                  <div className="ml-12 h-full relative">
                    {/* 水平線 */}
                    <div className="absolute w-full h-full flex flex-col justify-between border-l border-gray-200">
                      <div className="border-t border-gray-200"></div>
                      <div className="border-t border-gray-200"></div>
                      <div className="border-t border-gray-200"></div>
                      <div className="border-t border-gray-200"></div>
                      <div className="border-t border-gray-200"></div>
                    </div>

                    {/* 理想的な進捗線 */}
                    <svg className="absolute inset-0 w-full h-full overflow-visible">
                      <line
                        x1="0%"
                        y1="100%"
                        x2="100%"
                        y2="0%"
                        stroke="#9ca3af" // gray-400
                        strokeWidth="2"
                        strokeDasharray="4"
                      />
                    </svg>

                    {/* 実際の進捗線 */}
                    {progressData.cumulativeData && progressData.cumulativeData.length > 0 && progressData.totalProblems > 0 && (
                      <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <polyline
                          points={progressData.cumulativeData.map((point) => {
                            const pointDate = parseISO(point.date);
                            const scheduleStartDate = parseISO(progressData.schedule.start_date);
                            if (!isValid(pointDate) || !isValid(scheduleStartDate)) return '0,100'; // Default point if dates invalid

                            // Calculate x based on the number of days from start
                            const dayIndex = differenceInDays(pointDate, scheduleStartDate); // No +1 needed here for index
                            const x = progressData.totalDays > 0 ? (dayIndex / (progressData.totalDays -1)) * 100 : 0; // Use totalDays-1 for 0-based index scaling
                            const y = 100 - (point.actual / progressData.totalProblems) * 100;
                            const finalX = Number.isFinite(x) ? Math.min(100, Math.max(0, x)) : 0;
                            const finalY = Number.isFinite(y) ? Math.min(100, Math.max(0, y)) : 100;
                            return `${finalX.toFixed(2)},${finalY.toFixed(2)}`;
                          }).join(' ')}
                          fill="none"
                          stroke="#3b82f6" // primary color
                          strokeWidth="0.8" // Use relative stroke width
                        />
                      </svg>
                    )}

                    {/* 模試と試験のマーカー */}
                    <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                      {/* Combine mockExams and exams (both are now Exam[]) */}
                      {[...mockExams, ...exams].map((event, index) => {
                        // Use the is_mock flag from the shared Exam type
                        const isMock = event.is_mock;
                        const eventDateStr = event.date; // Use 'date' from shared Exam type
                        const eventType = event.exam_type; // Use 'exam_type' string from shared Exam type

                        let eventDate: Date;
                        try {
                           eventDate = parseISO(eventDateStr); // Use parseISO
                           if (!isValid(eventDate)) throw new Error(); // Use isValid
                        } catch { return null; } // Skip if date is invalid

                        const scheduleStartDate = parseISO(progressData.schedule.start_date); // Use parseISO
                        const scheduleEndDate = parseISO(progressData.schedule.end_date); // Use parseISO

                        // Use isValid for date validation
                        if (!isValid(scheduleStartDate) || !isValid(scheduleEndDate) || !isValid(eventDate) || differenceInDays(scheduleEndDate, scheduleStartDate) <= 0) return null;

                        // Calculate position using differenceInDays for total duration
                        const totalDurationDays = differenceInDays(scheduleEndDate, scheduleStartDate);
                        const eventOffsetDays = differenceInDays(eventDate, scheduleStartDate);
                        const position = totalDurationDays > 0 ? (eventOffsetDays / totalDurationDays) * 100 : 0;


                        if (position >= 0 && position <= 100) {
                          let color = "#9ca3af"; // default gray
                          if (isMock) {
                              color = "#f59e0b"; // yellow
                          // Color logic might need adjustment based on exam_type string values or name
                          } else if (eventType === 'common_test' || event.name.includes("共通") || event.name.includes("共テ")) { // Example adjustment
                              color = "#ef4444"; // red
                          } else if (eventType === 'secondary' || event.name.includes("二次")) { // Example adjustment
                              color = "#8b5cf6"; // purple
                          }

                          return (
                            <line
                              key={`${isMock ? 'mock' : 'exam'}-${event.id || index}`}
                              x1={`${position}%`}
                              y1="0%"
                              x2={`${position}%`}
                              y2="100%"
                              stroke={color}
                              strokeWidth="0.5" // Use relative stroke width
                              strokeDasharray="2 2" // Use relative dash array
                            />
                          );
                        }
                        return null;
                      })}
                    </svg>

                    {/* 今日の位置 */}
                    {progressData.elapsedDays < progressData.totalDays && progressData.totalDays > 0 && (
                       <div
                         className="absolute top-0 bottom-0 border-l-2 border-red-400"
                         style={{
                           left: `${(progressData.elapsedDays / progressData.totalDays) * 100}%`,
                         }}
                       >
                         <div className="absolute -top-5 -translate-x-1/2 bg-red-400 text-white text-xs px-1 rounded">
                           今日
                         </div>
                       </div>
                    )}
                  </div>

                  {/* X軸 */}
                  <div className="absolute left-12 right-0 -bottom-5 flex justify-between text-xs text-gray-500">
                    <span>{formatDate(progressData.schedule.start_date)}</span>
                    <span>{formatDate(progressData.schedule.end_date)}</span>
                  </div>

                  {/* 凡例 */}
                  <div className="absolute top-2 right-2 flex flex-col items-start text-xs space-y-1 bg-white bg-opacity-75 p-1 rounded">
                     <div className="flex items-center">
                       <div className="w-3 h-0.5 bg-blue-500 mr-1"></div>
                       <span>実際の進捗</span>
                     </div>
                     <div className="flex items-center">
                       <div className="w-3 h-0 border-t-2 border-dashed border-gray-400 mr-1"></div>
                       <span>理想的な進捗</span>
                     </div>
                     <div className="flex items-center">
                       <div className="w-0.5 h-3 border-l-2 border-dashed border-yellow-500 mr-1"></div>
                       <span>模試</span>
                     </div>
                     <div className="flex items-center">
                       <div className="w-0.5 h-3 border-l-2 border-dashed border-red-500 mr-1"></div>
                       <span>共通テスト</span>
                     </div>
                     <div className="flex items-center">
                       <div className="w-0.5 h-3 border-l-2 border-dashed border-purple-500 mr-1"></div>
                       <span>二次試験</span>
                     </div>
                   </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ScheduleProgressChart;
