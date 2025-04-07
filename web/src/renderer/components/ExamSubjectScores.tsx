import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Save, Trash, Plus } from 'lucide-react';
import { trpc } from '../lib/trpc.js'; // Import tRPC client
type AppRouter = any;
import { inferRouterOutputs } from '@trpc/server';

type RouterOutput = inferRouterOutputs<AppRouter>;
interface SubjectScore {
  id: number;
  exam_id: number;
  exam_type: string;
  subject: string;
  score?: number | null;
  max_score?: number | null;
}
const COMMON_TEST_SUBJECTS = ['国語', '数学IA', '数学IIB', '英語R', '英語L', '物理', '化学', '生物', '地学', '世界史B', '日本史B', '地理B', '現代社会', '倫理', '政治経済', '倫理政経'];
const SECONDARY_TEST_SUBJECTS = ['国語', '数学', '英語', '物理', '化学', '生物', '地学', '世界史', '日本史', '地理', '小論文'];
const COMMON_TEST_MAX_SCORES: Record<string, number> = { '国語': 200, '数学IA': 100, '数学IIB': 100, '英語R': 100, '英語L': 100, '物理': 100, '化学': 100, '生物': 100, '地学': 100, '世界史B': 100, '日本史B': 100, '地理B': 100, '現代社会': 100, '倫理': 100, '政治経済': 100, '倫理政経': 100 };
type SubjectExamType = '共テ' | '二次試験';


interface ExamSubjectScoresProps {
  examId: number;
}

/**
 * 試験の科目別点数を表示・編集するコンポーネント
 */
const ExamSubjectScores = ({ examId }: ExamSubjectScoresProps) => {
  // tRPC hooks
  const utils = trpc.useUtils();
  // Query for the specific exam to get its format type
  const examQuery = trpc.exam.getById.useQuery({ id: examId }, { // Changed getExamById to getById
    enabled: !!examId, // Only run query if examId is valid
    staleTime: Infinity, // Exam details rarely change, cache indefinitely
  });
  // Query for subject scores
  const subjectScoresQuery = trpc.exam.getSubjectScoresByExamId.useQuery({ examId }, { // Changed getSubjectScores to getSubjectScoresByExamId
    enabled: !!examId, // Only run query if examId is valid
  });
  // Mutation for saving scores
  const saveScoresMutation = trpc.exam.batchUpsertSubjectScores.useMutation({
    onSuccess: () => {
      utils.exam.getSubjectScoresByExamId.invalidate({ examId }); // Changed getSubjectScores to getSubjectScoresByExamId
      setEditMode(false);
      setError(null); // Clear errors
      },
      onError: (err) => {
        setError(new Error(err.message)); // Extract message and create a new Error object
      },
    });
  // Mutation for deleting a score
  const deleteScoreMutation = trpc.exam.deleteSubjectScore.useMutation({
     onSuccess: () => {
      utils.exam.getSubjectScoresByExamId.invalidate({ examId }); // Changed getSubjectScores to getSubjectScoresByExamId
      setError(null); // Clear errors
      },
       onError: (err) => {
        setError(new Error(err.message)); // Extract message and create a new Error object
       },
     });

  // Local state
  const [error, setError] = useState<Error | null>(null); // For mutation errors
  const [examFormatType, setExamFormatType] = useState<string>('descriptive'); // Default or derived from examQuery

  // Update examFormatType when examQuery data is available
  useEffect(() => {
    if (examQuery.data) {
      setExamFormatType(examQuery.data.exam_type);
    }
  }, [examQuery.data]);

   // Editing state
  const [editMode, setEditMode] = useState(false);
  const [commonTestScores, setCommonTestScores] = useState<Record<string, { score: string, maxScore: string }>>({});
  const [secondaryTestScores, setSecondaryTestScores] = useState<Record<string, { score: string, maxScore: string }>>({});

  // Update local edit state when scores data from query changes
  useEffect(() => {
    if (!subjectScoresQuery.data) return; // Don't run if data is not available

    const commonTest: Record<string, { score: string, maxScore: string }> = {};
    const secondaryTest: Record<string, { score: string, maxScore: string }> = {};

    // Initialize commonTest with default max scores
    COMMON_TEST_SUBJECTS.forEach(subject => {
      const defaultMaxScore = COMMON_TEST_MAX_SCORES[subject] !== undefined ? String(COMMON_TEST_MAX_SCORES[subject]) : '';
      commonTest[subject] = { score: '', maxScore: defaultMaxScore };
    });
    // Initialize secondaryTest (no default max scores defined for these)
    SECONDARY_TEST_SUBJECTS.forEach(subject => {
      secondaryTest[subject] = { score: '', maxScore: '' };
    });

    // Use data from the tRPC query
    subjectScoresQuery.data.forEach((score) => {
      const scoreVal = score.score !== null && score.score !== undefined ? String(score.score) : '';
      // Use existing maxScore if available, otherwise keep the default
      const maxScoreVal = score.max_score !== null && score.max_score !== undefined
        ? String(score.max_score)
        // Use default common test max score if subject exists there, otherwise empty string
        : COMMON_TEST_MAX_SCORES[score.subject] !== undefined ? String(COMMON_TEST_MAX_SCORES[score.subject]) : '';

      if (score.exam_type === '共テ' && commonTest[score.subject]) {
        commonTest[score.subject] = { score: scoreVal, maxScore: maxScoreVal };
      } else if (score.exam_type === '二次試験' && secondaryTest[score.subject]) {
        // For secondary, maxScoreVal will be empty string if not set, which is fine
        const secondaryMaxScoreVal = score.max_score !== null && score.max_score !== undefined ? String(score.max_score) : '';
        secondaryTest[score.subject] = { score: scoreVal, maxScore: secondaryMaxScoreVal };
      }
    });

    setCommonTestScores(commonTest);
    setSecondaryTestScores(secondaryTest);
  }, [subjectScoresQuery.data]); // Depend on the query data

  // Save scores using tRPC mutation
  const handleSaveScores = () => {
    setError(null); // Clear previous errors
    const scoresToSave: { exam_type: SubjectExamType; subject: string; score?: number; max_score?: number }[] = [];

    for (const subject of COMMON_TEST_SUBJECTS) {
      const data = commonTestScores[subject];
      // Only include if score or maxScore is entered and valid
      const scoreNum = data?.score ? parseFloat(data.score) : undefined;
      const maxScoreNum = data?.maxScore ? parseFloat(data.maxScore) : undefined;
       if (data && (!isNaN(scoreNum ?? NaN) || !isNaN(maxScoreNum ?? NaN))) {
         scoresToSave.push({
           exam_type: '共テ',
           subject,
           score: !isNaN(scoreNum ?? NaN) ? scoreNum : undefined,
           max_score: !isNaN(maxScoreNum ?? NaN) ? maxScoreNum : undefined,
         });
       }
    }

    for (const subject of SECONDARY_TEST_SUBJECTS) {
      const data = secondaryTestScores[subject];
       const scoreNum = data?.score ? parseFloat(data.score) : undefined;
       const maxScoreNum = data?.maxScore ? parseFloat(data.maxScore) : undefined;
       if (data && (!isNaN(scoreNum ?? NaN) || !isNaN(maxScoreNum ?? NaN))) {
         scoresToSave.push({
           exam_type: '二次試験',
           subject,
           score: !isNaN(scoreNum ?? NaN) ? scoreNum : undefined,
           max_score: !isNaN(maxScoreNum ?? NaN) ? maxScoreNum : undefined,
         });
       }
    }

    if (scoresToSave.length > 0) {
      saveScoresMutation.mutate({ examId, scores: scoresToSave });
    } else {
      setEditMode(false); // Exit edit mode if nothing to save
    }
    // onSuccess/onError handlers in mutation handle UI updates
  };

  // Delete score using tRPC mutation
  const handleDeleteScore = (scoreId: number) => {
    if (window.confirm('この点数を削除してもよろしいですか？')) {
        setError(null); // Clear previous errors
        deleteScoreMutation.mutate({ scoreId });
    }
    // onSuccess/onError handlers in mutation handle UI updates
  };

  // Handle input changes
   const handleCommonTestScoreChange = (subject: string, field: 'score' | 'maxScore', value: string) => {
    setCommonTestScores(prev => ({
      ...prev,
      [subject]: { ...prev[subject], [field]: value }
    }));
  };
  const handleSecondaryTestScoreChange = (subject: string, field: 'score' | 'maxScore', value: string) => {
    setSecondaryTestScores(prev => ({
      ...prev,
      [subject]: { ...prev[subject], [field]: value }
    }));
  };

  // Calculate total score locally based on query data
  const calculateTotalScore = (scores: SubjectScore[] | undefined) => {
    if (!scores) return { totalScore: 0, totalMaxScore: 0 };
    let totalScore = 0;
    let totalMaxScore = 0;
    scores.forEach(score => {
      totalScore += score.score ?? 0;
      totalMaxScore += score.max_score ?? 0;
    });
    return { totalScore, totalMaxScore };
  };
  const { totalScore, totalMaxScore } = calculateTotalScore(subjectScoresQuery.data);

  // Render Common Test Scores
  const renderCommonTestScores = () => {
    // Show based on the exam's format type derived from examQuery
    if (examFormatType !== 'multiple_choice' && examFormatType !== 'combined') return null;

    const scores = subjectScoresQuery.data?.filter((score) => score.exam_type === '共テ') || [];

    if (editMode) {
      return (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">共通テスト</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              {/* Table Head */}
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">得点</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">満点</th>
                </tr>
              </thead>
              {/* Table Body */}
              <tbody className="divide-y divide-gray-200">
                {COMMON_TEST_SUBJECTS.map(subject => (
                  <tr key={`common-${subject}`}>
                    <td className="py-2 px-3 whitespace-nowrap">{subject.replace('_', '/')}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <input
                        type="number"
                        className="w-20 p-1 border border-gray-300 rounded-md"
                        value={commonTestScores[subject]?.score || ''}
                        onChange={(e) => handleCommonTestScoreChange(subject, 'score', e.target.value)}
                        placeholder="得点" step="0.1"
                      />
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <input
                        type="number"
                        className="w-20 p-1 border border-gray-300 rounded-md"
                        value={commonTestScores[subject]?.maxScore || ''}
                        onChange={(e) => handleCommonTestScoreChange(subject, 'maxScore', e.target.value)}
                        placeholder="満点" step="0.1"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    // Display mode
    if (!subjectScoresQuery.isLoading && scores.length === 0) {
       return (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">共通テスト</h3>
          <div className="text-center py-4 text-gray-500 bg-gray-50 rounded border">
            <p>共通テストの点数データはありません</p>
            <p className="text-xs mt-1">「編集」ボタンから登録できます</p>
          </div>
        </div>
      );
    }
    return (
       <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">共通テスト</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            {/* Table Head */}
             <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">得点</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">満点</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            {/* Table Body */}
            <tbody className="divide-y divide-gray-200">
              {scores.map((score) => (
                <tr key={score.id}>
                  <td className="py-2 px-3 whitespace-nowrap">{score.subject.replace('_', '/')}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.score ?? '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.max_score ?? '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <button onClick={() => handleDeleteScore(score.id)} className="text-red-500 hover:text-red-700" title="削除" disabled={deleteScoreMutation.isPending}>
                      <Trash className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render Secondary Test Scores
  const renderSecondaryTestScores = () => {
    // Show based on the exam's format type derived from examQuery
    if (examFormatType !== 'descriptive' && examFormatType !== 'combined') return null;

    const scores = subjectScoresQuery.data?.filter((score) => score.exam_type === '二次試験') || [];

     if (editMode) {
      return (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">二次試験</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
               {/* Table Head */}
               <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">得点</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">満点</th>
                </tr>
              </thead>
              {/* Table Body */}
              <tbody className="divide-y divide-gray-200">
                {SECONDARY_TEST_SUBJECTS.map(subject => (
                  <tr key={`secondary-${subject}`}>
                    <td className="py-2 px-3 whitespace-nowrap">{subject}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <input
                        type="number"
                        className="w-20 p-1 border border-gray-300 rounded-md"
                        value={secondaryTestScores[subject]?.score || ''}
                        onChange={(e) => handleSecondaryTestScoreChange(subject, 'score', e.target.value)}
                        placeholder="得点" step="0.1"
                      />
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <input
                        type="number"
                        className="w-20 p-1 border border-gray-300 rounded-md"
                        value={secondaryTestScores[subject]?.maxScore || ''}
                        onChange={(e) => handleSecondaryTestScoreChange(subject, 'maxScore', e.target.value)}
                        placeholder="満点" step="0.1"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    // Display mode
     if (!subjectScoresQuery.isLoading && scores.length === 0) {
       return (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">二次試験</h3>
          <div className="text-center py-4 text-gray-500 bg-gray-50 rounded border">
            <p>二次試験の点数データはありません</p>
            <p className="text-xs mt-1">「編集」ボタンから登録できます</p>
          </div>
        </div>
      );
    }
    return (
       <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">二次試験</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
             {/* Table Head */}
             <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">得点</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">満点</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            {/* Table Body */}
            <tbody className="divide-y divide-gray-200">
              {scores.map((score) => (
                <tr key={score.id}>
                  <td className="py-2 px-3 whitespace-nowrap">{score.subject}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.score ?? '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.max_score ?? '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <button onClick={() => handleDeleteScore(score.id)} className="text-red-500 hover:text-red-700" title="削除" disabled={deleteScoreMutation.isPending}>
                      <Trash className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render Total Score
  const renderTotalScore = () => {
    if (!subjectScoresQuery.data || subjectScoresQuery.data.length === 0) return null;

    return (
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">合計点</h3>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-2xl font-bold">{totalScore} <span className="text-sm font-normal">/ {totalMaxScore}</span></p>
            {totalMaxScore > 0 && (
              <p className="text-sm text-gray-600">
                {Math.round((totalScore / totalMaxScore) * 1000) / 10}%
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render Error
  const renderError = () => {
    // Combine query and mutation errors
    const errorToShow = subjectScoresQuery.error?.message || error?.message || null;
    if (!errorToShow) return null;
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-start">
        <AlertCircle className="w-5 h-5 mr-2 mt-0.5" />
        <div>
          <p className="font-semibold">エラーが発生しました</p>
          <p>{errorToShow}</p>
        </div>
      </div>
    );
  };

  // Main component render
  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">科目別点数</h2>
        {editMode ? (
          <div className="flex gap-2">
            <button onClick={() => setEditMode(false)} className="btn btn-outline btn-sm">キャンセル</button>
            <button onClick={handleSaveScores} className="btn btn-primary btn-sm flex items-center" disabled={saveScoresMutation.isPending}>
              {saveScoresMutation.isPending ? (
                 <> <span className="loading loading-spinner loading-xs mr-2"></span> 保存中... </>
              ) : (
                 <> <Save className="w-4 h-4 mr-1" /> 保存 </>
              )}
            </button>
          </div>
        ) : (
          <button onClick={() => setEditMode(true)} className="btn btn-primary btn-sm flex items-center">
            <Plus className="w-4 h-4 mr-1" /> 編集
          </button>
        )}
      </div>

      {renderError()} {/* Display query or mutation errors */}

      {subjectScoresQuery.isLoading && !editMode ? ( // Use query loading state for display mode
        <div className="text-center py-8 text-gray-500">
          <span className="loading loading-spinner loading-lg"></span>
          <p>点数データを読み込み中...</p>
        </div>
      ) : (
        <>
          {renderTotalScore()}
          {renderCommonTestScores()}
          {renderSecondaryTestScores()}
        </>
      )}
    </div>
  );
};

export default ExamSubjectScores;
