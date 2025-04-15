import { useState, useEffect } from 'react';
import { format, parseISO, compareAsc } from 'date-fns';
import { z } from 'zod';
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

import ExamSubjectScores from '../components/ExamSubjectScores.js';
import { trpc } from '../lib/trpc.js'; // Import tRPC client
import { ExamSchema, ExamInputSchema, ExamUpdateSchema } from '@answeranki/shared/types/exam';
import type { inferRouterOutputs } from '@trpc/server';
type AppRouter = any;

// Infer types from router
type RouterOutput = inferRouterOutputs<AppRouter>;
type Exam = z.infer<typeof ExamSchema>;
type ExamOutput = RouterOutput['exam']['getAll'][number];
type ExamInput = z.infer<typeof ExamInputSchema>;
type ExamUpdateInput = z.infer<typeof ExamUpdateSchema>;


/**
 * 試験管理ページ (模試・本番)
 */
const ExamsPage = () => {
  const utils = trpc.useUtils();
  const examsQuery = trpc.exam.getAll.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const createExamMutation = trpc.exam.create.useMutation({
    onSuccess: () => {
      utils.exam.getAll.invalidate();
      resetForm();
      setMutationError(null);
    },
    onError: (err) => {
      console.error("Error creating exam:", err);
      setMutationError(`試験の作成中にエラーが発生しました: ${err.message}`);
    }
  });
  const updateExamMutation = trpc.exam.update.useMutation({
    onSuccess: () => {
      utils.exam.getAll.invalidate();
      resetForm();
      setMutationError(null);
    },
     onError: (err) => {
      console.error("Error updating exam:", err);
      setMutationError(`試験の更新中にエラーが発生しました: ${err.message}`);
    }
  });
  const deleteExamMutation = trpc.exam.delete.useMutation({
    onSuccess: (_, variables) => {
      utils.exam.getAll.invalidate();
      if (expandedExamId === variables.id) {
        setExpandedExamId(null);
      }
      setMutationError(null);
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
  const [selectedExam, setSelectedExam] = useState<ExamOutput | null>(null);
  const [formData, setFormData] = useState<Omit<ExamInput, 'date'> & { date: string; }>({
    name: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    is_mock: false,
    exam_type: 'descriptive',
    notes: ''
  });

  // 点数表示用の状態
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);

  // フォームリセット
  const resetForm = () => {
    setFormData({
      name: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      is_mock: false,
      exam_type: 'descriptive',
      notes: ''
    });
    setSelectedExam(null);
    setFormMode('create');
    setShowForm(false);
    setMutationError(null); // Clear errors on reset
  };

  // 試験の編集を開始
  const handleEditExam = (exam: ExamOutput) => {
    setSelectedExam(exam);
    setFormData({
      name: exam.name,
      date: format(exam.date, 'yyyy-MM-dd'),
      is_mock: exam.is_mock,
      exam_type: exam.exam_type,
      notes: exam.notes || ''
    });
    setFormMode('edit');
    setShowForm(true);
    setMutationError(null);
  };

  // 試験の削除 (Uses tRPC mutation)
  const handleDeleteExam = (examId: string) => {
    if (window.confirm('この試験を削除してもよろしいですか？関連する点数データもすべて削除されます。')) {
      setMutationError(null);
      deleteExamMutation.mutate({ id: examId });
    }
  };

  // 試験の保存（作成または更新）
  const handleSaveExam = (e: React.FormEvent) => {
    e.preventDefault();
    setMutationError(null);

    // --- Frontend Validation ---
    if (!formData.name || formData.name.trim() === '') {
       setMutationError('試験名は必須です。');
      return;
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

    // Convert date string from form back to Date object for mutation
    let dateObject: Date;
    try {
        dateObject = parseISO(formData.date);
        if (isNaN(dateObject.getTime())) {
            throw new Error('Invalid date value');
        }
    } catch (error) {
        setMutationError('無効な日付形式です。yyyy-MM-dd形式で入力してください。');
        return;
    }


    const mutationPayloadBase = {
        ...formData,
        date: dateObject,
    };

    if (formMode === 'create') {
        try {
            const validatedPayload = ExamInputSchema.parse(mutationPayloadBase);
            createExamMutation.mutate(validatedPayload);
        } catch (error) {
             if (error instanceof z.ZodError) {
                setMutationError(`入力エラー: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
            } else {
                setMutationError('予期せぬ検証エラーが発生しました。');
                console.error("Unexpected validation error:", error);
            }
        }
    } else if (formMode === 'edit' && selectedExam) {
        const updatePayload = {
            ...mutationPayloadBase,
            id: selectedExam.id
        };
        try {
            const validatedPayload = ExamUpdateSchema.parse(updatePayload);
            updateExamMutation.mutate(validatedPayload);
        } catch (error) {
             if (error instanceof z.ZodError) {
                setMutationError(`入力エラー: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
            } else {
                setMutationError('予期せぬ検証エラーが発生しました。');
                console.error("Unexpected validation error:", error);
            }
        }
    }
  };

  // 試験の展開/折りたたみを切り替え
  const toggleExamExpansion = (examId: string) => {
    if (expandedExamId === examId) {
      setExpandedExamId(null);
    } else {
      setExpandedExamId(examId);
    }
  };

  // 日付をフォーマット
  const formatDate = (date: Date) => {
     if (!(date instanceof Date) || isNaN(date.getTime())) {
       return '無効な日付';
     }
     return format(date, 'yyyy年M月d日');
  };

  // エラーメッセージを表示
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
          [...(examsQuery.data || [])].sort((a, b) => {
              return compareAsc(a.date, b.date);
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
