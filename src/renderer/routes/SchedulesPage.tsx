import { useState, useEffect } from 'react';
import { scheduleService, Textbook, StudySchedule } from '../services/scheduleService';
import { Calendar, Plus, Edit, Trash, BookOpen, Clock } from 'lucide-react';
import YearlyActivityCalendar from '../components/YearlyActivityCalendar';
import ScheduleProgressChart from '../components/ScheduleProgressChart';
import TextbookScheduleTimeline from '../components/TextbookScheduleTimeline';
import TextbookStackedProgress from '../components/TextbookStackedProgress';

const SchedulesPage = () => {
  // 状態管理
  const [schedules, setSchedules] = useState<StudySchedule[]>([]);
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<StudySchedule | null>(null);
  
  // フォーム状態
  const [textbookId, setTextbookId] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState('');
  const [dailyGoal, setDailyGoal] = useState<number | undefined>(undefined);
  const [bufferDays, setBufferDays] = useState(0);
  const [totalProblems, setTotalProblems] = useState<number | undefined>(undefined);
  
  // 曜日ごとの問題数
  const [weekdayGoals, setWeekdayGoals] = useState({
    0: 0, // 日曜日
    1: 0, // 月曜日
    2: 0, // 火曜日
    3: 0, // 水曜日
    4: 0, // 木曜日
    5: 0, // 金曜日
    6: 0  // 土曜日
  });
  
  // 曜日ごとの問題数を均等に設定
  const setEvenWeekdayGoals = (dailyValue: number) => {
    setWeekdayGoals({
      0: dailyValue,
      1: dailyValue,
      2: dailyValue,
      3: dailyValue,
      4: dailyValue,
      5: dailyValue,
      6: dailyValue
    });
  };
  
  // 終了日を計算
  const calculateEndDate = (): string => {
    if (!startDate || !textbookId || !dailyGoal) return '';
    
    const textbook = textbooks.find(t => t.id === textbookId);
    if (!textbook) return '';
    
    // 教科書の総問題数を取得
    const problemCount = totalProblems || textbook.total_problems;
    
    // 1週間あたりの問題数を計算
    const weeklyProblems = Object.values(weekdayGoals).reduce((sum, count) => sum + count, 0);
    
    if (weeklyProblems <= 0) return '';
    
    // 必要な週数を計算（切り上げ）
    const weeksNeeded = Math.ceil(problemCount / weeklyProblems);
    
    // 開始日から必要な週数分の日数を加算
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + (weeksNeeded * 7) - 1); // 7日 × 週数 - 1
    
    return end.toISOString().split('T')[0];
  };
  
  // データ取得
  useEffect(() => {
    fetchData();
  }, []);
  
  // スケジュールと参考書を取得
  const fetchData = async () => {
    try {
      setLoading(true);
      const [schedulesData, textbooksData] = await Promise.all([
        scheduleService.getSchedules(),
        scheduleService.getTextbooks()
      ]);
      
      setSchedules(schedulesData);
      setTextbooks(textbooksData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('データの取得中にエラーが発生しました');
      setLoading(false);
    }
  };
  
  // モーダルを開く（新規作成）
  const openCreateModal = () => {
    setEditingSchedule(null);
    setTextbookId(undefined);
    setStartDate('');
    setDailyGoal(undefined);
    setBufferDays(0);
    setTotalProblems(undefined);
    setEvenWeekdayGoals(0);
    setIsModalOpen(true);
  };
  
  // モーダルを開く（編集）
  const openEditModal = (schedule: StudySchedule) => {
    setEditingSchedule(schedule);
    setTextbookId(schedule.textbook_id);
    setStartDate(schedule.start_date);
    setDailyGoal(schedule.daily_goal);
    setBufferDays(schedule.buffer_days || 0);
    setTotalProblems(undefined);
    
    // 曜日ごとの問題数を設定（既存のデータがあれば）
    if (schedule.weekday_goals) {
      try {
        const weekdayData = JSON.parse(schedule.weekday_goals);
        if (weekdayData && typeof weekdayData === 'object') {
          setWeekdayGoals(weekdayData);
        } else {
          setEvenWeekdayGoals(schedule.daily_goal || 0);
        }
      } catch (e) {
        // JSONパースエラーの場合は均等に設定
        setEvenWeekdayGoals(schedule.daily_goal || 0);
      }
    } else {
      setEvenWeekdayGoals(schedule.daily_goal || 0);
    }
    
    setIsModalOpen(true);
  };
  
  // スケジュールを保存
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!textbookId || !startDate || !dailyGoal) {
      setError('参考書、開始日、1日の目標問題数は必須です');
      return;
    }
    
    // 曜日ごとの問題数が全て0の場合はエラー
    const totalWeekdayGoals = Object.values(weekdayGoals).reduce((sum, count) => sum + count, 0);
    if (totalWeekdayGoals <= 0) {
      setError('少なくとも1日は問題数を設定してください');
      return;
    }
    
    // 終了日を計算
    const calculatedEndDate = calculateEndDate();
    if (!calculatedEndDate) {
      setError('終了日の計算に失敗しました');
      return;
    }
    
    try {
      const scheduleData: StudySchedule = {
        textbook_id: textbookId,
        start_date: startDate,
        end_date: calculatedEndDate,
        daily_goal: dailyGoal,
        buffer_days: bufferDays,
        weekday_goals: JSON.stringify(weekdayGoals),
        total_problems: totalProblems
      };
      
      if (editingSchedule && editingSchedule.id) {
        // 既存のスケジュールを更新
        await scheduleService.updateSchedule(editingSchedule.id, scheduleData);
      } else {
        // 新しいスケジュールを作成
        await scheduleService.createSchedule(scheduleData);
      }
      
      // スケジュール一覧を再取得
      await fetchData();
      
      // モーダルを閉じる
      setIsModalOpen(false);
      setEditingSchedule(null);
      
    } catch (err) {
      console.error('Error saving schedule:', err);
      setError('スケジュールの保存中にエラーが発生しました');
    }
  };
  
  // スケジュールを削除
  const handleDeleteSchedule = async (id: number) => {
    if (!confirm('このスケジュールを削除してもよろしいですか？')) {
      return;
    }
    
    try {
      await scheduleService.deleteSchedule(id);
      
      // スケジュール一覧を再取得
      await fetchData();
      
    } catch (err) {
      console.error('Error deleting schedule:', err);
      setError('スケジュールの削除中にエラーが発生しました');
    }
  };
  
  // 日数を計算
  const calculateDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // 両端を含める
  };
  
  // 残り日数を計算
  const calculateRemainingDays = (endDate: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    const diffTime = end.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  
  // 進捗状況を計算
  const calculateProgress = (startDate: string, endDate: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (today < start) return 0;
    if (today > end) return 100;
    
    const totalDays = calculateDays(startDate, endDate);
    const elapsedDays = calculateDays(startDate, today.toISOString().split('T')[0]);
    
    return Math.round((elapsedDays / totalDays) * 100);
  };
  
  // 参考書名を取得
  const getTextbookTitle = (id: number): string => {
    const textbook = textbooks.find(t => t.id === id);
    return textbook ? textbook.title : '不明';
  };
  
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
        <button
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark flex items-center"
          onClick={openCreateModal}
        >
          <Plus className="w-4 h-4 mr-2" />
          新規作成
        </button>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      {/* 参考書スケジュールタイムライン */}
      <div className="mb-8">
        <TextbookScheduleTimeline />
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
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
                          {schedule.textbook_title || getTextbookTitle(schedule.textbook_id)}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          className="text-indigo-600 hover:text-indigo-900"
                          onClick={() => openEditModal(schedule)}
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          className="text-red-600 hover:text-red-900"
                          onClick={() => schedule.id && handleDeleteSchedule(schedule.id)}
                        >
                          <Trash className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  スケジュールが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* スケジュール編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingSchedule ? 'スケジュールを編集' : '新しいスケジュールを追加'}
            </h2>
            
            <form onSubmit={handleSaveSchedule}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  参考書
                </label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={textbookId || ''}
                  onChange={(e) => setTextbookId(e.target.value ? Number(e.target.value) : undefined)}
                  required
                >
                  <option value="">参考書を選択してください</option>
                  {textbooks.map((textbook) => (
                    <option key={textbook.id} value={textbook.id}>
                      {textbook.title} ({textbook.subject})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  開始日
                </label>
                <input
                  type="date"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    1日の基本目標問題数
                  </label>
                  <input
                    type="number"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={dailyGoal === undefined ? '' : dailyGoal}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : undefined;
                      setDailyGoal(value);
                      if (value !== undefined) {
                        setEvenWeekdayGoals(value);
                      }
                    }}
                    min={0}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    バッファ日数
                  </label>
                  <input
                    type="number"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={bufferDays}
                    onChange={(e) => setBufferDays(Number(e.target.value))}
                    min={0}
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  総問題数（空欄の場合は参考書の総問題数を使用）
                </label>
                <input
                  type="number"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={totalProblems === undefined ? '' : totalProblems}
                  onChange={(e) => setTotalProblems(e.target.value ? Number(e.target.value) : undefined)}
                  min={1}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  曜日ごとの問題数
                </label>
                <div className="grid grid-cols-7 gap-2">
                  {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                    <div key={index} className="text-center">
                      <div className="mb-1">{day}</div>
                      <input
                        type="number"
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-center"
                        value={weekdayGoals[index as keyof typeof weekdayGoals]}
                        onChange={(e) => {
                          const newValue = Number(e.target.value);
                          setWeekdayGoals(prev => ({
                            ...prev,
                            [index]: newValue >= 0 ? newValue : 0
                          }));
                        }}
                        min={0}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              {startDate && dailyGoal !== undefined && textbookId && (
                <div className="mb-4 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-600">
                    参考書: {getTextbookTitle(textbookId)}
                  </p>
                  <p className="text-sm text-gray-600">
                    1週間の問題数: {Object.values(weekdayGoals).reduce((sum, count) => sum + count, 0)}問
                  </p>
                  {calculateEndDate() && (
                    <>
                      <p className="text-sm text-gray-600">
                        終了日: {calculateEndDate()}
                      </p>
                      <p className="text-sm text-gray-600">
                        期間: {calculateDays(startDate, calculateEndDate())}日間
                      </p>
                    </>
                  )}
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  onClick={() => setIsModalOpen(false)}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulesPage;
