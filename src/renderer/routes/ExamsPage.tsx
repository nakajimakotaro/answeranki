import { useState, useEffect } from 'react';
import { format, parse, parseISO, compareAsc, compareDesc, isValid } from 'date-fns';
import {
  Plus,
  Edit,
  Trash,
  Calendar,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Building
} from 'lucide-react';
import { useExams } from '../hooks';
import { Exam, ExamInput, ExamFormatType } from '../types/exam';
import ExamSubjectScores from '../components/ExamSubjectScores';

/**
 * 試験管理ページ (模試・本番)
 */
const ExamsPage = () => {
  const {
    exams,
    isLoading,
    error,
    fetchExamScores,
    createExam,
    updateExam,
    deleteExam,
  } = useExams();

  // 試験フォーム用の状態
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [formData, setFormData] = useState<ExamInput>({
    name: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    is_mock: false,
    exam_type: 'descriptive',
    university_id: null,
    notes: ''
  });

  // 点数表示用の状態
  const [expandedExamId, setExpandedExamId] = useState<number | null>(null);

  // 試験の展開/折りたたみ時に点数を取得
  useEffect(() => {
    if (expandedExamId !== null) {
      fetchExamScores(expandedExamId); // Use renamed function
    }
  }, [expandedExamId, fetchExamScores]);

  // フォームリセット
  const resetForm = () => {
    setFormData({
      name: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      is_mock: false,
      exam_type: 'descriptive',
      university_id: null,
      notes: ''
    });
    setSelectedExam(null);
    setFormMode('create');
    setShowForm(false);
  };

  // 試験の編集を開始
  const handleEditExam = (exam: Exam) => {
    setSelectedExam(exam);
    setFormData({
      name: exam.name,
      date: exam.date,
      is_mock: exam.is_mock,
      exam_type: exam.exam_type,
      university_id: exam.university_id,
      notes: exam.notes || ''
    });
    setFormMode('edit');
    setShowForm(true);
  };

  // 試験の削除
  const handleDeleteExam = async (examId: number) => {
    if (window.confirm('この試験を削除してもよろしいですか？関連する点数データもすべて削除されます。')) {
      await deleteExam(examId);

      // 削除した試験が展開されていた場合は閉じる
      if (expandedExamId === examId) {
        setExpandedExamId(null);
      }
    }
  };

  // 試験の保存（作成または更新）
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();

    // --- Frontend Validation ---
    if (!formData.name || formData.name.trim() === '') {
      // TODO: Display a user-friendly error message instead of just logging
      console.error('Exam name cannot be empty.');
      // Optionally, set an error state to show in the UI
      // setError({ message: '試験名は必須です。' }); 
      return; // Prevent form submission
    }
    // --- End Validation ---

    if (formMode === 'create') {
      await createExam(formData);
    } else if (formMode === 'edit' && selectedExam) {
      await updateExam(selectedExam.id, formData);
    }

    resetForm();
  };

  // 試験の展開/折りたたみを切り替え
  const toggleExamExpansion = (examId: number) => {
    if (expandedExamId === examId) {
      setExpandedExamId(null);
    } else {
      setExpandedExamId(examId);
    }
  };

  // 日付をフォーマット
  const formatDate = (dateString: string) => {
    const date = parse(dateString, 'yyyy-MM-dd', new Date());
    return format(date, 'yyyy年M月d日');
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

  // 試験形式を日本語に変換
  const formatExamType = (type: string) => {
    switch (type) {
      case 'descriptive': return '記述';
      case 'multiple_choice': return 'マーク';
      case 'combined': return '混合';
      default: return type;
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">試験管理</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
              setFormMode('create');
            }}
            className="btn btn-primary flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            新規試験
          </button>
        </div>
      </div>

      {renderError()}

      {/* 試験フォーム */}
      {showForm && (
        <div className="card p-6 border rounded-lg shadow-sm mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {formMode === 'create' ? '新規試験の登録' : '試験の編集'}
          </h2>
          <form onSubmit={handleSaveExam}>

            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                試験名 <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                className="w-full p-2 border border-gray-300 rounded-md"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder={'例: 2025年度第1回全国統一模試 or 東京大学 前期日程'}
              />
            </div>

            {/* Is Mock Checkbox */}
            <div className="mb-4">
              <div className="flex items-center">
                <input
                  id="is_mock"
                  type="checkbox"
                  className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                  checked={formData.is_mock}
                  onChange={(e) => setFormData({ ...formData, is_mock: e.target.checked })}
                />
                <label htmlFor="is_mock" className="ml-2 block text-sm text-gray-900">
                  模試として登録する
                </label>
              </div>
            </div>

            {/* University ID input (always shown now) */}
              <div className="mb-4">
                <label htmlFor="university_id" className="block text-sm font-medium text-gray-700 mb-1">
                  大学ID (本番試験の場合)
                </label>
                <input
                  id="university_id"
                  type="number"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={formData.university_id ?? ''}
                  onChange={(e) => setFormData({ ...formData, university_id: e.target.value ? parseInt(e.target.value, 10) : null })}
                  placeholder="関連する大学のID"
                />
                 {/* TODO: Replace with a University Selector Component */}
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

            {/* Exam Type (mainly for mocks, but keep for consistency) */}
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
                <option value="descriptive">記述</option>
                <option value="multiple_choice">マーク</option>
                <option value="combined">混合</option>
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
                value={formData.notes ?? ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="試験に関するメモ（オプション）"
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

      {/* 試験リスト */}
      <div className="space-y-4">
        {exams.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {isLoading ? '試験データを読み込み中...' : '試験データがありません。「新規試験」ボタンから登録してください。'}
          </div>
        ) : (
          // Sort exams by date, ascending (oldest first) using date-fns
          [...exams].sort((a, b) => compareAsc(parse(a.date, 'yyyy-MM-dd', new Date()), parse(b.date, 'yyyy-MM-dd', new Date()))).map((exam) => (
            <div key={exam.id} className="card border rounded-lg shadow-sm overflow-hidden">
              {/* 試験ヘッダー */}
              <div
                className="p-4 bg-white flex justify-between items-center cursor-pointer hover:bg-gray-50"
                onClick={() => toggleExamExpansion(exam.id)}
              >
                <div className="flex-1 min-w-0">
                   <h3 className="text-lg font-semibold truncate">{exam.name}</h3>
                  <div className="flex items-center text-gray-600 text-sm mt-1 flex-wrap gap-x-2 gap-y-1">
                    {exam.is_mock && (
                      <span className="inline-flex items-center px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded-full text-xs font-medium">
                        模試
                      </span>
                    )}
                    <span className="inline-flex items-center">
                       <Calendar className="w-4 h-4 mr-1" />
                       {formatDate(exam.date)}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs">
                      {formatExamType(exam.exam_type)}
                    </span>
                    {exam.university_id && (
                       <span className="inline-flex items-center text-purple-700">
                         <Building className="w-4 h-4 mr-1" />
                         大学ID: {exam.university_id}
                       </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
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
                  <ExamSubjectScores examId={exam.id} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ExamsPage;
