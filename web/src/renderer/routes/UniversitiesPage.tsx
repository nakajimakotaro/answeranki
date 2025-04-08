import { useState, useEffect, useMemo } from 'react'; // Add useMemo
// Import format from date-fns
import { parseISO, differenceInDays, startOfToday, isBefore, format } from 'date-fns';
import { trpc } from '../lib/trpc'; // Import tRPC hook - Removed .js
// import { examService } from '../services/examService'; // Removed examService import
import type { Exam, ExamInput } from '@shared/types/exam'; // Removed .js extension
// TimelineEvent import might not be needed if exam query returns Exam[] directly
// UniversityExamType might still be used for the dropdown, keep it for now or replace if needed
import type { UniversityExamType } from '../types/schedule'; // Removed .js extension
import { GraduationCap, Plus, Edit, Trash, Calendar } from 'lucide-react';
import type { inferRouterOutputs } from '@trpc/server'; // Import helper type
// Import AppRouter using the path alias
import type { AppRouter } from '@server/router'; // Removed .js extension

// Infer the output types using AppRouter
type RouterOutput = inferRouterOutputs<AppRouter>; // Use AppRouter for inference
type University = RouterOutput['university']['getAll'][number]; // Correctly infer University type
// Infer Exam type from tRPC output (assuming getAll returns the base Exam type)
// Assuming exam.date from the server is Date type
type ExamOutput = Omit<RouterOutput['exam']['getAll'][number], 'date'> & { date: Date | null };

// Define a type for Exam with the optional university_name added in the component
type ExamWithUniName = ExamOutput & { university_name?: string };

const UniversitiesPage = () => {
  // tRPC Query for Universities
  const utils = trpc.useUtils(); // Get tRPC utils for invalidation
  const { data: universities = [], isLoading: isLoadingUniversities, error: universityError } = trpc.university.getAll.useQuery();

  // tRPC Query for Exams
  const { data: rawExams = [], isLoading: isLoadingExams, error: examError } = trpc.exam.getAll.useQuery();

  // Process exams to add university names (memoized)
  const exams: ExamWithUniName[] = useMemo(() => {
    // Ensure rawExams is correctly typed or cast if necessary, assuming date is Date | null
    const examsOutput = rawExams as unknown as (Omit<RouterOutput['exam']['getAll'][number], 'date'> & { date: Date | null })[];
    // Always map to ExamWithUniName[], even if universities is empty (university_name will be undefined)
    return examsOutput.map((exam): ExamWithUniName => ({
      ...exam,
      // Use optional chaining on universities as well
      university_name: universities?.find((u: University) => u.id === exam.university_id)?.name,
    }));
  }, [rawExams, universities]);

  // Modal states
  const [isUniversityModalOpen, setIsUniversityModalOpen] = useState(false);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingUniversity, setEditingUniversity] = useState<University | null>(null);
  const [editingExam, setEditingExam] = useState<ExamWithUniName | null>(null); // Use ExamWithUniName

  // University form state
  const [name, setName] = useState('');
  const [rank, setRank] = useState<number | null | undefined>(undefined); // Allow null from DB
  const [notes, setNotes] = useState<string | null>(''); // Allow null from DB

  // Exam form state
  const [universityId, setUniversityId] = useState<number | undefined>(undefined);
  const [examDate, setExamDate] = useState(''); // Keep as string for input type="date"
  const [examType, setExamType] = useState<UniversityExamType | ''>('');

  // Removed useEffect for fetching exams, handled by trpc.exam.getAll.useQuery

  // University Modal Logic
  const openCreateUniversityModal = () => {
    setEditingUniversity(null);
    setName('');
    setRank(undefined); // Reset rank
    setNotes(''); // Reset notes
    setIsUniversityModalOpen(true);
  };

  const openEditUniversityModal = (university: University) => {
    setEditingUniversity(university);
    setName(university.name);
    setRank(university.rank); // Rank can be null
    setNotes(university.notes ?? null); // Set null if notes is undefined
    setIsUniversityModalOpen(true);
  };

  // Exam Modal Logic
  const openCreateExamModal = (university?: University) => {
    setEditingExam(null);
    setUniversityId(university?.id);
    setExamDate('');
    setExamType('');
    setIsExamModalOpen(true);
  };

  const openEditExamModal = (exam: ExamWithUniName) => { // Use ExamWithUniName
    setEditingExam(exam);
    setUniversityId(exam.university_id ?? undefined);
    // Convert Date to 'yyyy-MM-dd' string for input
    setExamDate(exam.date ? format(exam.date, 'yyyy-MM-dd') : '');
    setExamType(exam.exam_type as UniversityExamType | '');
    setIsExamModalOpen(true);
  };

  // tRPC Mutations for University
  const createUniversityMutation = trpc.university.create.useMutation({
    onSuccess: () => {
      utils.university.getAll.invalidate(); // Invalidate query on success
      setIsUniversityModalOpen(false);
      setEditingUniversity(null);
    },
    onError: (error: any) => { // Add type annotation for error
      console.error('Error creating university:', error);
      // Consider adding user-facing error feedback
    },
  });

  const updateUniversityMutation = trpc.university.update.useMutation({
    onSuccess: () => {
      utils.university.getAll.invalidate();
      setIsUniversityModalOpen(false);
      setEditingUniversity(null);
    },
    onError: (error: any) => { // Add type annotation for error
      console.error('Error updating university:', error);
      // Consider adding user-facing error feedback
    },
  });

  const deleteUniversityMutation = trpc.university.delete.useMutation({
    onSuccess: () => {
      utils.university.getAll.invalidate();
      utils.exam.getAll.invalidate(); // Also invalidate exams as they might be linked
    },
    onError: (error: any) => { // Add type annotation for error
      console.error('Error deleting university:', error);
      // Consider adding user-facing error feedback
    },
  });

  // tRPC Mutations for Exam
  const createExamMutation = trpc.exam.create.useMutation({
    onSuccess: () => {
      utils.exam.getAll.invalidate(); // Invalidate exam query
      setIsExamModalOpen(false);
      setEditingExam(null);
    },
    onError: (error: any) => { // Add type annotation for error
      console.error('Error creating exam:', error);
      // Consider adding user-facing error feedback
    },
  });

  const updateExamMutation = trpc.exam.update.useMutation({
    onSuccess: () => {
      utils.exam.getAll.invalidate();
      setIsExamModalOpen(false);
      setEditingExam(null);
    },
    onError: (error: any) => { // Add type annotation for error
      console.error('Error updating exam:', error);
      // Consider adding user-facing error feedback
    },
  });

  const deleteExamMutation = trpc.exam.delete.useMutation({
    onSuccess: () => {
      utils.exam.getAll.invalidate();
    },
    onError: (error: any) => { // Add type annotation for error
      console.error('Error deleting exam:', error);
      // Consider adding user-facing error feedback
    },
  });


  // Save University Handler using tRPC
  const handleSaveUniversity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || name.trim() === '') {
      alert('大学名は必須です');
      return;
    }

    const universityInput = {
      name,
      rank: rank === undefined ? null : rank,
      notes: notes === '' ? null : notes,
    };

    if (editingUniversity && editingUniversity.id) {
      updateUniversityMutation.mutate({ ...universityInput, id: editingUniversity.id });
    } else {
      createUniversityMutation.mutate(universityInput);
    }
  };

  // Save Exam Handler using tRPC
  const handleSaveExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examType) {
      alert('試験種別を選択してください');
      return;
    }
    if (examType !== '模試' && !universityId) {
      alert('大学は必須です');
      return;
    }
    if (!examDate) {
      alert('受験日は必須です');
      return;
    }

    // Find university name safely
    const uniName = universities?.find((u: University) => u.id === universityId)?.name; // Add type for u
    const examName = examType === '模試' ? '模試' : (uniName ? `${uniName} ${examType}` : examType);

    // Convert string date to Date object for API
    let dateToSend: Date | null = null;
    try {
        // Use parseISO to handle the 'yyyy-MM-dd' string correctly
        dateToSend = parseISO(examDate);
    } catch (error) {
        console.error("Invalid date format:", examDate);
        alert('無効な日付形式です。');
        return; // Stop submission if date is invalid
    }


    const examInput: ExamInput = {
      name: examName,
      date: dateToSend, // Send Date object
      is_mock: examType === '模試',
      exam_type: examType,
      university_id: examType === '模試' ? null : universityId,
      // notes are not part of the modal form, handle if needed
    };

    if (editingExam && editingExam.id) {
      updateExamMutation.mutate({ ...examInput, id: editingExam.id });
    } else {
      createExamMutation.mutate(examInput);
    }
  };

  // Delete University Handler using tRPC
  const handleDeleteUniversity = (id: number) => {
    if (!confirm('この大学を削除してもよろしいですか？関連する受験日も削除されます。')) {
      return;
    }
    deleteUniversityMutation.mutate({ id });
  };

  // Delete Exam Handler using tRPC
  const handleDeleteExam = (id: ExamWithUniName['id']) => { // Use correct type
    if (!confirm('この受験日を削除してもよろしいですか？')) {
      return;
    }
    deleteExamMutation.mutate({ id });
  };

  // Calculate Days Remaining - Expects Date object now
  const calculateDaysRemaining = (date: Date | null): number => {
    if (!date) return NaN;
    const todayDate = startOfToday();
    // No need to parseISO if 'date' is already a Date object
    if (isBefore(date, todayDate)) return 0; // Keep check for past dates
    return differenceInDays(date, todayDate) + 1;
  };

  // Combined Loading State using tRPC loading states
  if (isLoadingUniversities || isLoadingExams) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Combined Error Display using tRPC error states
  const combinedError = universityError?.message || examError?.message || createUniversityMutation.error?.message || updateUniversityMutation.error?.message || deleteUniversityMutation.error?.message || createExamMutation.error?.message || updateExamMutation.error?.message || deleteExamMutation.error?.message;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">志望校管理</h1>
        <button
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark flex items-center"
          onClick={openCreateUniversityModal}
          disabled={createUniversityMutation.isPending || updateUniversityMutation.isPending}
        >
          <Plus className="w-4 h-4 mr-2" />
          新規作成
        </button>
      </div>

      {combinedError && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {combinedError}
        </div>
      )}

      {/* University List */}
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
            {universities && universities.length > 0 ? (
              universities.map((university: University) => ( // Add type for university
                <tr key={university.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <GraduationCap className="h-5 w-5 text-gray-400 mr-2" />
                      <div className="text-sm font-medium text-gray-900">{university.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {university.rank ?? '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {university.notes ?? '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        className="text-indigo-600 hover:text-indigo-900"
                        onClick={() => openEditUniversityModal(university)}
                        disabled={updateUniversityMutation.isPending || deleteUniversityMutation.isPending}
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        className="text-green-600 hover:text-green-900"
                        onClick={() => openCreateExamModal(university)}
                        disabled={createExamMutation.isPending || updateExamMutation.isPending} // Disable while exam mutation is pending
                      >
                        <Calendar className="h-5 w-5" />
                      </button>
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={() => handleDeleteUniversity(university.id)}
                        disabled={deleteUniversityMutation.isPending || (deleteUniversityMutation.variables?.id === university.id)}
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

      {/* Exam List */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">受験日</h2>
          <button
            className="px-3 py-1 bg-primary text-white rounded-md hover:bg-primary-dark flex items-center text-sm"
            onClick={() => openCreateExamModal()}
            disabled={createExamMutation.isPending || updateExamMutation.isPending} // Disable while exam mutation is pending
          >
            <Plus className="w-4 h-4 mr-1" />
            受験日を追加
          </button>
        </div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
           <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">大学名/模試名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">試験種別</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">受験日</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">残り日数</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {exams.length > 0 ? (
                exams.map((exam) => {
                  // Pass Date object directly to calculateDaysRemaining
                  const daysRemaining = calculateDaysRemaining(exam.date);
                  const displayDays = !isNaN(daysRemaining) ? daysRemaining : null;
                  return (
                    <tr key={exam.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {exam.is_mock ? exam.name : exam.university_name || exam.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exam.exam_type}</td>
                      {/* Format Date object directly for display */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exam.date ? format(exam.date, 'yyyy/MM/dd') : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {displayDays !== null ? (
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            displayDays <= 7 ? 'bg-red-100 text-red-800' :
                            displayDays <= 30 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {displayDays > 0 ? `残り${displayDays}日` : '受験日当日'}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">日付無効</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            className="text-indigo-600 hover:text-indigo-900"
                            onClick={() => openEditExamModal(exam)}
                            disabled={updateExamMutation.isPending || deleteExamMutation.isPending}
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            className="text-red-600 hover:text-red-900"
                            onClick={() => handleDeleteExam(exam.id)}
                            disabled={deleteExamMutation.isPending || (deleteExamMutation.variables?.id === exam.id)}
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

      {/* University Edit Modal */}
      {isUniversityModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingUniversity ? '志望校を編集' : '新しい志望校を追加'}
            </h2>
            <form onSubmit={handleSaveUniversity}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">大学名</label>
                <input type="text" className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">志望順位</label>
                <input type="number" className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={rank === undefined || rank === null ? '' : rank}
                  onChange={(e) => setRank(e.target.value ? Number(e.target.value) : undefined)} min={1} />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
                <textarea className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={notes ?? ''}
                  onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  onClick={() => setIsUniversityModalOpen(false)}
                  disabled={createUniversityMutation.isPending || updateUniversityMutation.isPending}>
                  キャンセル
                </button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                  disabled={createUniversityMutation.isPending || updateUniversityMutation.isPending}>
                  {createUniversityMutation.isPending || updateUniversityMutation.isPending ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exam Edit Modal */}
      {isExamModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingExam ? '受験日を編集' : '新しい受験日を追加'}
            </h2>
            <form onSubmit={handleSaveExam}>
               <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">試験種別</label>
                <select className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={examType} onChange={(e) => setExamType(e.target.value as UniversityExamType | '')} required>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">受験日</label>
                <input type="date" className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={examDate} onChange={(e) => setExamDate(e.target.value)} required />
              </div>
              {examType && examType !== '模試' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">大学</label>
                  <select className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={universityId || ''} onChange={(e) => setUniversityId(e.target.value ? Number(e.target.value) : undefined)} required={true}>
                    <option value="">大学を選択してください</option>
                    {universities?.map((university: University) => ( // Add type for university
                      <option key={university.id} value={university.id}>
                        {university.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <button type="button" className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  onClick={() => setIsExamModalOpen(false)}
                  disabled={createExamMutation.isPending || updateExamMutation.isPending}>
                  キャンセル
                </button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                  disabled={createExamMutation.isPending || updateExamMutation.isPending}>
                  {createExamMutation.isPending || updateExamMutation.isPending ? '保存中...' : '保存'}
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
