import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, differenceInDays, startOfToday, isBefore, compareAsc } from 'date-fns';
import DailyLogInput from '../components/DailyLogInput.js';
import { Calendar, ChevronRight, BookOpen, GraduationCap, Clock } from 'lucide-react';
import { trpc } from '../lib/trpc.js';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../../../server/src/router';

type RouterOutput = inferRouterOutputs<AppRouter>;
type TextbookOutput = RouterOutput['textbook']['getTextbooks'][number];
type StudyLogOutput = RouterOutput['schedule']['listLogs'][number];
type TimelineEventOutput = RouterOutput['schedule']['getTimelineEvents'][number];
type ExamOutput = RouterOutput['exam']['getAll'][number];

// 計算された進捗情報の型定義
interface CalculatedProgress {
  textbookId: number;
  title: string;
  subject: string;
  totalProblems: number;
  solvedToday: number;
  totalSolved: number;
  progressPercentage: number;
  ankiDeckName: string | null | undefined; // Allow null or undefined
}

// 受験日カウントダウンの型定義
interface ExamCountdown {
  universityName: string;
  examType: string;
  daysRemaining: number;
  examDate: string;
}

const Dashboard = () => {
  const [today] = useState(format(new Date(), 'yyyy-MM-dd'));
  const trpcUtils = trpc.useUtils();

  // --- tRPC Queries ---
  const textbooksQuery = trpc.textbook.getTextbooks.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const logsQuery = trpc.schedule.listLogs.useQuery(
    { start_date: today, end_date: today },
    { staleTime: 60 * 1000 }
  );
  const examsQuery = trpc.exam.getAll.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
  });
  const allLogsQuery = trpc.schedule.listLogs.useQuery(undefined, {
      staleTime: 5 * 60 * 1000,
  });


  // --- State for Calculated Data ---
  const [progress, setProgress] = useState<CalculatedProgress[]>([]);
  const [countdowns, setCountdowns] = useState<ExamCountdown[]>([]);

  // --- Derived State and Effects ---
  const isLoading = textbooksQuery.isLoading || logsQuery.isLoading || examsQuery.isLoading || allLogsQuery.isLoading;
  const error = textbooksQuery.error?.message || logsQuery.error?.message || examsQuery.error?.message || allLogsQuery.error?.message || null;

  useEffect(() => {
    if (textbooksQuery.data && allLogsQuery.data) {
      calculateProgress(textbooksQuery.data, allLogsQuery.data, logsQuery.data || []);
    }
  }, [textbooksQuery.data, allLogsQuery.data, logsQuery.data]);

  useEffect(() => {
    if (examsQuery.data) {
      calculateExamCountdowns(examsQuery.data);
    }
  }, [examsQuery.data]);

  // 進捗情報の計算
  const calculateProgress = (
      books: TextbookOutput[],
      allLogs: StudyLogOutput[],
      todayLogs: StudyLogOutput[]
  ) => {
    const progressData: CalculatedProgress[] = books.map(book => {
      if (!book.id) return null;

      const totalSolved = allLogs
        .filter(log => log.textbook_id === book.id)
        .reduce((sum, log) => sum + (log.actual_amount || 0), 0);

      const todayLog = todayLogs.find(log => log.textbook_id === book.id);
      const solvedToday = todayLog?.actual_amount || 0;

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
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    setProgress(progressData);
  };

  // 受験日カウントダウンの計算
  const calculateExamCountdowns = (exams: ExamOutput[]) => {
    const todayDate = startOfToday();

    const countdownData = exams
      .map(exam => {
        const examDate = parseISO(exam.date);
        if (isBefore(examDate, todayDate)) {
          return null;
        }
        const diffDays = differenceInDays(examDate, todayDate) + 1;

        const displayExamType = exam.is_mock ? '模試' : '本番';

        return {
          universityName: exam.name || '不明',
          examType: displayExamType,
          daysRemaining: diffDays,
          examDate: exam.date,
          parsedDate: examDate
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => compareAsc(a.parsedDate, b.parsedDate));

    setCountdowns(countdownData.slice(0, 3));
  };

  // 学習ログの更新
  const handleLogUpdate = () => {
    trpcUtils.schedule.listLogs.invalidate({ start_date: today, end_date: today });
    trpcUtils.schedule.listLogs.invalidate();
  };

  if (isLoading) {
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
          <p>エラー: {error}</p>
          <button
            className="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm"
            onClick={() => {
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
              const borderColor = countdown.examType === '模試'
                ? 'border-yellow-500'
                : 'border-blue-500';

              const textColor = countdown.examType === '模試'
                ? 'text-yellow-600'
                : 'text-blue-600';

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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">今日の実績</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">全体進捗</th>
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
                  </tr>
                ))
              ) : (
                <tr>
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
            textbooks={textbooksQuery.data || []}
            date={today}
            onLogUpdated={handleLogUpdate}
            existingLogs={logsQuery.data || []}
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
