import { useState, useEffect, useCallback } from 'react';
import { Exam, SubjectExamType } from '../types/exam';
import { examService, COMMON_TEST_SUBJECTS, SECONDARY_TEST_SUBJECTS, COMMON_TEST_MAX_SCORES, SubjectScore } from '../services/examService';
import { useExams } from '../hooks';
import { AlertCircle, Save, Trash, Plus } from 'lucide-react';

interface ExamSubjectScoresProps {
  examId: number;
}

/**
 * 試験の科目別点数を表示・編集するコンポーネント
 */
const ExamSubjectScores = ({ examId }: ExamSubjectScoresProps) => {
  // Use the hook primarily to get the list of exams to find the current exam's type
  const { exams } = useExams();

  // Local state for subject scores, loading, and errors specific to this component
  const [currentExamSubjectScores, setCurrentExamSubjectScores] = useState<SubjectScore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Local state for the specific exam's type (descriptive/multiple_choice/combined)
  const [examFormatType, setExamFormatType] = useState<string>('descriptive');

  // Get the specific exam's type from the exams list provided by the hook
  useEffect(() => {
    const exam = exams.find((ex) => ex.id === examId);
    if (exam) {
      // Use exam_type which corresponds to descriptive/multiple_choice/combined
      setExamFormatType(exam.exam_type);
    }
  }, [examId, exams]);

  // Editing state
  const [editMode, setEditMode] = useState(false);
  const [commonTestScores, setCommonTestScores] = useState<Record<string, { score: string, maxScore: string }>>({});
  const [secondaryTestScores, setSecondaryTestScores] = useState<Record<string, { score: string, maxScore: string }>>({});

  // Fetch scores directly using the service when examId changes
  const fetchScores = useCallback(async () => {
      if (!examId) return;
      setIsLoading(true);
      setError(null);
      try {
          const scores = await examService.getSubjectScores(examId);
          setCurrentExamSubjectScores(scores);
      } catch (err) {
          setError(err instanceof Error ? err : new Error('Failed to fetch subject scores'));
          console.error(`Error fetching subject scores for exam ${examId}:`, err);
      } finally {
          setIsLoading(false);
      }
  }, [examId]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);


  // Update local edit state when scores data changes
  useEffect(() => {
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

    // Use the local state currentExamSubjectScores
    currentExamSubjectScores.forEach((score) => {
      const scoreVal = score.score !== null && score.score !== undefined ? String(score.score) : '';
      // Use existing maxScore if available, otherwise keep the default
      const maxScoreVal = score.max_score !== null && score.max_score !== undefined
        ? String(score.max_score)
        : commonTest[score.subject]?.maxScore || ''; // Keep default if no specific value

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
  }, [currentExamSubjectScores]); // Depend on the scores for the current exam

  // Save scores using the service directly
  const handleSaveScores = async () => {
    setIsLoading(true); // Indicate loading during save
    setError(null);
    const scoresToSave = [];

    for (const subject of COMMON_TEST_SUBJECTS) {
      const data = commonTestScores[subject];
      if (data && (data.score || data.maxScore)) {
        scoresToSave.push({
          exam_type: '共テ' as SubjectExamType, // Cast to type
          subject,
          score: data.score ? parseFloat(data.score) : undefined,
          max_score: data.maxScore ? parseFloat(data.maxScore) : undefined
        });
      }
    }

    for (const subject of SECONDARY_TEST_SUBJECTS) {
      const data = secondaryTestScores[subject];
      if (data && (data.score || data.maxScore)) {
        scoresToSave.push({
          exam_type: '二次試験' as SubjectExamType, // Cast to type
          subject,
          score: data.score ? parseFloat(data.score) : undefined,
          max_score: data.maxScore ? parseFloat(data.maxScore) : undefined
        });
      }
    }

    try {
        if (scoresToSave.length > 0) {
            // Use the service method directly
            await examService.batchAddOrUpdateSubjectScores(examId, scoresToSave);
            await fetchScores(); // Refetch scores after saving
        }
        setEditMode(false);
    } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to save subject scores'));
        console.error(`Error saving subject scores for exam ${examId}:`, err);
    } finally {
        setIsLoading(false);
    }
  };

  // Delete score using the service directly
  const handleDeleteScore = async (scoreId: number) => {
    if (window.confirm('この点数を削除してもよろしいですか？')) {
        setIsLoading(true);
        setError(null);
        try {
            // Use the service method directly
            await examService.deleteSubjectScore(examId, scoreId);
            await fetchScores(); // Refetch scores after deleting
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to delete subject score'));
            console.error(`Error deleting subject score ${scoreId} for exam ${examId}:`, err);
        } finally {
            setIsLoading(false);
        }
    }
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

  // Calculate total score using the hook's utility or service method
  // Note: calculateTotalScore might need to be called differently if it's part of the hook
  // Or it might be provided directly by the hook based on currentExamSubjectScores
  const { totalScore, totalMaxScore } = examService.calculateTotalScore(currentExamSubjectScores); // Keep using service method

  // Render Common Test Scores
  const renderCommonTestScores = () => {
    // Show based on the exam's format type (e.g., multiple_choice or combined)
    if (examFormatType !== 'multiple_choice' && examFormatType !== 'combined') return null;

    const scores = currentExamSubjectScores.filter((score) => score.exam_type === '共テ');

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
    if (scores.length === 0) {
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
                    <button onClick={() => handleDeleteScore(score.id)} className="text-red-500 hover:text-red-700" title="削除" disabled={isLoading}>
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
    // Show based on the exam's format type (e.g., descriptive or combined)
    if (examFormatType !== 'descriptive' && examFormatType !== 'combined') return null;

    const scores = currentExamSubjectScores.filter((score) => score.exam_type === '二次試験');

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
     if (scores.length === 0) {
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
                    <button onClick={() => handleDeleteScore(score.id)} className="text-red-500 hover:text-red-700" title="削除" disabled={isLoading}>
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
    if (currentExamSubjectScores.length === 0) return null;

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

  // Main component render
  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">科目別点数</h2>
        {editMode ? (
          <div className="flex gap-2">
            <button onClick={() => setEditMode(false)} className="btn btn-outline btn-sm">キャンセル</button>
            <button onClick={handleSaveScores} className="btn btn-primary btn-sm flex items-center" disabled={isLoading}>
              {isLoading ? (
                 <> <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div> 保存中... </>
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

      {renderError()}

      {isLoading && !editMode ? (
        <div className="text-center py-8 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-500 mx-auto mb-4"></div>
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
