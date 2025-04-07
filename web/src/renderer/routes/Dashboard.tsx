import { useState, useEffect, useMemo } from 'react'; // Import useMemo
import { format, parseISO, differenceInDays, startOfToday, isBefore, compareAsc } from 'date-fns'; // Import date-fns functions (removed unused isValid)
// Import types from shared packages
// Removed incorrect Textbook import
import type { StudyLog } from '@shared/schemas/schedule'; // Adjust path if needed
import type { TimelineEvent } from '@shared/types/timeline'; // Adjust path if needed
// Removed Exam import, will use inferred type
import DailyLogInput from '../components/DailyLogInput.js';
import { Calendar, ChevronRight, BookOpen, GraduationCap, Clock } from 'lucide-react';
import { trpc } from '../lib/trpc.js'; // Import tRPC client
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../../../server/src/router'; // Adjust path if needed

// Infer types from router using correct procedure names
type RouterOutput = inferRouterOutputs<AppRouter>;
type TextbookOutput = RouterOutput['textbook']['getTextbooks'][number]; // Use getTextbooks
type StudyLogOutput = RouterOutput['schedule']['listLogs'][number];
type TimelineEventOutput = RouterOutput['schedule']['getTimelineEvents'][number];
// ProgressOutput is removed as getProgress procedure doesn't exist
type ExamOutput = RouterOutput['exam']['getAll'][number]; // Use getAll

// 計算された進捗情報の型定義 (Removed fields dependent on non-existent getProgress)
interface CalculatedProgress {
  textbookId: number;
  title: string;
  subject: string;
  // dailyGoal: number | null; // This might come from schedule data if available
  totalProblems: number;
  solvedToday: number;
  totalSolved: number; // This needs calculation based on logs
  progressPercentage: number; // This needs calculation based on logs and total problems
  // isScheduledToday: boolean; // Requires schedule data
  ankiDeckName: string | undefined;
  // daysRemaining: number; // Removed
  // dailyTarget: number; // Removed
}

// 受験日カウントダウンの型定義
interface ExamCountdown {
  universityName: string;
  examType: string;
  daysRemaining: number;
  examDate: string;
}

const Dashboard = () => {
  const [today] = useState(format(new Date(), 'yyyy-MM-dd')); // Use format for today's date string
  const trpcUtils = trpc.useUtils(); // Get tRPC utils for invalidation

  // --- tRPC Queries ---
  const textbooksQuery = trpc.textbook.getTextbooks.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  const logsQuery = trpc.schedule.listLogs.useQuery(
    { start_date: today, end_date: today }, // Fetch logs for today
    { staleTime: 60 * 1000 } // Cache for 1 minute
  );
  // Fetch all exams for countdown calculation
  const examsQuery = trpc.exam.getAll.useQuery(undefined, {
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
  // Query for all logs to calculate total progress (might be large, consider backend aggregation)
  const allLogsQuery = trpc.schedule.listLogs.useQuery(undefined, {
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });


  // --- State for Calculated Data ---
  const [progress, setProgress] = useState<CalculatedProgress[]>([]);
  const [countdowns, setCountdowns] = useState<ExamCountdown[]>([]);

  // --- Derived State and Effects ---
  const isLoading = textbooksQuery.isLoading || logsQuery.isLoading || examsQuery.isLoading || allLogsQuery.isLoading;
  const error = textbooksQuery.error?.message || logsQuery.error?.message || examsQuery.error?.message || allLogsQuery.error?.message || null;

  // Calculate Progress when data is available
  useEffect(() => {
    if (textbooksQuery.data && allLogsQuery.data) {
      calculateProgress(textbooksQuery.data, allLogsQuery.data, logsQuery.data || []);
    }
  }, [textbooksQuery.data, allLogsQuery.data, logsQuery.data]); // Depend on fetched data

  // Calculate Countdowns when exam data is available
  useEffect(() => {
    if (examsQuery.data) {
      calculateExamCountdowns(examsQuery.data);
    }
  }, [examsQuery.data]); // Depend on fetched exam data

  // 進捗情報の計算 (Client-side calculation)
  const calculateProgress = (
      books: TextbookOutput[],
      allLogs: StudyLogOutput[],
      todayLogs: StudyLogOutput[]
  ) => {
    const progressData: CalculatedProgress[] = books.map(book => {
      if (!book.id) return null; // Should not happen with DB data

      // Calculate total solved problems for this textbook from all logs
      const totalSolved = allLogs
        .filter(log => log.textbook_id === book.id)
        .reduce((sum, log) => sum + (log.actual_amount || 0), 0);

      // Find today's log entry
      const todayLog = todayLogs.find(log => log.textbook_id === book.id);
      const solvedToday = todayLog?.actual_amount || 0;

      // Calculate progress percentage
      const progressPercentage = book.total_problems > 0
        ? Math.round((totalSolved / book.total_problems) * 100)
        : 0;

      return {
        textbookId: book.id,
        title: book.title,
        subject: book.subject,
        totalProblems: book.total_problems,
        solvedToday: solvedToday,
        totalSolved: totalSolved,
        progressPercentage: progressPercentage,
        ankiDeckName: book.anki_deck_name,
      };
    }).filter((item): item is CalculatedProgress => item !== null); // Filter out potential nulls

    setProgress(progressData);
  };

  // 受験日カウントダウンの計算 (Uses data from examsQuery)
  const calculateExamCountdowns = (exams: ExamOutput[]) => {
    const todayDate = startOfToday(); // Get today's date at midnight

    const countdownData = exams
      .map(exam => {
        // exam.date is guaranteed to exist by the filter before this function call.
        const examDate = parseISO(exam.date); // Use exam.date
        // Keep isBefore check as it's application logic, not data validation.
        if (isBefore(examDate, todayDate)) {
          return null; // Skip past dates
        }
        // differenceInDays calculates full days, add 1 for inclusive count
        const diffDays = differenceInDays(examDate, todayDate) + 1;

        // Map Exam properties to ExamCountdown properties
        // exam.is_mock の値に基づいて '模試' または '本番' を設定
        const displayExamType = exam.is_mock ? '模試' : '本番';

        return {
          universityName: exam.name || '不明', // Use exam.name
          // examType には判定結果（'模試' or '本番'）を入れる
          examType: displayExamType,
          daysRemaining: diffDays,
          examDate: exam.date, // Use exam.date
          // Store the parsed date for sorting
          parsedDate: examDate
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null) // Remove null entries
      // Sort by parsed date using compareAsc
      .sort((a, b) => compareAsc(a.parsedDate, b.parsedDate));

    setCountdowns(countdownData.slice(0, 3)); // 上位3つのみ表示
  };

  // 学習ログの更新 (Invalidate tRPC queries)
  const handleLogUpdate = () => {
    // Invalidate today's logs and all logs to trigger recalculations
    trpcUtils.schedule.listLogs.invalidate({ start_date: today, end_date: today });
    trpcUtils.schedule.listLogs.invalidate(); // Invalidate the query for all logs
    // No need to manually set state, useEffect hooks will recalculate progress
  };

  if (isLoading) { // Use isLoading from tRPC hooks
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>エラー: {error}</p> {/* Display error message from tRPC hooks */}
          <button
            className="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm"
            onClick={() => {
                // Optionally refetch queries on error button click
                textbooksQuery.refetch();
                logsQuery.refetch();
                examsQuery.refetch();
                allLogsQuery.refetch();
            }}
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">ダッシュボード</h1>
      
      {/* 受験カウントダウン */}
      {countdowns.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <GraduationCap className="mr-2" />
            受験カウントダウン
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {countdowns.map((countdown, index) => {
              // 試験種別（'模試' or '本番'）に応じた色を設定
              const borderColor = countdown.examType === '模試'
                ? 'border-yellow-500' // 模試は黄色
                : 'border-blue-500';   // 本番は青色 (例: primary color)

              // テキスト色も設定
              const textColor = countdown.examType === '模試'
                ? 'text-yellow-600' // 模試は黄色系
                : 'text-blue-600';   // 本番は青色系 (例: primary color)

              return (
                <div key={index} className={`bg-white rounded-lg shadow p-4 border-l-4 ${borderColor}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold">{countdown.universityName}</h3>
                      <p className={`text-sm font-medium ${textColor}`}>{countdown.examType}</p>
                      <p className="text-sm text-gray-600">{countdown.examDate}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-3xl font-bold ${textColor}`}>{countdown.daysRemaining}</p>
                      <p className="text-xs text-gray-500">日</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* 今日の学習タスク */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Calendar className="mr-2" />
          今日の学習タスク
        </h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">参考書</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目</th>
                {/* Removed 目標 header */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">今日の実績</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">全体進捗</th>
                {/* Removed 残り日数 header */}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {progress.length > 0 ? (
                progress.map((item) => (
                  <tr key={item.textbookId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <BookOpen className="h-5 w-5 text-gray-400 mr-2" />
                        <div className="text-sm font-medium text-gray-900">{item.title}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.subject}</td>
                    {/* Removed dailyTarget cell */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.solvedToday}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                        <div
                          className="bg-primary h-2.5 rounded-full"
                          style={{ width: `${item.progressPercentage}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{item.progressPercentage}% ({item.totalSolved}/{item.totalProblems})</span>
                    </td>
                    {/* Removed daysRemaining cell */}
                  </tr> // Closing tr tag was missing here
                ))
              ) : (
                <tr>
                  {/* Adjusted colspan */}
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* 学習ログ入力 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Clock className="mr-2" />
          今日の学習記録
        </h2>
        <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800">
          <DailyLogInput
            textbooks={textbooksQuery.data || []} // Pass data from tRPC query
            date={today}
            onLogUpdated={handleLogUpdate}
            existingLogs={logsQuery.data || []} // Pass today's logs from tRPC query
          />
        </div>
      </div>
      
      {/* リンク */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a 
          href="/textbooks" 
          className="bg-white rounded-lg shadow p-4 flex justify-between items-center hover:bg-gray-50"
        >
          <span className="font-semibold">参考書管理</span>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </a>
        <a 
          href="/schedules" 
          className="bg-white rounded-lg shadow p-4 flex justify-between items-center hover:bg-gray-50"
        >
          <span className="font-semibold">スケジュール管理</span>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </a>
        <a 
          href="/universities" 
          className="bg-white rounded-lg shadow p-4 flex justify-between items-center hover:bg-gray-50"
        >
          <span className="font-semibold">志望校管理</span>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </a>
      </div>
    </div>
  );
};

export default Dashboard;
