import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Save, Trash, Plus } from 'lucide-react';
import { trpc } from '../lib/trpc.js';
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
  const utils = trpc.useUtils();
  const examQuery = trpc.exam.getById.useQuery({ id: examId }, {
    enabled: !!examId,
    staleTime: Infinity,
  });
  const subjectScoresQuery = trpc.exam.getSubjectScoresByExamId.useQuery({ examId }, {
    enabled: !!examId,
  });
  const saveScoresMutation = trpc.exam.batchUpsertSubjectScores.useMutation({
    onSuccess: () => {
      utils.exam.getSubjectScoresByExamId.invalidate({ examId });
      setEditMode(false);
      },
    });
  const deleteScoreMutation = trpc.exam.deleteSubjectScore.useMutation({
     onSuccess: () => {
      utils.exam.getSubjectScoresByExamId.invalidate({ examId });
      },
     });

  const [examFormatType, setExamFormatType] = useState<string>('descriptive');
  const [editMode, setEditMode] = useState(false);
  const [scoresByExamType, setScoresByExamType] = useState<Record<SubjectExamType, Record<string, { score: string, maxScore: string }>>>({
    '共テ': {},
    '二次試験': {},
  });

  useEffect(() => {
    if (examQuery.data) {
      setExamFormatType(examQuery.data.exam_type);
    }
  }, [examQuery.data]);

  useEffect(() => {
    if (!subjectScoresQuery.data) return;

    const initialScores: Record<SubjectExamType, Record<string, { score: string, maxScore: string }>> = {
      '共テ': {},
      '二次試験': {},
    };

    COMMON_TEST_SUBJECTS.forEach(subject => {
      const defaultMaxScore = COMMON_TEST_MAX_SCORES[subject] !== undefined ? String(COMMON_TEST_MAX_SCORES[subject]) : '';
      initialScores['共テ'][subject] = { score: '', maxScore: defaultMaxScore };
    });
    SECONDARY_TEST_SUBJECTS.forEach(subject => {
      initialScores['二次試験'][subject] = { score: '', maxScore: '' };
    });

    subjectScoresQuery.data.forEach((score) => {
      const scoreVal = score.score !== null && score.score !== undefined ? String(score.score) : '';
      const maxScoreVal = score.max_score !== null && score.max_score !== undefined ? String(score.max_score) : '';

      if (score.exam_type === '共テ' && initialScores['共テ'][score.subject]) {
        const finalMaxScore = maxScoreVal || initialScores['共テ'][score.subject].maxScore;
        initialScores['共テ'][score.subject] = { score: scoreVal, maxScore: finalMaxScore };
      } else if (score.exam_type === '二次試験' && initialScores['二次試験'][score.subject]) {
        initialScores['二次試験'][score.subject] = { score: scoreVal, maxScore: maxScoreVal };
      }
    });

    setScoresByExamType(initialScores);
  }, [subjectScoresQuery.data]);

  const handleSaveScores = () => {
    const scoresToSave: { exam_type: SubjectExamType; subject: string; score?: number; max_score?: number }[] = [];

    (Object.keys(scoresByExamType) as SubjectExamType[]).forEach(examType => {
      const subjects = examType === '共テ' ? COMMON_TEST_SUBJECTS : SECONDARY_TEST_SUBJECTS;
      subjects.forEach(subject => {
        const data = scoresByExamType[examType]?.[subject];
        if (!data) return;

        const scoreNum = data.score ? parseFloat(data.score) : undefined;
        const maxScoreNum = data.maxScore ? parseFloat(data.maxScore) : undefined;

        if (!isNaN(scoreNum ?? NaN) || !isNaN(maxScoreNum ?? NaN)) {
          scoresToSave.push({
            exam_type: examType,
            subject,
            score: !isNaN(scoreNum ?? NaN) ? scoreNum : undefined,
            max_score: !isNaN(maxScoreNum ?? NaN) ? maxScoreNum : undefined,
          });
        }
      });
    });


    if (scoresToSave.length > 0) {
      saveScoresMutation.mutate({ examId, scores: scoresToSave });
    } else {
      setEditMode(false);
    }
  };

  const handleDeleteScore = (scoreId: number) => {
    if (window.confirm('この点数を削除してもよろしいですか？')) {
        deleteScoreMutation.mutate({ scoreId });
    }
  };

  const handleScoreChange = (examType: SubjectExamType, subject: string, field: 'score' | 'maxScore', value: string) => {
    setScoresByExamType(prev => ({
      ...prev,
      [examType]: {
        ...prev[examType],
        [subject]: {
          ...(prev[examType]?.[subject] || { score: '', maxScore: '' }),
          [field]: value
        }
      }
    }));
  };


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

  const renderScoresTable = (
    examType: SubjectExamType,
    title: string,
    subjects: string[],
    displayCondition: boolean
  ) => {
    if (!displayCondition) return null;

    const scores = subjectScoresQuery.data?.filter((score) => score.exam_type === examType) || [];
    const currentEditScores = scoresByExamType[examType] || {};

    if (editMode) {
      return (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">得点</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">満点</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {subjects.map(subject => (
                  <tr key={`${examType}-${subject}`}>
                    <td className="py-2 px-3 whitespace-nowrap">{subject.replace('_', '/')}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <input
                        type="number"
                        className="w-20 p-1 border border-gray-300 rounded-md"
                        value={currentEditScores[subject]?.score || ''}
                        onChange={(e) => handleScoreChange(examType, subject, 'score', e.target.value)}
                        placeholder="得点" step="0.1"
                      />
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <input
                        type="number"
                        className="w-20 p-1 border border-gray-300 rounded-md"
                        value={currentEditScores[subject]?.maxScore || ''}
                        onChange={(e) => handleScoreChange(examType, subject, 'maxScore', e.target.value)}
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

    if (!subjectScoresQuery.isLoading && scores.length === 0) {
      return (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <div className="text-center py-4 text-gray-500 bg-gray-50 rounded border">
            <p>{title}の点数データはありません</p>
            <p className="text-xs mt-1">「編集」ボタンから登録できます</p>
          </div>
        </div>
      );
    }

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">得点</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">満点</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
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

      {subjectScoresQuery.isLoading && !editMode ? (
        <div className="text-center py-8 text-gray-500">
          <span className="loading loading-spinner loading-lg"></span>
          <p>点数データを読み込み中...</p>
        </div>
      ) : (
        <>
          {renderTotalScore()}
          {renderScoresTable(
            '共テ',
            '共通テスト',
            COMMON_TEST_SUBJECTS,
            examFormatType === 'multiple_choice' || examFormatType === 'combined'
          )}
          {renderScoresTable(
            '二次試験',
            '二次試験',
            SECONDARY_TEST_SUBJECTS,
            examFormatType === 'descriptive' || examFormatType === 'combined'
          )}
        </>
      )}
    </div>
  );
};

export default ExamSubjectScores;
