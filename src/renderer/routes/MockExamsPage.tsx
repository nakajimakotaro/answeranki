import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash, 
  Calendar, 
  AlertCircle, 
  RefreshCw, 
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useMockExams } from '../hooks';
import { MockExam, CreateMockExamData, MockExamScore } from '../services/mockExamService';
import MockExamSubjectScores from '../components/MockExamSubjectScores';

/**
 * 模試管理ページ
 */
const MockExamsPage = () => {
  const { 
    mockExams, 
    mockExamScores,
    isLoading, 
    error, 
    fetchAllMockExams,
    fetchMockExamScores,
    createMockExam,
    updateMockExam,
    deleteMockExam,
    addOrUpdateScore,
    deleteScore
  } = useMockExams();
  
  // 模試フォーム用の状態
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedExam, setSelectedExam] = useState<MockExam | null>(null);
  const [formData, setFormData] = useState<CreateMockExamData>({
    name: '',
    date: new Date().toISOString().split('T')[0],
    exam_type: 'descriptive',
    notes: ''
  });
  
  // 点数表示用の状態
  const [expandedExamId, setExpandedExamId] = useState<number | null>(null);
  
  // 点数入力フォーム用の状態
  const [showScoreForm, setShowScoreForm] = useState(false);
  const [scoreFormData, setScoreFormData] = useState({
    note_id: '',
    descriptive_score: '',
    multiple_choice_score: '',
    total_score: '',
    max_score: ''
  });
  
  // 初期データ読み込み
  useEffect(() => {
    fetchAllMockExams();
  }, [fetchAllMockExams]);
  
  // 模試の展開/折りたたみ時に点数を取得
  useEffect(() => {
    if (expandedExamId !== null) {
      fetchMockExamScores(expandedExamId);
    }
  }, [expandedExamId, fetchMockExamScores]);
  
  // フォームリセット
  const resetForm = () => {
    setFormData({
      name: '',
      date: new Date().toISOString().split('T')[0],
      exam_type: 'descriptive',
      notes: ''
    });
    setSelectedExam(null);
    setFormMode('create');
    setShowForm(false);
  };
  
  // 点数フォームリセット
  const resetScoreForm = () => {
    setScoreFormData({
      note_id: '',
      descriptive_score: '',
      multiple_choice_score: '',
      total_score: '',
      max_score: ''
    });
    setShowScoreForm(false);
  };
  
  // 模試の編集を開始
  const handleEditExam = (exam: MockExam) => {
    setSelectedExam(exam);
    setFormData({
      name: exam.name,
      date: exam.date,
      exam_type: exam.exam_type || 'descriptive',
      notes: exam.notes || ''
    });
    setFormMode('edit');
    setShowForm(true);
  };
  
  // 模試の削除
  const handleDeleteExam = async (examId: number) => {
    if (window.confirm('この模試を削除してもよろしいですか？関連する点数データもすべて削除されます。')) {
      await deleteMockExam(examId);
      
      // 削除した模試が展開されていた場合は閉じる
      if (expandedExamId === examId) {
        setExpandedExamId(null);
      }
    }
  };
  
  // 模試の保存（作成または更新）
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formMode === 'create') {
      await createMockExam(formData);
    } else if (formMode === 'edit' && selectedExam) {
      await updateMockExam(selectedExam.id, formData);
    }
    
    resetForm();
  };
  
  // 点数の保存
  const handleSaveScore = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (expandedExamId === null) return;
    
    const noteId = parseInt(scoreFormData.note_id);
    if (isNaN(noteId)) {
      alert('有効なノートIDを入力してください');
      return;
    }
    
    const data = {
      note_id: noteId,
      descriptive_score: scoreFormData.descriptive_score ? parseFloat(scoreFormData.descriptive_score) : undefined,
      multiple_choice_score: scoreFormData.multiple_choice_score ? parseFloat(scoreFormData.multiple_choice_score) : undefined,
      total_score: scoreFormData.total_score ? parseFloat(scoreFormData.total_score) : undefined,
      max_score: scoreFormData.max_score ? parseFloat(scoreFormData.max_score) : undefined
    };
    
    await addOrUpdateScore(expandedExamId, data);
    resetScoreForm();
  };
  
  // 点数の削除
  const handleDeleteScore = async (scoreId: number) => {
    if (expandedExamId === null) return;
    
    if (window.confirm('この点数を削除してもよろしいですか？')) {
      await deleteScore(expandedExamId, scoreId);
    }
  };
  
  // 模試の展開/折りたたみを切り替え
  const toggleExamExpansion = (examId: number) => {
    if (expandedExamId === examId) {
      setExpandedExamId(null);
    } else {
      setExpandedExamId(examId);
    }
  };
  
  // 日付をフォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // エラーメッセージを表示
  const renderError = () => {
    if (!error) return null;
    
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-start">
        <AlertCircle className="w-5 h-5 mr-2 mt-0.5" />
        <div>
          <p className="font-semibold">エラーが発生しました</p>
          <p>{error.message}</p>
        </div>
      </div>
    );
  };
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">模試管理</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => fetchAllMockExams()}
            className="btn btn-outline flex items-center"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            更新
          </button>
          <button 
            onClick={() => {
              resetForm();
              setShowForm(true);
              setFormMode('create');
            }}
            className="btn btn-primary flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            新規模試
          </button>
        </div>
      </div>
      
      {renderError()}
      
      {/* 模試フォーム */}
      {showForm && (
        <div className="card p-6 border rounded-lg shadow-sm mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {formMode === 'create' ? '新規模試の登録' : '模試の編集'}
          </h2>
          <form onSubmit={handleSaveExam}>
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                模試名 <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                className="w-full p-2 border border-gray-300 rounded-md"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="例: 2025年度第1回全国統一模試"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                実施日 <span className="text-red-500">*</span>
              </label>
              <input
                id="date"
                type="date"
                className="w-full p-2 border border-gray-300 rounded-md"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="exam_type" className="block text-sm font-medium text-gray-700 mb-1">
                試験形式 <span className="text-red-500">*</span>
              </label>
              <select
                id="exam_type"
                className="w-full p-2 border border-gray-300 rounded-md"
                value={formData.exam_type}
                onChange={(e) => setFormData({ ...formData, exam_type: e.target.value })}
                required
              >
                <option value="descriptive">記述式</option>
                <option value="multiple_choice">マーク式</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                メモ
              </label>
              <textarea
                id="notes"
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="模試に関するメモ（オプション）"
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-outline"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    保存中...
                  </>
                ) : (
                  '保存'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* 模試リスト */}
      <div className="space-y-4">
        {mockExams.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {isLoading ? '模試データを読み込み中...' : '模試データがありません。「新規模試」ボタンから登録してください。'}
          </div>
        ) : (
          mockExams.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(exam => (
            <div key={exam.id} className="card border rounded-lg shadow-sm overflow-hidden">
              {/* 模試ヘッダー */}
              <div 
                className="p-4 bg-white flex justify-between items-center cursor-pointer"
                onClick={() => toggleExamExpansion(exam.id)}
              >
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{exam.name}</h3>
                  <div className="flex items-center text-gray-600 text-sm mt-1">
                    <Calendar className="w-4 h-4 mr-1" />
                    {formatDate(exam.date)}
                    <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs">
                      {exam.exam_type === 'multiple_choice' ? 'マーク式' : '記述式'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditExam(exam);
                    }}
                    className="btn btn-sm btn-outline flex items-center"
                    title="編集"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteExam(exam.id);
                    }}
                    className="btn btn-sm btn-outline btn-error flex items-center"
                    title="削除"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                  {expandedExamId === exam.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </div>
              </div>
              
              {/* 展開時の点数リスト */}
              {expandedExamId === exam.id && (
                <div className="p-4 bg-gray-50 border-t">
                  {/* 科目別点数の上部タイトルは不要なので削除 */}
                  
                  {/* 科目別点数 */}
                  <MockExamSubjectScores mockExamId={exam.id} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MockExamsPage;
