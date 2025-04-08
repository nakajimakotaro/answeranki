import { useState, useEffect } from 'react';
import {
  parseISO,
  addDays,
  differenceInDays,
  format,
  compareAsc,
} from 'date-fns';
import ankiConnectService from '../services/ankiConnectService.js';
import { BookOpen, Plus, Edit, Trash, Link as LinkIcon, Calendar } from 'lucide-react';
import { trpc } from '../lib/trpc.js'; // Import tRPC client
import { StudyScheduleSchema, StudyScheduleInputSchema, StudyScheduleUpdateSchema } from '@answeranki/shared/schemas/schedule'; // Import shared Zod schemas
import { z } from 'zod';
import { inferRouterOutputs } from '@trpc/server'; // Import inferRouterOutputs
import type { AppRouter } from '../../../../server/src/router.js'; // Match the path used in trpc.ts

// Infer types from Zod schemas and tRPC router
type StudySchedule = z.infer<typeof StudyScheduleSchema>;
type RouterOutput = inferRouterOutputs<AppRouter>;
type Textbook = RouterOutput['textbook']['getTextbooks'][number]; // Correctly infer Textbook type


const TextbooksPage = () => {
  // tRPC hooks
  const utils = trpc.useUtils(); // For invalidating queries
  const textbooksQuery = trpc.textbook.getTextbooks.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  const createTextbookMutation = trpc.textbook.createTextbook.useMutation({
    onSuccess: (newTextbook) => {
      utils.textbook.getTextbooks.invalidate(); // Invalidate cache on success
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
      setError(null);
    },
     onError: (err) => {
      console.error('Error deleting textbook:', err);
      setError(`参考書の削除中にエラーが発生しました: ${err.message}`);
    }
  });
   const linkAnkiDeckMutation = trpc.textbook.linkAnkiDeck.useMutation({
     onSuccess: (updatedTextbook) => {
      utils.textbook.getTextbooks.invalidate();

      setIsLinkModalOpen(false);
      setLinkingTextbook(null);
      setError(null); // Clear previous errors
    },
     onError: (err) => {
      console.error('Error linking Anki deck:', err);
      setError(`Ankiデッキとの紐付け中にエラーが発生しました: ${err.message}`);
    }
  });
  // Schedule tRPC hooks
  const schedulesQuery = trpc.schedule.listSchedules.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  const createScheduleMutation = trpc.schedule.createSchedule.useMutation({
    onSuccess: () => {
      utils.schedule.listSchedules.invalidate(); // Invalidate schedule list
      setIsScheduleModalOpen(false);
      setEditingSchedule(null);
      setSelectedTextbookForSchedule(null);
      setError(null);
    },
    onError: (err) => {
      console.error('Error creating schedule:', err);
      setError(`スケジュールの作成中にエラーが発生しました: ${err.message}`);
    }
  });
  const updateScheduleMutation = trpc.schedule.updateSchedule.useMutation({
    onSuccess: () => {
      utils.schedule.listSchedules.invalidate(); // Invalidate schedule list
      setIsScheduleModalOpen(false);
      setEditingSchedule(null);
      setSelectedTextbookForSchedule(null);
      setError(null);
    },
    onError: (err) => {
      console.error('Error updating schedule:', err);
      setError(`スケジュールの更新中にエラーが発生しました: ${err.message}`);
    }
  });


  // Local state
  const [error, setError] = useState<string | null>(null); // Keep for mutation errors and other non-tRPC errors
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

  // 参考書モーダルを開く
  const openCreateTextbookModal = () => {
    setEditingTextbook(null);
    setTitle('');
    setSubject('');
    setTotalProblems(0);
    setError(null);
    setIsModalOpen(true);
  };

  // 参考書モーダルを開く
  const openEditTextbookModal = (textbook: Textbook) => {
    setEditingTextbook(textbook);
    setTitle(textbook.title);
    setSubject(textbook.subject);
    setTotalProblems(textbook.total_problems ?? 0);
    setError(null);
    setIsModalOpen(true);
  };

  // --- スケジュール関連の関数

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
    const problemCount = scheduleTotalProblems ?? textbook.total_problems ?? 0;
    if (problemCount <= 0) return '';
    const weeklyProblems = totalWeeklyGoals;
    if (weeklyProblems <= 0) return '';
    const weeksNeeded = Math.ceil(problemCount / weeklyProblems);
    const start = parseISO(scheduleStartDate);
    const daysToAdd = weeksNeeded * 7 - 1 + scheduleBufferDays;
    const end = addDays(start, daysToAdd);
    return format(end, 'yyyy-MM-dd');
  };

  const openScheduleModal = (textbook: Textbook) => {
    setSelectedTextbookForSchedule(textbook);
    const existingSchedule = schedulesQuery.data?.find(s => s.textbook_id === textbook.id);
    if (existingSchedule) {
      setEditingSchedule(existingSchedule);
      setScheduleStartDate(format(existingSchedule.start_date, 'yyyy-MM-dd'));
      setScheduleBufferDays(existingSchedule.buffer_days ?? 0);
      setScheduleTotalProblems(existingSchedule.total_problems ?? undefined);

      // Reset goals before attempting to parse/set
      const initialGoal = existingSchedule.daily_goal ?? 0;
      updateWeekdayGoalsFromPresets(initialGoal, initialGoal);
      setScheduleWeekdayGoal(initialGoal);
      setScheduleWeekendGoal(initialGoal);

      if (existingSchedule.weekday_goals) {
        // Parse the JSON string. If parsing fails, an error will naturally occur and propagate.
        const weekdayData = JSON.parse(existingSchedule.weekday_goals);
        // Assume the parsed data has the correct structure.
        // If not, accessing properties might result in `undefined` or errors, which is acceptable per Principle 6.
        setScheduleWeekdayGoals(weekdayData);
        setScheduleWeekdayGoal(weekdayData[1]); // Monday (or undefined if structure is wrong)
        setScheduleWeekendGoal(weekdayData[0]); // Sunday (or undefined if structure is wrong)
      }
      // If weekday_goals is null/empty, the initial goals based on daily_goal remain set.
    } else {
      setEditingSchedule(null);
      // Reset all schedule fields for new schedule
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

  // スケジュールを保存 (Using tRPC)
  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTextbookForSchedule || !scheduleStartDate || scheduleWeekdayGoal === undefined || scheduleWeekendGoal === undefined) {
      setError('開始日、平日・土日の基本目標問題数は必須です');
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
    setError(null); // Clear local error state

    // Convert date strings to Date objects before creating payload
    let startDateObject: Date;
    let endDateObject: Date;
    try {
        startDateObject = parseISO(scheduleStartDate);
        endDateObject = parseISO(calculatedEndDate);
        if (isNaN(startDateObject.getTime()) || isNaN(endDateObject.getTime())) {
            throw new Error('Invalid date value');
        }
    } catch (error) {
        setError('無効な日付形式です。yyyy-MM-dd形式で入力してください。');
        return;
    }

    const schedulePayloadBase = {
      textbook_id: selectedTextbookForSchedule.id,
      start_date: startDateObject, // Use Date object
      end_date: endDateObject,     // Use Date object
      daily_goal: scheduleWeekdayGoal, // Keep for info, but weekday_goals is primary
      buffer_days: scheduleBufferDays,
      weekday_goals: JSON.stringify(scheduleWeekdayGoals),
      total_problems: scheduleTotalProblems,
    };

    if (editingSchedule && editingSchedule.id) {
      // Update existing schedule
      const updatePayload = {
        id: editingSchedule.id,
        ...schedulePayloadBase, // Use payload with Date objects
      };
      // Validate with Zod before sending
      const validationResult = StudyScheduleUpdateSchema.safeParse(updatePayload);
      if (!validationResult.success) {
        setError(`入力内容が無効です: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
        return;
      }
      updateScheduleMutation.mutate(validationResult.data);
    } else {
      // Create new schedule
      // Validate with Zod before sending
      const validationResult = StudyScheduleInputSchema.safeParse(schedulePayloadBase); // Use payload with Date objects
       if (!validationResult.success) {
        setError(`入力内容が無効です: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
        return;
      }
      createScheduleMutation.mutate(validationResult.data);
    }
    // Modal closing and state reset is handled in mutation's onSuccess
  };

  // Ankiデッキ紐付けモーダルを開く
  const openLinkModal = async (textbook: Textbook) => {
    setLinkingTextbook(textbook);
    setError(null); // Clear previous UI errors if any
    // Let potential errors from getDeckNames propagate up to React Query/global handlers.
    const decks = await ankiConnectService.getDeckNames();
    setDeckNames(decks);
    setSelectedDeck(textbook.anki_deck_name || '');
    setIsLinkModalOpen(true);
    // If getDeckNames fails, setIsLinkModalOpen(true) will not be reached.
  };

  // 参考書を保存
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
        anki_deck_name: editingTextbook.anki_deck_name
      });
    } else {
      createTextbookMutation.mutate({
        title,
        subject,
        total_problems: totalProblems,
        anki_deck_name: null,
      });
    }
  };

  // 参考書を削除
  const handleDeleteTextbook = (id: number) => {
    if (!confirm('この参考書を削除してもよろしいですか？関連するスケジュールや学習ログも削除される可能性があります。')) {
      return;
    }
    setError(null);
    deleteTextbookMutation.mutate({ id });
  };

  // Ankiデッキと紐付け
  const handleLinkToDeck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingTextbook || !linkingTextbook.id || !selectedDeck) {
       setError('デッキを選択してください。');
      return;
    }
    setError(null);
    linkAnkiDeckMutation.mutate({ textbookId: linkingTextbook.id, deckName: selectedDeck });
  };

  // Use combined query loading state
  if (textbooksQuery.isLoading || schedulesQuery.isLoading) {
    return (
      <div className="flex justify-center items-center h-screen"> {/* Use h-screen for full height */}
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
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

      {/* Display query errors */}
      {(textbooksQuery.error || schedulesQuery.error) && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          データ取得エラー:
          {textbooksQuery.error && ` 参考書: ${textbooksQuery.error.message}`}
          {schedulesQuery.error && ` スケジュール: ${schedulesQuery.error.message}`}
        </div>
      )}
       {/* Display mutation/local error */}
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          エラー: {error}
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
            {/* Use data from tRPC queries */}
            {textbooksQuery.data && textbooksQuery.data.length > 0 ? (
              [...textbooksQuery.data].sort((a, b) => {
                // Use schedule data from schedulesQuery
                const scheduleA = schedulesQuery.data?.find(s => s.textbook_id === a.id);
                const scheduleB = schedulesQuery.data?.find(s => s.textbook_id === b.id);

                // Compare end dates if both schedules exist
                if (scheduleA && scheduleB && scheduleA.end_date && scheduleB.end_date) {
                  // Dates are already strings 'YYYY-MM-DD', direct comparison works
                  if (scheduleA.end_date < scheduleB.end_date) return -1;
                  if (scheduleA.end_date > scheduleB.end_date) return 1;
                  // If end dates are the same, sort by start date
                  if (scheduleA.start_date < scheduleB.start_date) return -1;
                  if (scheduleA.start_date > scheduleB.start_date) return 1;
                  return 0; // Should ideally not happen if dates are unique per textbook
                } else if (scheduleA) {
                  return -1; // Textbooks with schedules first
                } else if (scheduleB) {
                  return 1; // Textbooks with schedules first
                } else {
                  return a.title.localeCompare(b.title); // Fallback to title sort
                }
              }).map((textbook) => {
                // Find schedule using data from schedulesQuery
                const schedule = schedulesQuery.data?.find(s => s.textbook_id === textbook.id);
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
                    {textbook.anki_deck_name || <span className="text-gray-400 italic">未設定</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {schedule ? `${format(schedule.start_date, 'MM/dd')} ~ ${format(schedule.end_date, 'MM/dd')}` : <span className="text-gray-400 italic">未設定</span>}
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
                  className={`px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark ${
                    createScheduleMutation.isPending || updateScheduleMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={createScheduleMutation.isPending || updateScheduleMutation.isPending}
                >
                  {createScheduleMutation.isPending || updateScheduleMutation.isPending ? '保存中...' : '保存'}
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
