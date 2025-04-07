import { useState, useEffect } from 'react';
import { format, parse, parseISO, compareAsc } from 'date-fns';
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

// import { useExams } from '../hooks'; // Removed old hook
// import { Exam, ExamInput, ExamFormatType } from '../types/exam'; // Removed old types
import ExamSubjectScores from '../components/ExamSubjectScores.js';
import { trpc } from '../lib/trpc.js'; // Import tRPC client
// Temporary type for AppRouter to avoid direct server import
type AppRouter = any;
import { inferRouterOutputs } from '@trpc/server';

// Infer types from router (will be 'any' due to AppRouter being 'any')
// This is temporary until proper type sharing is set up
type RouterOutput = inferRouterOutputs<AppRouter>;
// Manually define Exam and ExamInput types based on expected data structure for now
interface Exam {
  id: number;
  name: string;
  date: string;
  is_mock: boolean;
  exam_type: string;
  university_id?: number | null;
  notes?: string | null;
  // Add other fields if necessary based on usage, e.g., university_name
  university_name?: string | null;
}
interface ExamInput {
  name: string;
  date: string;
  is_mock: boolean;
  exam_type: string;
  university_id?: number | null;
  notes?: string | null;
}


/**
 * 試験管理ページ (模試・本番)
 */
const ExamsPage = () => {
  // tRPC hooks
  const utils = trpc.useUtils();
  const examsQuery = trpc.exam.getAll.useQuery(undefined, { // Changed getExams to getAll
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  const createExamMutation = trpc.exam.create.useMutation({ // Changed createExam to create
    onSuccess: () => {
      utils.exam.getAll.invalidate(); // Changed getExams to getAll
      resetForm();
      setMutationError(null); // Clear previous errors
    },
    onError: (err) => {
      console.error("Error creating exam:", err);
      setMutationError(`試験の作成中にエラーが発生しました: ${err.message}`);
    }
  });
  const updateExamMutation = trpc.exam.update.useMutation({ // Changed updateExam to update
    onSuccess: () => {
      utils.exam.getAll.invalidate(); // Changed getExams to getAll
      resetForm();
      setMutationError(null); // Clear previous errors
    },
     onError: (err) => {
      console.error("Error updating exam:", err);
      setMutationError(`試験の更新中にエラーが発生しました: ${err.message}`);
    }
  });
  const deleteExamMutation = trpc.exam.delete.useMutation({ // Changed deleteExam to delete
    onSuccess: (_, variables) => {
      utils.exam.getAll.invalidate(); // Changed getExams to getAll
      // Close expansion if the deleted exam was expanded
      if (expandedExamId === variables.id) {
        setExpandedExamId(null);
      }
      setMutationError(null); // Clear previous errors
    },
    onError: (err) => {
      console.error("Error deleting exam:", err);
      setMutationError(`試験の削除中にエラーが発生しました: ${err.message}`);
    }
  });

  // Local state
  const [mutationError, setMutationError] = useState<string | null>(null); // For mutation errors
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
    setMutationError(null); // Clear errors on reset
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
    setMutationError(null); // Clear errors when opening edit form
  };

  // 試験の削除 (Uses tRPC mutation)
  const handleDeleteExam = (examId: number) => {
    if (window.confirm('この試験を削除してもよろしいですか？関連する点数データもすべて削除されます。')) {
      setMutationError(null); // Clear previous errors
      deleteExamMutation.mutate({ id: examId });
    }
    // onSuccess handler in mutation takes care of UI updates
  };

  // 試験の保存（作成または更新） (Uses tRPC mutation)
  const handleSaveExam = (e: React.FormEvent) => {
    e.preventDefault();
    setMutationError(null); // Clear previous errors

    // --- Frontend Validation ---
    if (!formData.name || formData.name.trim() === '') {
       setMutationError('試験名は必須です。');
      return; // Prevent form submission
    }
     if (!formData.date) {
       setMutationError('実施日は必須です。');
       return;
     }
     if (!formData.exam_type) {
        setMutationError('試験形式は必須です。');
        return;
     }
    // --- End Validation ---

    if (formMode === 'create') {
      createExamMutation.mutate(formData);
    } else if (formMode === 'edit' && selectedExam) {
      // Ensure university_id is passed correctly (null if empty string or invalid)
      const dataToUpdate = {
          ...formData,
          university_id: formData.university_id ? Number(formData.university_id) : null,
          id: selectedExam.id
      };
      updateExamMutation.mutate(dataToUpdate);
    }
    // onSuccess handler in mutation takes care of resetting form
  };

  // 試験の展開/折りたたみを切り替え
  const toggleExamExpansion = (examId: number) => {
    if (expandedExamId === examId) {
      setExpandedExamId(null);
    } else {
      setExpandedExamId(examId);
      // Note: Score fetching is now handled within ExamSubjectScores component
    }
  };

  // 日付をフォーマット
  // Assume dateString from DB is a valid 'yyyy-MM-dd' string
  const formatDate = (dateString: string) => {
     const date = parse(dateString, 'yyyy-MM-dd', new Date());
     return format(date, 'yyyy年M月d日');
  };

  // エラーメッセージを表示 (Handles both query and mutation errors)
  const renderError = () => {
    const queryError = examsQuery.error;
    const errorToShow = mutationError || (queryError ? `データの取得エラー: ${queryError.message}` : null);

    if (!errorToShow) return null;

    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-start">
        <AlertCircle className="w-5 h-5 mr-2 mt-0.5" />
        <div>
          <p className="font-semibold">エラー</p>
          <p>{errorToShow}</p>
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
                disabled={createExamMutation.isPending || updateExamMutation.isPending}
              >
                {createExamMutation.isPending || updateExamMutation.isPending ? (
                  <>
                    <span className="loading loading-spinner loading-xs mr-2"></span>
                    保存中...
                  </>
                ) : '保存'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 試験リスト */}
      <div className="space-y-4">
        {examsQuery.isLoading ? (
           <div className="text-center py-8 text-gray-500">
             <span className="loading loading-spinner loading-lg"></span>
             <p>試験データを読み込み中...</p>
           </div>
        ) : examsQuery.data && examsQuery.data.length === 0 ? (
           <div className="text-center py-8 text-gray-500">
             試験データがありません。「新規試験」ボタンから登録してください。
           </div>
        ) : (
          // Sort exams by date, ascending (oldest first) using date-fns
          [...(examsQuery.data || [])].sort((a, b) => {
              const dateA = parse(a.date, 'yyyy-MM-dd', new Date());
              const dateB = parse(b.date, 'yyyy-MM-dd', new Date());
              return compareAsc(dateA, dateB);
          }).map((exam) => (
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
