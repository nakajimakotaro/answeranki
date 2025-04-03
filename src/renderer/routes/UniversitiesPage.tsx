import { useState, useEffect } from 'react';
import { parseISO, differenceInDays, startOfToday, isBefore, isValid, format } from 'date-fns'; // Import date-fns functions, add format
import { scheduleService, University, TimelineEvent } from '../services/scheduleService'; // Removed ExamDate import
import { examService } from '../services/examService'; // Import examService
import { Exam, ExamInput } from '../../../shared/types/exam'; // Import shared Exam and ExamInput types
// UniversityExamType might still be used for the dropdown, keep it for now or replace if needed
import { UniversityExamType } from '../types/schedule';
import { GraduationCap, Plus, Edit, Trash, Calendar } from 'lucide-react';

const UniversitiesPage = () => {
  // 状態管理
  const [universities, setUniversities] = useState<University[]>([]);
  const [exams, setExams] = useState<Exam[]>([]); // Use shared Exam type
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUniversityModalOpen, setIsUniversityModalOpen] = useState(false);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingUniversity, setEditingUniversity] = useState<University | null>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null); // Use shared Exam type

  // 大学フォーム状態
  const [name, setName] = useState('');
  const [rank, setRank] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState('');
  
  // 受験日フォーム状態
  const [universityId, setUniversityId] = useState<number | undefined>(undefined);
  const [examDate, setExamDate] = useState('');
  // Initialize with a default valid value or handle empty string case
  const [examType, setExamType] = useState<UniversityExamType | ''>(''); // Allow empty string initially
  
  // データ取得
  useEffect(() => {
    fetchData();
  }, []);
  
  // 大学と受験日を取得
  const fetchData = async () => {
    try {
      setLoading(true);
      // getUniversities と getTimelineEvents を並行して取得
      const [universitiesData, timelineEvents] = await Promise.all([
        scheduleService.getUniversities(),
        scheduleService.getTimelineEvents() // getExams() から変更
      ]);

      // timelineEvents から exam タイプのデータのみを抽出
      // TimelineEvent の details が Exam 型であることを想定
      const examsData = timelineEvents
        .filter((event): event is TimelineEvent & { details: Exam } => event.type === 'exam' || event.type === 'mock_exam') // Include mock exams too
        .map(event => {
          // event.id (例: "exam-5") から数値のIDを抽出 (Ensure details has id)
          const examId = event.details.id; // Use id directly from details
          // 大学名を取得
          const universityName = universitiesData.find(u => u.id === event.details.university_id)?.name;
          return {
            ...event.details,
            id: examId, // 数値のIDを設定
            university_name: universityName // 大学名を設定
          };
        });

      setUniversities(universitiesData);
      setExams(examsData); // 抽出した受験日データをセット
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('データの取得中にエラーが発生しました');
      setLoading(false);
    }
  };
  
  // 大学モーダルを開く（新規作成）
  const openCreateUniversityModal = () => {
    setEditingUniversity(null);
    setName('');
    setRank(undefined);
    setNotes('');
    setIsUniversityModalOpen(true);
  };
  
  // 大学モーダルを開く（編集）
  const openEditUniversityModal = (university: University) => {
    setEditingUniversity(university);
    setName(university.name);
    setRank(university.rank);
    setNotes(university.notes || '');
    setIsUniversityModalOpen(true);
  };
  
  // 受験日モーダルを開く（新規作成）
  const openCreateExamModal = (university?: University) => {
    setEditingExam(null);
    setUniversityId(university?.id);
    setExamDate('');
    setExamType(''); // Reset to empty string
    setIsExamModalOpen(true);
  };
  
  // 受験日モーダルを開く（編集）
  const openEditExamModal = (exam: Exam) => { // Use shared Exam type
    setEditingExam(exam);
    setUniversityId(exam.university_id ?? undefined); // Handle null case
    setExamDate(exam.date); // Use 'date'
    // exam.exam_type is now string, need to check if it's a valid UniversityExamType for the dropdown
    // If the dropdown uses UniversityExamType, we might need a mapping or ensure DB stores compatible values
    // For now, assume it might be compatible or handle potential mismatch
    setExamType(exam.exam_type as UniversityExamType | ''); // Cast for now, might need refinement
    setIsExamModalOpen(true);
  };

  // 大学を保存
  const handleSaveUniversity = async (e: React.FormEvent) => {
    e.preventDefault();

    // --- Frontend Validation ---
    if (!name || name.trim() === '') {
      setError('大学名は必須であり、空にできません');
      return; // Prevent form submission
    }
    // Clear previous error if validation passes
    setError(null);
    // --- End Validation ---
    
    try {
      const universityData: University = {
        name,
        rank,
        notes: notes || undefined
      };
      
      if (editingUniversity && editingUniversity.id) {
        // 既存の大学を更新
        await scheduleService.updateUniversity(editingUniversity.id, universityData);
      } else {
        // 新しい大学を作成
        await scheduleService.createUniversity(universityData);
      }
      
      // データを再取得
      await fetchData();
      
      // モーダルを閉じる
      setIsUniversityModalOpen(false);
      setEditingUniversity(null);
      
    } catch (err) {
      console.error('Error saving university:', err);
      setError('大学の保存中にエラーが発生しました');
    }
  };
  
  // 受験日を保存
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if examType is a valid UniversityExamType before proceeding
    if (!examType) {
      setError('試験種別を選択してください');
      return;
    }

    // 模試の場合は大学IDは必須ではない
    if (examType !== '模試' && !universityId) {
      setError('大学は必須です');
      return;
    }
    
    if (!examDate || !examType) {
      setError('受験日と試験種別は必須です');
      return;
    }
    
    try {
      // Ensure examType is not an empty string before creating examData
      if (!examType) {
        // This case should be caught by the earlier check, but adding for safety
        setError('試験種別が選択されていません');
        return;
      }
      // Use ExamInput type and correct properties
      const examData: ExamInput = {
        name: `${universities.find(u => u.id === universityId)?.name || '模試'} ${examType}`, // Generate a name
        date: examDate,
        is_mock: examType === '模試',
        exam_type: examType, // examType is string, matches ExamInput
        university_id: examType === '模試' ? null : universityId, // Use null for mocks
        // notes: '', // Add notes if needed
      };

      if (editingExam && editingExam.id) {
        // 既存の受験日を更新 using examService
        await examService.updateExam(editingExam.id, examData);
      } else {
        // 新しい受験日を作成 using examService
        await examService.createExam(examData);
      }
      
      // データを再取得
      await fetchData();
      
      // モーダルを閉じる
      setIsExamModalOpen(false);
      setEditingExam(null);
      
    } catch (err) {
      console.error('Error saving exam:', err);
      setError('受験日の保存中にエラーが発生しました');
    }
  };
  
  // 大学を削除
  const handleDeleteUniversity = async (id: number) => {
    if (!confirm('この大学を削除してもよろしいですか？関連する受験日も削除されます。')) {
      return;
    }
    
    try {
      await scheduleService.deleteUniversity(id);
      
      // データを再取得
      await fetchData();
      
    } catch (err) {
      console.error('Error deleting university:', err);
      setError('大学の削除中にエラーが発生しました');
    }
  };
  
  // 受験日を削除
  const handleDeleteExam = async (id: number) => {
    if (!confirm('この受験日を削除してもよろしいですか？')) {
      return;
    }

    try {
      // Use examService to delete
      await examService.deleteExam(id);

      // データを再取得
      await fetchData();
      
    } catch (err) {
      console.error('Error deleting exam:', err);
      setError('受験日の削除中にエラーが発生しました');
    }
  };

  // 残り日数を計算 (date-fns を使用) - Use 'date' property
  const calculateDaysRemaining = (date: string | null | undefined): number => {
    // Check if date is a valid string before parsing
    if (!date) {
      // Handle null, undefined, or empty string case appropriately
      // Returning NaN to indicate an invalid input
      return NaN;
    }

    const todayDate = startOfToday();
    const parsedDate = parseISO(date); // Use 'date' variable

    // Check if parsing was successful and the date is not in the past
    if (!isValid(parsedDate) || isBefore(parsedDate, todayDate)) {
      // Consider if 0 is the right return value for past dates vs. invalid dates
      return 0; // Return 0 if date is invalid or in the past
    }

    // differenceInDays calculates full days, add 1 for inclusive count
    return differenceInDays(parsedDate, todayDate) + 1;
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
        <h1 className="text-2xl font-bold">志望校管理</h1>
        <button
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark flex items-center"
          onClick={openCreateUniversityModal}
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
      
      {/* 大学一覧 */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">大学名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">志望順位</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">メモ</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {universities.length > 0 ? (
              universities.map((university) => (
                <tr key={university.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <GraduationCap className="h-5 w-5 text-gray-400 mr-2" />
                      <div className="text-sm font-medium text-gray-900">{university.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {university.rank !== undefined ? university.rank : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {university.notes || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        className="text-indigo-600 hover:text-indigo-900"
                        onClick={() => openEditUniversityModal(university)}
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        className="text-green-600 hover:text-green-900"
                        onClick={() => openCreateExamModal(university)}
                      >
                        <Calendar className="h-5 w-5" />
                      </button>
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={() => university.id && handleDeleteUniversity(university.id)}
                      >
                        <Trash className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                  志望校が登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* 受験日一覧 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">受験日</h2>
          <button
            className="px-3 py-1 bg-primary text-white rounded-md hover:bg-primary-dark flex items-center text-sm"
            onClick={() => openCreateExamModal()}
          >
            <Plus className="w-4 h-4 mr-1" />
            受験日を追加
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">大学名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">試験種別</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">受験日</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">残り日数</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {exams.length > 0 ? (
                exams.map((exam) => { // exam is now of type Exam
                  // calculateDaysRemaining now accepts potentially null/undefined dates
                  const daysRemaining = calculateDaysRemaining(exam.date); // Use exam.date
                  const displayDays = !isNaN(daysRemaining) ? daysRemaining : null; // Handle NaN case

                  return (
                    <tr key={exam.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {/* Use exam.name or exam.university_name based on is_mock */}
                          {exam.is_mock ? exam.name : exam.university_name || exam.name}
                        </div>
                      </td>
                      {/* Display exam.name or a formatted type */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exam.is_mock ? '模試' : exam.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exam.date || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {displayDays !== null ? ( // Check if daysRemaining is a valid number
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            displayDays <= 7 ? 'bg-red-100 text-red-800' :
                            displayDays <= 30 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {displayDays > 0 ? `残り${displayDays}日` : '受験日当日'}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">日付無効</span> // Display for invalid/missing date
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            className="text-indigo-600 hover:text-indigo-900"
                            onClick={() => openEditExamModal(exam)}
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            className="text-red-600 hover:text-red-900"
                            onClick={() => exam.id && handleDeleteExam(exam.id)}
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
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    受験日が登録されていません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* 大学編集モーダル */}
      {isUniversityModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingUniversity ? '志望校を編集' : '新しい志望校を追加'}
            </h2>
            
            <form onSubmit={handleSaveUniversity}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  大学名
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  志望順位
                </label>
                <input
                  type="number"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={rank === undefined ? '' : rank}
                  onChange={(e) => setRank(e.target.value ? Number(e.target.value) : undefined)}
                  min={1}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メモ
                </label>
                <textarea
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  onClick={() => setIsUniversityModalOpen(false)}
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
      
      {/* 受験日編集モーダル */}
      {isExamModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingExam ? '受験日を編集' : '新しい受験日を追加'}
            </h2>
            
            <form onSubmit={handleSaveExam}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  試験種別
                </label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={examType}
                  // Cast the value to the specific type alias
                  onChange={(e) => setExamType(e.target.value as UniversityExamType | '')}
                  required
                >
                  <option value="">種別を選択してください</option>
                  <option value="一般入試">一般入試</option>
                  <option value="共通テスト">共通テスト</option>
                  <option value="推薦入試">推薦入試</option>
                  <option value="AO入試">AO入試</option>
                  <option value="総合型選抜">総合型選抜</option>
                  <option value="模試">模試</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  受験日
                </label>
                <input
                  type="date"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  required
                />
              </div>
              
              {/* 模試以外の場合、かつ examType が選択されている場合に大学選択を表示 */}
              {examType && examType !== '模試' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    大学
                  </label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={universityId || ''}
                    onChange={(e) => setUniversityId(e.target.value ? Number(e.target.value) : undefined)}
                    required={true} // Always required when this block is rendered
                  >
                    <option value="">大学を選択してください</option>
                    {universities.map((university) => (
                      <option key={university.id} value={university.id}>
                        {university.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  onClick={() => setIsExamModalOpen(false)}
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

export default UniversitiesPage;
