import { useState, useEffect } from 'react';
import { format, parseISO, differenceInDays, startOfToday, isBefore, isValid, compareAsc } from 'date-fns'; // Import date-fns functions
import { scheduleService, Textbook, StudyLog, TimelineEvent } from '../services/scheduleService';
import { Exam } from '../types/exam'; // Import Exam type
import DailyLogInput from '../components/DailyLogInput';
import { Calendar, ChevronRight, BookOpen, GraduationCap, Clock } from 'lucide-react';

// 計算された進捗情報の型定義
interface CalculatedProgress {
  textbookId: number;
  title: string;
  subject: string;
  dailyGoal: number | null;
  totalProblems: number;
  solvedToday: number;
  totalSolved: number;
  progressPercentage: number;
  isScheduledToday: boolean;
  ankiDeckName: string | undefined;
  daysRemaining: number;
  dailyTarget: number;
}

// 受験日カウントダウンの型定義
interface ExamCountdown {
  universityName: string;
  examType: string;
  daysRemaining: number;
  examDate: string;
}

const Dashboard = () => {
  // 状態管理
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]); // Add state for timeline events
  const [progress, setProgress] = useState<CalculatedProgress[]>([]);
  const [countdowns, setCountdowns] = useState<ExamCountdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [today] = useState(format(new Date(), 'yyyy-MM-dd')); // Use format for today's date string

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null); // Reset error

        // 参考書、学習ログ、タイムラインイベントを取得
        const [textbooksData, logsData, timelineEventsData] = await Promise.all([
          scheduleService.getTextbooks(),
          scheduleService.getLogs({ start_date: today, end_date: today }),
          scheduleService.getTimelineEvents() // Fetch all timeline events (no date range needed for countdown)
        ]);

        setTextbooks(textbooksData);
        setStudyLogs(logsData);
        setTimelineEvents(timelineEventsData); // Store timeline events

        // 進捗情報を計算
        await calculateProgress(textbooksData, logsData);

        // 受験日カウントダウンを計算 (timelineEventsDataから試験情報を抽出)
        // Filter for 'exam' and 'mock_exam' types and assert details as Exam type
        const examEvents = timelineEventsData.filter(
          (event): event is TimelineEvent & { details: Exam } =>
            (event.type === 'exam' || event.type === 'mock_exam') && typeof event.details === 'object' && event.details !== null && 'date' in event.details && 'name' in event.details
        );
        calculateExamCountdowns(examEvents.map(e => e.details)); // Pass Exam details

        setLoading(false);
      } catch (err) {
        console.error('Dashboard data loading error:', err);
        setError('データの読み込み中にエラーが発生しました');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [today]);

  // 進捗情報の計算
  const calculateProgress = async (books: Textbook[], logs: StudyLog[]) => {
    try {
      const progressData: CalculatedProgress[] = [];
      
      for (const book of books) {
        if (!book.id) continue;
        
        // 参考書の進捗情報を取得
        const bookProgress = await scheduleService.getProgress(book.id);
        
        // 今日の学習ログを検索
        const todayLog = logs.find(log => log.textbook_id === book.id);
        
        progressData.push({
          textbookId: book.id,
          title: book.title,
          subject: book.subject,
          dailyGoal: bookProgress.schedule?.daily_goal || null,
          totalProblems: book.total_problems,
          solvedToday: todayLog?.actual_amount || 0,
          totalSolved: bookProgress.progress.solvedProblems,
          progressPercentage: bookProgress.progress.progressPercentage,
          isScheduledToday: true, // スケジュールの判定はバックエンドで行う
          ankiDeckName: book.anki_deck_name,
          daysRemaining: bookProgress.progress.daysRemaining,
          dailyTarget: bookProgress.progress.dailyTarget
        });
      }
      
      setProgress(progressData);
    } catch (err) {
      console.error('Progress calculation error:', err);
      setError('進捗情報の計算中にエラーが発生しました');
    }
  };

  // 受験日カウントダウンの計算 (date-fns を使用, Exam 型を受け入れるように修正)
  const calculateExamCountdowns = (exams: Exam[]) => {
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

  // 学習ログの更新
  const handleLogUpdate = async () => {
    try {
      // 最新の学習ログを取得
      const logsData = await scheduleService.getLogs({ start_date: today, end_date: today });
      setStudyLogs(logsData);
      
      // 進捗情報を再計算
      await calculateProgress(textbooks, logsData);
    } catch (err) {
      console.error('Log update error:', err);
      setError('学習ログの更新中にエラーが発生しました');
    }
  };

  if (loading) {
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
          <p>{error}</p>
          <button 
            className="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm"
            onClick={() => window.location.reload()}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">目標</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">実績</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">進捗</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">残り日数</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.dailyTarget || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.solvedToday}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-primary h-2.5 rounded-full" 
                          style={{ width: `${item.progressPercentage}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500">{item.progressPercentage}% ({item.totalSolved}/{item.totalProblems})</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {item.daysRemaining > 0 ? `残り${item.daysRemaining}日` : '期限切れ'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    参考書が登録されていません
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
        <div className="bg-white rounded-lg shadow p-4">
          <DailyLogInput 
            textbooks={textbooks} 
            date={today} 
            onLogUpdated={handleLogUpdate}
            existingLogs={studyLogs}
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
