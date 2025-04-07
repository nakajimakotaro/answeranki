import { useState, useEffect } from 'react';
import {
  parseISO,
  addDays,
  differenceInDays,
  format,
  compareAsc,
} from 'date-fns';
// Removed old scheduleService import comment
import ankiConnectService from '../services/ankiConnectService.js';
import { BookOpen, Plus, Edit, Trash, Link as LinkIcon, Calendar } from 'lucide-react';
import { trpc } from '../lib/trpc.js'; // Import tRPC client
// import type { StudySchedule } from '../types/schedule'; // Removed import - type not found
// Temporary type for StudySchedule
type StudySchedule = any;
// Temporary type for AppRouter to avoid direct server import
type AppRouter = any;
import { inferRouterOutputs } from '@trpc/server';

// Infer Textbook type from the router output (will be 'any' due to AppRouter being 'any')
// This is temporary until proper type sharing is set up
type RouterOutput = inferRouterOutputs<AppRouter>;
// Manually define Textbook type based on expected data structure for now
interface Textbook {
  id: number;
  title: string;
  subject: string;
  total_problems: number | null; // Match Zod schema in router
  anki_deck_name?: string | null;
}


const TextbooksPage = () => {
  // tRPC hooks
  const utils = trpc.useUtils(); // For invalidating queries
  const textbooksQuery = trpc.textbook.getTextbooks.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  const createTextbookMutation = trpc.textbook.createTextbook.useMutation({
    onSuccess: (newTextbook) => {
      utils.textbook.getTextbooks.invalidate(); // Invalidate cache on success
      // Optionally update the cache directly
      // utils.textbook.getTextbooks.setData(undefined, (oldData) =>
      //   oldData ? [...oldData, newTextbook] : [newTextbook]
      // );
      setIsModalOpen(false);
      setEditingTextbook(null);
      setError(null); // Clear previous errors
    },
    onError: (err) => {
      console.error('Error creating textbook:', err);
      setError(`参考書の作成中にエラーが発生しました: ${err.message}`);
    }
  });
  const updateTextbookMutation = trpc.textbook.updateTextbook.useMutation({
     onSuccess: (updatedTextbook) => {
      utils.textbook.getTextbooks.invalidate();
      // Optionally update the cache directly
      // utils.textbook.getTextbooks.setData(undefined, (oldData) =>
      //   oldData?.map((tb) => (tb.id === updatedTextbook.id ? updatedTextbook : tb))
      // );
      setIsModalOpen(false);
      setEditingTextbook(null);
      setError(null); // Clear previous errors
    },
    onError: (err) => {
      console.error('Error updating textbook:', err);
      setError(`参考書の更新中にエラーが発生しました: ${err.message}`);
    }
  });
  const deleteTextbookMutation = trpc.textbook.deleteTextbook.useMutation({
     onSuccess: (_, variables) => {
      utils.textbook.getTextbooks.invalidate();
       // Optionally update the cache directly
      // utils.textbook.getTextbooks.setData(undefined, (oldData) =>
      //   oldData?.filter((tb) => tb.id !== variables.id)
      // );
      // Optionally invalidate schedules/logs if they depend on textbooks
      // utils.schedule.getSchedules.invalidate(); // Assuming schedule router exists
      setError(null); // Clear previous errors
    },
     onError: (err) => {
      console.error('Error deleting textbook:', err);
      setError(`参考書の削除中にエラーが発生しました: ${err.message}`);
    }
  });
   const linkAnkiDeckMutation = trpc.textbook.linkAnkiDeck.useMutation({
     onSuccess: (updatedTextbook) => {
      utils.textbook.getTextbooks.invalidate(); // Invalidate to show updated deck name
      // utils.textbook.getAnkiLinkedTextbooks.invalidate(); // Also invalidate the linked list if used elsewhere
       // Optionally update the cache directly
      // utils.textbook.getTextbooks.setData(undefined, (oldData) =>
      //   oldData?.map((tb) => (tb.id === updatedTextbook.id ? updatedTextbook : tb))
      // );
      setIsLinkModalOpen(false);
      setLinkingTextbook(null);
      setError(null); // Clear previous errors
    },
     onError: (err) => {
      console.error('Error linking Anki deck:', err);
      setError(`Ankiデッキとの紐付け中にエラーが発生しました: ${err.message}`);
    }
  });

  // TODO: Replace schedule fetching/mutations with tRPC hooks once scheduleRouter is implemented
  // const schedulesQuery = trpc.schedule.getSchedules.useQuery();
  // const createScheduleMutation = trpc.schedule.createSchedule.useMutation();
  // const updateScheduleMutation = trpc.schedule.updateSchedule.useMutation();


  // Local state
  const [error, setError] = useState<string | null>(null); // Keep for mutation errors and schedule errors
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [editingTextbook, setEditingTextbook] = useState<Textbook | null>(null);
  const [linkingTextbook, setLinkingTextbook] = useState<Textbook | null>(null);
  const [deckNames, setDeckNames] = useState<string[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string>('');

  // 参考書フォーム状態
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [totalProblems, setTotalProblems] = useState(0);

  // スケジュールモーダル状態 (Keep as is for now)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<StudySchedule | null>(null);
  const [selectedTextbookForSchedule, setSelectedTextbookForSchedule] = useState<Textbook | null>(null);

  // スケジュールフォーム状態 (Keep as is for now)
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [scheduleWeekdayGoal, setScheduleWeekdayGoal] = useState<number | undefined>(undefined);
  const [scheduleWeekendGoal, setScheduleWeekendGoal] = useState<number | undefined>(undefined);
  const [scheduleBufferDays, setScheduleBufferDays] = useState(0);
  const [scheduleTotalProblems, setScheduleTotalProblems] = useState<number | undefined>(undefined);
  const [scheduleWeekdayGoals, setScheduleWeekdayGoals] = useState({
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
  });

  // データ取得 (スケジュールのみ - 参考書は tRPC hook で取得)
  const [schedules, setSchedules] = useState<StudySchedule[]>([]); // スケジュール一覧を保持 (Keep for now)
  const [scheduleLoading, setScheduleLoading] = useState(true); // Separate loading for schedules

  // TODO: Replace with tRPC query for schedules once implemented
  useEffect(() => {
    const fetchSchedules = async () => {
       try {
         setScheduleLoading(true);
         // Placeholder: Schedule fetching logic needs to be implemented using tRPC hooks/queries.
         // const schedulesData = await trpc.schedule.getSchedules.query(); // Example tRPC call
         // setSchedules(schedulesData);

         // Removed old scheduleService related comments and warnings.
         // Simulate fetching schedules for now
         await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
         setSchedules([]); // Set to empty array as placeholder
         setScheduleLoading(false);


       } catch (err) {
         console.error('Error fetching schedules:', err);
         setError('スケジュールデータの取得中にエラーが発生しました');
         setScheduleLoading(false);
       }
     };
     fetchSchedules();
  }, []); // Dependency array might need adjustment based on tRPC implementation

  // 参考書モーダルを開く（新規作成）
  const openCreateTextbookModal = () => {
    setEditingTextbook(null);
    setTitle('');
    setSubject('');
    setTotalProblems(0);
    setError(null); // Clear errors when opening modal
    setIsModalOpen(true);
  };

  // 参考書モーダルを開く（編集）
  const openEditTextbookModal = (textbook: Textbook) => {
    setEditingTextbook(textbook);
    setTitle(textbook.title);
    setSubject(textbook.subject);
    setTotalProblems(textbook.total_problems ?? 0); // Use nullish coalescing
    setError(null); // Clear errors when opening modal
    setIsModalOpen(true);
  };

  // --- スケジュール関連の関数 (Keep as is for now) ---

  const updateWeekdayGoalsFromPresets = (weekdayVal: number | undefined, weekendVal: number | undefined) => {
    const newGoals = { ...scheduleWeekdayGoals };
    const wDayVal = weekdayVal === undefined || weekdayVal < 0 ? 0 : weekdayVal;
    const wEndVal = weekendVal === undefined || weekendVal < 0 ? 0 : weekendVal;
    newGoals[1] = wDayVal; newGoals[2] = wDayVal; newGoals[3] = wDayVal;
    newGoals[4] = wDayVal; newGoals[5] = wDayVal;
    newGoals[0] = wEndVal; newGoals[6] = wEndVal;
    setScheduleWeekdayGoals(newGoals);
  };

  const calculateEndDate = (): string => {
    const totalWeeklyGoals = Object.values(scheduleWeekdayGoals).reduce((sum, count) => sum + count, 0);
    if (!scheduleStartDate || !selectedTextbookForSchedule || totalWeeklyGoals <= 0) return '';
    const textbook = selectedTextbookForSchedule;
    const problemCount = scheduleTotalProblems ?? textbook.total_problems ?? 0; // Use nullish coalescing
    if (problemCount <= 0) return ''; // Cannot calculate if total problems is 0
    const weeklyProblems = totalWeeklyGoals;
    if (weeklyProblems <= 0) return '';
    const weeksNeeded = Math.ceil(problemCount / weeklyProblems);
    const start = parseISO(scheduleStartDate);
    const daysToAdd = weeksNeeded * 7 - 1 + scheduleBufferDays; // Add buffer days
    const end = addDays(start, daysToAdd);
    return format(end, 'yyyy-MM-dd');
  };

  const openScheduleModal = (textbook: Textbook) => {
    setSelectedTextbookForSchedule(textbook);
    const existingSchedule = schedules.find(s => s.textbook_id === textbook.id);
    if (existingSchedule) {
      setEditingSchedule(existingSchedule);
      setScheduleStartDate(existingSchedule.start_date);
      setScheduleBufferDays(existingSchedule.buffer_days || 0);
      setScheduleTotalProblems(existingSchedule.total_problems);
      if (existingSchedule.weekday_goals) {
        try {
          const weekdayData = JSON.parse(existingSchedule.weekday_goals);
          setScheduleWeekdayGoals(weekdayData);
          setScheduleWeekdayGoal(weekdayData[1] ?? 0);
          setScheduleWeekendGoal(weekdayData[0] ?? 0);
        } catch (e) {
          console.error("Failed to parse weekday_goals", e);
          // Fallback if parsing fails
          const initialGoal = existingSchedule.daily_goal || 0;
          updateWeekdayGoalsFromPresets(initialGoal, initialGoal);
          setScheduleWeekdayGoal(initialGoal);
          setScheduleWeekendGoal(initialGoal);
        }
      } else {
        const initialGoal = existingSchedule.daily_goal || 0;
        updateWeekdayGoalsFromPresets(initialGoal, initialGoal);
        setScheduleWeekdayGoal(initialGoal);
        setScheduleWeekendGoal(initialGoal);
      }
    } else {
      setEditingSchedule(null);
      setScheduleStartDate('');
      setScheduleWeekdayGoal(undefined);
      setScheduleWeekendGoal(undefined);
      setScheduleBufferDays(0);
      setScheduleTotalProblems(undefined);
      updateWeekdayGoalsFromPresets(undefined, undefined);
    }
    setError(null); // Clear errors
    setIsScheduleModalOpen(true);
  };

  // スケジュールを保存 (TODO: Update with tRPC)
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTextbookForSchedule || !scheduleStartDate || scheduleWeekdayGoal === undefined || scheduleWeekendGoal === undefined) {
      setError('開始日、平日・土日の目標問題数は必須です');
      return;
    }
    const totalWeekdayGoals = Object.values(scheduleWeekdayGoals).reduce((sum, count) => sum + count, 0);
    if (totalWeekdayGoals <= 0) {
      setError('少なくとも1日は問題数を設定してください');
      return;
    }
    const calculatedEndDate = calculateEndDate();
    if (!calculatedEndDate) {
      setError('終了日の計算に失敗しました。問題数や目標値を確認してください。');
      return;
    }
    setError(null); // Clear error before trying to save

    try {
      const scheduleData: Omit<StudySchedule, 'id'> = { // Use Omit for creation data
        textbook_id: selectedTextbookForSchedule.id!,
        start_date: scheduleStartDate,
        end_date: calculatedEndDate,
        daily_goal: scheduleWeekdayGoal, // Keep for potential fallback or info?
        buffer_days: scheduleBufferDays,
        weekday_goals: JSON.stringify(scheduleWeekdayGoals),
        total_problems: scheduleTotalProblems
      };

      // TODO: Replace with tRPC mutations for schedules once implemented
      if (editingSchedule && editingSchedule.id) {
        // await updateScheduleMutation.mutateAsync({ id: editingSchedule.id, ...scheduleData }); // Example tRPC call
        alert("Schedule update not implemented with tRPC yet."); // Placeholder alert
      } else {
        // await createScheduleMutation.mutateAsync(scheduleData); // Example tRPC call
         alert("Schedule creation not implemented with tRPC yet."); // Placeholder alert
      }

      // Invalidate schedule query after mutation (once implemented)
      // utils.schedule.getSchedules.invalidate();

      // Simulate success for now
      setIsScheduleModalOpen(false);
      setEditingSchedule(null);
      setSelectedTextbookForSchedule(null);
      // Manually refetch schedules for now
      // await fetchSchedules(); // Need to define fetchSchedules outside useEffect or pass it

    } catch (err) {
      console.error('Error saving schedule:', err);
      setError(`スケジュールの保存中にエラーが発生しました: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Ankiデッキ紐付けモーダルを開く
  const openLinkModal = async (textbook: Textbook) => {
    try {
      setLinkingTextbook(textbook);
      const decks = await ankiConnectService.getDeckNames(); // Keep using AnkiConnect service
      setDeckNames(decks);
      setSelectedDeck(textbook.anki_deck_name || '');
      setError(null); // Clear errors
      setIsLinkModalOpen(true);
    } catch (err) {
      console.error('Error fetching Anki decks:', err);
      setError('Ankiデッキの取得中にエラーが発生しました');
    }
  };

  // 参考書を保存 (Uses tRPC mutation)
  const handleSaveTextbook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || title.trim() === '') {
      setError('タイトルは必須であり、空にできません');
      return;
    }
    if (!subject || subject.trim() === '') {
      setError('科目は必須であり、空にできません');
      return;
    }
    setError(null);

    if (editingTextbook && editingTextbook.id) {
      updateTextbookMutation.mutate({
        id: editingTextbook.id,
        title,
        subject,
        total_problems: totalProblems,
        anki_deck_name: editingTextbook.anki_deck_name // Keep existing deck name
      });
    } else {
      createTextbookMutation.mutate({
        title,
        subject,
        total_problems: totalProblems,
        // anki_deck_name is initially null/undefined
      });
    }
    // onSuccess/onError handlers in mutations handle UI updates
  };

  // 参考書を削除 (Uses tRPC mutation)
  const handleDeleteTextbook = (id: number) => {
    if (!confirm('この参考書を削除してもよろしいですか？関連するスケジュールや学習ログも削除される可能性があります。')) {
      return;
    }
    setError(null); // Clear previous errors
    deleteTextbookMutation.mutate({ id });
    // onSuccess/onError handlers in mutation handle UI updates
  };

  // Ankiデッキと紐付け (Uses tRPC mutation)
  const handleLinkToDeck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingTextbook || !linkingTextbook.id || !selectedDeck) {
       setError('デッキを選択してください。');
      return;
    }
    setError(null); // Clear previous errors
    linkAnkiDeckMutation.mutate({ textbookId: linkingTextbook.id, deckName: selectedDeck });
    // onSuccess/onError handlers in mutation handle UI updates
  };

  // Use query loading state
  if (textbooksQuery.isLoading || scheduleLoading) { // Check both loading states
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">参考書管理</h1>
        <button
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark flex items-center"
          onClick={openCreateTextbookModal}
        >
          <Plus className="w-4 h-4 mr-2" />
          参考書を追加
        </button>
      </div>

      {/* Display query error */}
      {textbooksQuery.error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          参考書データの取得エラー: {textbooksQuery.error.message}
        </div>
      )}
       {/* Display mutation/schedule error */}
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* 参考書一覧 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイトル</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">問題数</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ankiデッキ</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">スケジュール</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Use data from tRPC query */}
            {textbooksQuery.data && textbooksQuery.data.length > 0 ? (
              [...textbooksQuery.data].sort((a, b) => {
                const scheduleA = schedules.find(s => s.textbook_id === a.id); // Keep using local schedule state for now
                const scheduleB = schedules.find(s => s.textbook_id === b.id); // Keep using local schedule state for now

                if (scheduleA && scheduleB) {
                  try {
                    const dateA = parseISO(scheduleA.end_date);
                    const dateB = parseISO(scheduleB.end_date);
                    return compareAsc(dateA, dateB);
                  } catch (e) {
                     console.error("Error parsing schedule dates for sorting", e);
                     return 0; // Keep original order if dates are invalid
                  }
                } else if (scheduleA) {
                  return -1; // Schedules first
                } else if (scheduleB) {
                  return 1; // Schedules first
                } else {
                  return a.title.localeCompare(b.title);
                }
              }).map((textbook) => { // textbook type is inferred from textbooksQuery.data
                const schedule = schedules.find(s => s.textbook_id === textbook.id); // Keep using local schedule state for now
                return (
                <tr key={textbook.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <BookOpen className="h-5 w-5 text-gray-400 mr-2" />
                      <div className="text-sm font-medium text-gray-900">{textbook.title}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{textbook.subject}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{textbook.total_problems ?? 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {textbook.anki_deck_name || '未設定'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {schedule ? `${schedule.start_date} ~ ${schedule.end_date}` : '未設定'} {/* Keep using local schedule state */}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        className="text-green-600 hover:text-green-900"
                        onClick={() => openScheduleModal(textbook)} // Pass textbook from query data
                        title="スケジュール設定"
                      >
                        <Calendar className="h-5 w-5" />
                      </button>
                      <button
                        className="text-indigo-600 hover:text-indigo-900"
                        onClick={() => openEditTextbookModal(textbook)} // Pass textbook from query data
                        title="参考書編集"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        className="text-blue-600 hover:text-blue-900"
                        onClick={() => openLinkModal(textbook)} // Pass textbook from query data
                        title="Ankiデッキ紐付け"
                      >
                        <LinkIcon className="h-5 w-5" />
                      </button>
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={() => handleDeleteTextbook(textbook.id)} // Pass id directly
                        title="参考書削除"
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
                  参考書が登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 参考書編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingTextbook ? '参考書を編集' : '新しい参考書を追加'}
            </h2>

            <form onSubmit={handleSaveTextbook}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイトル
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  科目
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  総問題数
                </label>
                <input
                  type="number"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={totalProblems}
                  onChange={(e) => setTotalProblems(Number(e.target.value))}
                  min={0}
                />
              </div>

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
                  className={`px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark ${
                    createTextbookMutation.isPending || updateTextbookMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={createTextbookMutation.isPending || updateTextbookMutation.isPending}
                >
                  {createTextbookMutation.isPending || updateTextbookMutation.isPending ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ankiデッキ紐付けモーダル */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              Ankiデッキと紐付ける
            </h2>

            <p className="mb-4 text-sm text-gray-600">
              参考書「{linkingTextbook?.title}」をAnkiデッキと紐付けます。
            </p>

            <form onSubmit={handleLinkToDeck}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ankiデッキ
                </label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={selectedDeck}
                  onChange={(e) => setSelectedDeck(e.target.value)}
                >
                  <option value="">デッキを選択してください</option>
                  {deckNames.map((deck) => (
                    <option key={deck} value={deck}>
                      {deck}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  onClick={() => setIsLinkModalOpen(false)}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark ${
                     linkAnkiDeckMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={!selectedDeck || linkAnkiDeckMutation.isPending}
                >
                  {linkAnkiDeckMutation.isPending ? '紐付け中...' : '紐付ける'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* スケジュール編集モーダル (Keep as is for now) */}
      {isScheduleModalOpen && selectedTextbookForSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingSchedule ? 'スケジュールを編集' : '新しいスケジュールを追加'}
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              参考書: {selectedTextbookForSchedule.title} ({selectedTextbookForSchedule.subject})
            </p>

            <form onSubmit={handleSaveSchedule}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  開始日
                </label>
                <input
                  type="date"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={scheduleStartDate}
                  onChange={(e) => setScheduleStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    平日の基本目標問題数
                  </label>
                  <input
                    type="number"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={scheduleWeekdayGoal === undefined ? '' : scheduleWeekdayGoal}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : undefined;
                      setScheduleWeekdayGoal(value);
                      updateWeekdayGoalsFromPresets(value, scheduleWeekendGoal);
                    }}
                    min={0}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    土日の基本目標問題数
                  </label>
                  <input
                    type="number"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={scheduleWeekendGoal === undefined ? '' : scheduleWeekendGoal}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : undefined;
                      setScheduleWeekendGoal(value);
                      updateWeekdayGoalsFromPresets(scheduleWeekdayGoal, value);
                    }}
                    min={0}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    バッファ日数
                  </label>
                  <input
                    type="number"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={scheduleBufferDays}
                    onChange={(e) => setScheduleBufferDays(Number(e.target.value))}
                    min={0}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  総問題数（空欄の場合は参考書の総問題数: {selectedTextbookForSchedule.total_problems ?? 0} を使用）
                </label>
                <input
                  type="number"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={scheduleTotalProblems === undefined ? '' : scheduleTotalProblems}
                  onChange={(e) => setScheduleTotalProblems(e.target.value ? Number(e.target.value) : undefined)}
                  min={1}
                  placeholder={(selectedTextbookForSchedule.total_problems ?? 0).toString()}
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
                        value={scheduleWeekdayGoals[index as keyof typeof scheduleWeekdayGoals]}
                        onChange={(e) => {
                          const newValue = Number(e.target.value);
                          setScheduleWeekdayGoals(prev => ({
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

              {scheduleStartDate && (scheduleWeekdayGoal !== undefined || scheduleWeekendGoal !== undefined) && (
                <div className="mb-4 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-600">
                    1週間の合計問題数: {Object.values(scheduleWeekdayGoals).reduce((sum, count) => sum + count, 0)}問
                  </p>
                  {calculateEndDate() && (
                    <>
                      <p className="text-sm text-gray-600">
                        終了日: {calculateEndDate()}
                      </p>
                      <p className="text-sm text-gray-600">
                        期間: {differenceInDays(parseISO(calculateEndDate()), parseISO(scheduleStartDate)) + 1}日間
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  onClick={() => setIsScheduleModalOpen(false)}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                  // TODO: Add disabled state based on schedule mutation pending status
                >
                  保存 {/* TODO: Add loading text */}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextbooksPage;
