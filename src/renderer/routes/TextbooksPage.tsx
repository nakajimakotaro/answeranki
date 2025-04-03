import { useState, useEffect } from 'react';
import {
  parseISO,
  addDays,
  differenceInDays,
  format,
  compareAsc,
} from 'date-fns';
import { scheduleService, Textbook, StudySchedule } from '../services/scheduleService';
import { ankiConnectService } from '../services/ankiConnectService';
import { BookOpen, Plus, Edit, Trash, Link as LinkIcon, Calendar } from 'lucide-react';

const TextbooksPage = () => {
  // 状態管理
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  // スケジュールモーダル状態
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<StudySchedule | null>(null);
  const [selectedTextbookForSchedule, setSelectedTextbookForSchedule] = useState<Textbook | null>(null);

  // スケジュールフォーム状態
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [scheduleWeekdayGoal, setScheduleWeekdayGoal] = useState<number | undefined>(undefined);
  const [scheduleWeekendGoal, setScheduleWeekendGoal] = useState<number | undefined>(undefined);
  const [scheduleBufferDays, setScheduleBufferDays] = useState(0);
  const [scheduleTotalProblems, setScheduleTotalProblems] = useState<number | undefined>(undefined);
  const [scheduleWeekdayGoals, setScheduleWeekdayGoals] = useState({
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
  });

  // データ取得 (参考書とスケジュール)
  const [schedules, setSchedules] = useState<StudySchedule[]>([]); // スケジュール一覧を保持

  useEffect(() => {
    fetchData();
  }, []);

  // 参考書とスケジュールを取得
  const fetchData = async () => {
    try {
      setLoading(true);
      // timelineEvents からスケジュールのみ取得
      const events = await scheduleService.getTimelineEvents();
      const schedulesData = events
        .filter(event => event.type === 'schedule')
        .map(event => event.details as StudySchedule);
      const textbooksData = await scheduleService.getTextbooks();

      setTextbooks(textbooksData);
      setSchedules(schedulesData); // スケジュールも state に保存
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('データの取得中にエラーが発生しました');
    }
  };

  // 参考書モーダルを開く（新規作成）
  const openCreateTextbookModal = () => {
    setEditingTextbook(null);
    setTitle('');
    setSubject('');
    setTotalProblems(0);
    setIsModalOpen(true);
  };

  // 参考書モーダルを開く（編集）
  const openEditTextbookModal = (textbook: Textbook) => {
    setEditingTextbook(textbook);
    setTitle(textbook.title);
    setSubject(textbook.subject);
    setTotalProblems(textbook.total_problems);
    setIsModalOpen(true);
  };

  // --- スケジュール関連の関数 ---

  // 平日・土日の目標値を曜日別目標に反映する関数
  const updateWeekdayGoalsFromPresets = (weekdayVal: number | undefined, weekendVal: number | undefined) => {
    const newGoals = { ...scheduleWeekdayGoals };
    const wDayVal = weekdayVal === undefined || weekdayVal < 0 ? 0 : weekdayVal;
    const wEndVal = weekendVal === undefined || weekendVal < 0 ? 0 : weekendVal;
    newGoals[1] = wDayVal; // 月
    newGoals[2] = wDayVal; // 火
    newGoals[3] = wDayVal; // 水
    newGoals[4] = wDayVal; // 木
    newGoals[5] = wDayVal; // 金
    newGoals[0] = wEndVal; // 日
    newGoals[6] = wEndVal; // 土
    setScheduleWeekdayGoals(newGoals);
  };


  // 終了日を計算
  const calculateEndDate = (): string => {
    // scheduleDailyGoal の代わりに scheduleWeekdayGoals の合計値で判定
    const totalWeeklyGoals = Object.values(scheduleWeekdayGoals).reduce((sum, count) => sum + count, 0);
    if (!scheduleStartDate || !selectedTextbookForSchedule || totalWeeklyGoals <= 0) return '';

    const textbook = selectedTextbookForSchedule;

    const problemCount = scheduleTotalProblems ?? textbook.total_problems;

    const weeklyProblems = Object.values(scheduleWeekdayGoals).reduce((sum, count) => sum + count, 0);

    if (weeklyProblems <= 0) return '';

    // 必要な週数を計算（切り上げ）
    const weeksNeeded = Math.ceil(problemCount / weeklyProblems);

    const start = parseISO(scheduleStartDate);
    // Removed isValid check for start date derived from state/DB

    const daysToAdd = weeksNeeded * 7 - 1;
    const end = addDays(start, daysToAdd);

    return format(end, 'yyyy-MM-dd');
  };

  // スケジュールモーダルを開く
  const openScheduleModal = (textbook: Textbook) => {
    setSelectedTextbookForSchedule(textbook);
    // 既存のスケジュールを探す
    const existingSchedule = schedules.find(s => s.textbook_id === textbook.id);

    if (existingSchedule) {
      setEditingSchedule(existingSchedule);
      setScheduleStartDate(existingSchedule.start_date);
      setScheduleBufferDays(existingSchedule.buffer_days || 0);
      setScheduleTotalProblems(existingSchedule.total_problems); // スケジュール固有の問題数

      if (existingSchedule.weekday_goals) {
        const weekdayData = JSON.parse(existingSchedule.weekday_goals);
        setScheduleWeekdayGoals(weekdayData);
        setScheduleWeekdayGoal(weekdayData[1] ?? 0);
        setScheduleWeekendGoal(weekdayData[0] ?? 0);
      } else {
        const initialGoal = existingSchedule.daily_goal || 0;
        updateWeekdayGoalsFromPresets(initialGoal, initialGoal);
        setScheduleWeekdayGoal(initialGoal);
        setScheduleWeekendGoal(initialGoal);
      }

    } else {
      // 新規作成の場合
      setEditingSchedule(null);
      setScheduleStartDate('');
      setScheduleWeekdayGoal(undefined);
      setScheduleWeekendGoal(undefined);
      setScheduleBufferDays(0);
      setScheduleTotalProblems(undefined); // 新規作成時は空
      updateWeekdayGoalsFromPresets(undefined, undefined); // 初期化
    }
    setIsScheduleModalOpen(true);
  };

  // スケジュールを保存
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
      setError('終了日の計算に失敗しました');
      return;
    }

    try {
      const scheduleData: StudySchedule = {
        textbook_id: selectedTextbookForSchedule.id!,
        start_date: scheduleStartDate,
        end_date: calculatedEndDate,
        daily_goal: scheduleWeekdayGoal,
        buffer_days: scheduleBufferDays,
        weekday_goals: JSON.stringify(scheduleWeekdayGoals),
        total_problems: scheduleTotalProblems
      };

      if (editingSchedule && editingSchedule.id) {
        await scheduleService.updateSchedule(editingSchedule.id, scheduleData);
      } else {
        await scheduleService.createSchedule(scheduleData);
      }

      await fetchData();

      setIsScheduleModalOpen(false);
      setEditingSchedule(null);
      setSelectedTextbookForSchedule(null);

    } catch (err) {
      console.error('Error saving schedule:', err);
      setError('スケジュールの保存中にエラーが発生しました');
    }
  };

  // Ankiデッキ紐付けモーダルを開く
  const openLinkModal = async (textbook: Textbook) => {
    try {
      setLinkingTextbook(textbook);

      // Ankiデッキ一覧を取得
      const decks = await ankiConnectService.getDeckNames();
      setDeckNames(decks);
      setSelectedDeck(textbook.anki_deck_name || '');

      setIsLinkModalOpen(true);
    } catch (err) {
      console.error('Error fetching Anki decks:', err);
      setError('Ankiデッキの取得中にエラーが発生しました');
    }
  };

  // 参考書を保存
  const handleSaveTextbook = async (e: React.FormEvent) => {
    e.preventDefault();

    // --- Frontend Validation ---
    if (!title || title.trim() === '') {
      setError('タイトルは必須であり、空にできません');
      return; // Prevent form submission
    }
    if (!subject || subject.trim() === '') {
      setError('科目は必須であり、空にできません');
      return; // Prevent form submission
    }
    // Clear previous error if validation passes
    setError(null);
    // --- End Validation ---

    try {
      const textbookData: Textbook = {
        title,
        subject,
        total_problems: totalProblems
      };

      if (editingTextbook && editingTextbook.id) {
        await scheduleService.updateTextbook(editingTextbook.id, textbookData);
      } else {
        await scheduleService.createTextbook(textbookData);
      }

      await fetchData();

      setIsModalOpen(false);
      setEditingTextbook(null);

    } catch (err) {
      console.error('Error saving textbook:', err);
      setError('参考書の保存中にエラーが発生しました');
    }
  };

  // 参考書を削除
  const handleDeleteTextbook = async (id: number) => {
    if (!confirm('この参考書を削除してもよろしいですか？関連するスケジュールや学習ログも削除されます。')) {
      return;
    }

    try {
      await scheduleService.deleteTextbook(id);

      await fetchData();

    } catch (err) {
      console.error('Error deleting textbook:', err);
      setError('参考書の削除中にエラーが発生しました');
    }
  };

  // Ankiデッキと紐付け
  const handleLinkToDeck = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!linkingTextbook || !linkingTextbook.id) {
      return;
    }

    try {
      await scheduleService.linkTextbookToAnkiDeck(linkingTextbook.id, selectedDeck);

      await fetchData();

      setIsLinkModalOpen(false);
      setLinkingTextbook(null);

    } catch (err) {
      console.error('Error linking textbook to Anki deck:', err);
      setError('Ankiデッキとの紐付け中にエラーが発生しました');
    }
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
        <h1 className="text-2xl font-bold">参考書管理</h1>
        <button
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark flex items-center"
          onClick={openCreateTextbookModal}
        >
          <Plus className="w-4 h-4 mr-2" />
          参考書を追加
        </button>
      </div>

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
            {textbooks.length > 0 ? (
              [...textbooks].sort((a, b) => {
                const scheduleA = schedules.find(s => s.textbook_id === a.id);
                const scheduleB = schedules.find(s => s.textbook_id === b.id);

                if (scheduleA && scheduleB) {
                  // Both have schedules: sort by end date ascending
                  const dateA = parseISO(scheduleA.end_date);
                  const dateB = parseISO(scheduleB.end_date);
                  // Removed isValid checks and try...catch - trust DB data
                  return compareAsc(dateA, dateB);
                } else if (scheduleA) {
                  return -1; // Schedules first
                } else if (scheduleB) {
                  return 1; // Schedules first
                } else {
                  // Neither has schedule: sort by title
                  return a.title.localeCompare(b.title);
                }
              }).map((textbook) => {
                const schedule = schedules.find(s => s.textbook_id === textbook.id);
                return (
                <tr key={textbook.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <BookOpen className="h-5 w-5 text-gray-400 mr-2" />
                      <div className="text-sm font-medium text-gray-900">{textbook.title}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{textbook.subject}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{textbook.total_problems}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {textbook.anki_deck_name || '未設定'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {schedule ? `${schedule.start_date} ~ ${schedule.end_date}` : '未設定'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        className="text-green-600 hover:text-green-900"
                        onClick={() => openScheduleModal(textbook)}
                        title="スケジュール設定"
                      >
                        <Calendar className="h-5 w-5" />
                      </button>
                      <button
                        className="text-indigo-600 hover:text-indigo-900"
                        onClick={() => openEditTextbookModal(textbook)}
                        title="参考書編集"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        className="text-blue-600 hover:text-blue-900"
                        onClick={() => openLinkModal(textbook)}
                        title="Ankiデッキ紐付け"
                      >
                        <LinkIcon className="h-5 w-5" />
                      </button>
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={() => textbook.id && handleDeleteTextbook(textbook.id)}
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
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                >
                  保存
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
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                  disabled={!selectedDeck}
                >
                  紐付ける
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* スケジュール編集モーダルを追加 */}
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
                  総問題数（空欄の場合は参考書の総問題数: {selectedTextbookForSchedule.total_problems} を使用）
                </label>
                <input
                  type="number"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={scheduleTotalProblems === undefined ? '' : scheduleTotalProblems}
                  onChange={(e) => setScheduleTotalProblems(e.target.value ? Number(e.target.value) : undefined)}
                  min={1}
                  placeholder={selectedTextbookForSchedule.total_problems.toString()}
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

export default TextbooksPage;
