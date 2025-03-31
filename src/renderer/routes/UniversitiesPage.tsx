import { useState, useEffect } from 'react';
import { scheduleService, University, ExamDate } from '../services/scheduleService';
import { GraduationCap, Plus, Edit, Trash, Calendar } from 'lucide-react';

const UniversitiesPage = () => {
  // 状態管理
  const [universities, setUniversities] = useState<University[]>([]);
  const [exams, setExams] = useState<ExamDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUniversityModalOpen, setIsUniversityModalOpen] = useState(false);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingUniversity, setEditingUniversity] = useState<University | null>(null);
  const [editingExam, setEditingExam] = useState<ExamDate | null>(null);
  
  // 大学フォーム状態
  const [name, setName] = useState('');
  const [rank, setRank] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState('');
  
  // 受験日フォーム状態
  const [universityId, setUniversityId] = useState<number | undefined>(undefined);
  const [examDate, setExamDate] = useState('');
  const [examType, setExamType] = useState('');
  
  // データ取得
  useEffect(() => {
    fetchData();
  }, []);
  
  // 大学と受験日を取得
  const fetchData = async () => {
    try {
      setLoading(true);
      const [universitiesData, examsData] = await Promise.all([
        scheduleService.getUniversities(),
        scheduleService.getExams()
      ]);
      
      setUniversities(universitiesData);
      setExams(examsData);
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
    setExamType('');
    setIsExamModalOpen(true);
  };
  
  // 受験日モーダルを開く（編集）
  const openEditExamModal = (exam: ExamDate) => {
    setEditingExam(exam);
    setUniversityId(exam.university_id);
    setExamDate(exam.exam_date);
    setExamType(exam.exam_type);
    setIsExamModalOpen(true);
  };
  
  // 大学を保存
  const handleSaveUniversity = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      setError('大学名は必須です');
      return;
    }
    
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
      const examData: ExamDate = {
        university_id: examType === '模試' ? 0 : universityId!, // 模試の場合はnullになるようにAPI側で処理
        exam_date: examDate,
        exam_type: examType
      };
      
      if (editingExam && editingExam.id) {
        // 既存の受験日を更新
        await scheduleService.updateExam(editingExam.id, examData);
      } else {
        // 新しい受験日を作成
        await scheduleService.createExam(examData);
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
      await scheduleService.deleteExam(id);
      
      // データを再取得
      await fetchData();
      
    } catch (err) {
      console.error('Error deleting exam:', err);
      setError('受験日の削除中にエラーが発生しました');
    }
  };
  
  // 残り日数を計算
  const calculateDaysRemaining = (examDate: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const date = new Date(examDate);
    const diffTime = date.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
                exams.map((exam) => {
                  const daysRemaining = calculateDaysRemaining(exam.exam_date);
                  return (
                    <tr key={exam.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {exam.exam_type === '模試' && !exam.university_name ? '全国模試' : exam.university_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exam.exam_type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exam.exam_date}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          daysRemaining <= 7 ? 'bg-red-100 text-red-800' : 
                          daysRemaining <= 30 ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-green-100 text-green-800'
                        }`}>
                          {daysRemaining > 0 ? `残り${daysRemaining}日` : '受験日当日'}
                        </span>
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
                  onChange={(e) => setExamType(e.target.value)}
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
              
              {/* 模試以外の場合は大学選択を表示 */}
              {examType !== '模試' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    大学
                  </label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={universityId || ''}
                    onChange={(e) => setUniversityId(e.target.value ? Number(e.target.value) : undefined)}
                    required={examType !== '模試'}
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
