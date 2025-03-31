import { useState, useEffect } from 'react';
import { 
  SubjectScore, 
  COMMON_TEST_SUBJECTS, 
  SECONDARY_TEST_SUBJECTS 
} from '../services/mockExamService';
import { useMockExams } from '../hooks';
import { AlertCircle, Save, Trash, Plus } from 'lucide-react';

interface MockExamSubjectScoresProps {
  mockExamId: number;
}

/**
 * 模試の科目別点数を表示・編集するコンポーネント
 */
const MockExamSubjectScores = ({ mockExamId }: MockExamSubjectScoresProps) => {
  const [examType, setExamType] = useState<string>('descriptive');
  const { 
    mockExams,
    subjectScores, 
    fetchSubjectScores, 
    addOrUpdateSubjectScore,
    batchAddOrUpdateSubjectScores,
    deleteSubjectScore,
    calculateTotalScore,
    isLoading, 
    error 
  } = useMockExams();
  
  // 模試の種類を取得
  useEffect(() => {
    const exam = mockExams.find(exam => exam.id === mockExamId);
    if (exam) {
      setExamType(exam.exam_type || 'descriptive');
    }
  }, [mockExamId, mockExams]);
  
  // 編集モード用の状態
  const [editMode, setEditMode] = useState(false);
  const [commonTestScores, setCommonTestScores] = useState<Record<string, { score: string, maxScore: string }>>({});
  const [secondaryTestScores, setSecondaryTestScores] = useState<Record<string, { score: string, maxScore: string }>>({});
  
  // 初期データ読み込み
  useEffect(() => {
    if (mockExamId) {
      fetchSubjectScores(mockExamId);
    }
  }, [mockExamId, fetchSubjectScores]);
  
  // 点数データが変更されたときに編集用の状態を更新
  useEffect(() => {
    const commonTest: Record<string, { score: string, maxScore: string }> = {};
    const secondaryTest: Record<string, { score: string, maxScore: string }> = {};
    
    // 共通テストの科目ごとに初期値を設定
    COMMON_TEST_SUBJECTS.forEach(subject => {
      commonTest[subject] = { score: '', maxScore: '' };
    });
    
    // 二次試験の科目ごとに初期値を設定
    SECONDARY_TEST_SUBJECTS.forEach(subject => {
      secondaryTest[subject] = { score: '', maxScore: '' };
    });
    
    // 既存の点数データを反映
    subjectScores.forEach(score => {
      if (score.exam_type === '共テ' && commonTest[score.subject]) {
        commonTest[score.subject] = {
          score: score.score !== null && score.score !== undefined ? String(score.score) : '',
          maxScore: score.max_score !== null && score.max_score !== undefined ? String(score.max_score) : ''
        };
      } else if (score.exam_type === '二次試験' && secondaryTest[score.subject]) {
        secondaryTest[score.subject] = {
          score: score.score !== null && score.score !== undefined ? String(score.score) : '',
          maxScore: score.max_score !== null && score.max_score !== undefined ? String(score.max_score) : ''
        };
      }
    });
    
    setCommonTestScores(commonTest);
    setSecondaryTestScores(secondaryTest);
  }, [subjectScores]);
  
  // 点数の保存
  const handleSaveScores = async () => {
    const scoresToSave = [];
    
    // 共通テストの点数を追加
    for (const subject of COMMON_TEST_SUBJECTS) {
      const data = commonTestScores[subject];
      if (data && (data.score || data.maxScore)) {
        scoresToSave.push({
          exam_type: '共テ',
          subject,
          score: data.score ? parseFloat(data.score) : undefined,
          max_score: data.maxScore ? parseFloat(data.maxScore) : undefined
        });
      }
    }
    
    // 二次試験の点数を追加
    for (const subject of SECONDARY_TEST_SUBJECTS) {
      const data = secondaryTestScores[subject];
      if (data && (data.score || data.maxScore)) {
        scoresToSave.push({
          exam_type: '二次試験',
          subject,
          score: data.score ? parseFloat(data.score) : undefined,
          max_score: data.maxScore ? parseFloat(data.maxScore) : undefined
        });
      }
    }
    
    if (scoresToSave.length > 0) {
      await batchAddOrUpdateSubjectScores(mockExamId, scoresToSave);
    }
    
    setEditMode(false);
  };
  
  // 点数の削除
  const handleDeleteScore = async (scoreId: number) => {
    if (window.confirm('この点数を削除してもよろしいですか？')) {
      await deleteSubjectScore(mockExamId, scoreId);
    }
  };
  
  // 共通テストの点数入力を処理
  const handleCommonTestScoreChange = (subject: string, field: 'score' | 'maxScore', value: string) => {
    setCommonTestScores(prev => ({
      ...prev,
      [subject]: {
        ...prev[subject],
        [field]: value
      }
    }));
  };
  
  // 二次試験の点数入力を処理
  const handleSecondaryTestScoreChange = (subject: string, field: 'score' | 'maxScore', value: string) => {
    setSecondaryTestScores(prev => ({
      ...prev,
      [subject]: {
        ...prev[subject],
        [field]: value
      }
    }));
  };
  
  // 合計点を計算
  const { totalScore, totalMaxScore } = calculateTotalScore(subjectScores);
  
  // 共通テストの点数を表示
  const renderCommonTestScores = () => {
    // マーク式の場合のみ共通テストを表示
    if (examType !== 'multiple_choice') return null;
    
    const commonTestSubjectScores = subjectScores.filter(score => score.exam_type === '共テ');
    
    if (editMode) {
      return (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">共通テスト</h3>
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
                {COMMON_TEST_SUBJECTS.map(subject => (
                  <tr key={subject}>
                    <td className="py-2 px-3 whitespace-nowrap">{subject.replace('_', '/')}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <input
                        type="number"
                        className="w-20 p-1 border border-gray-300 rounded-md"
                        value={commonTestScores[subject]?.score || ''}
                        onChange={(e) => handleCommonTestScoreChange(subject, 'score', e.target.value)}
                        placeholder="得点"
                        step="0.1"
                      />
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <input
                        type="number"
                        className="w-20 p-1 border border-gray-300 rounded-md"
                        value={commonTestScores[subject]?.maxScore || ''}
                        onChange={(e) => handleCommonTestScoreChange(subject, 'maxScore', e.target.value)}
                        placeholder="満点"
                        step="0.1"
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
    
    if (commonTestSubjectScores.length === 0) {
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
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">得点</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">満点</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {commonTestSubjectScores.map(score => (
                <tr key={score.id}>
                  <td className="py-2 px-3 whitespace-nowrap">{score.subject.replace('_', '/')}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.score !== null ? score.score : '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.max_score !== null ? score.max_score : '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <button
                      onClick={() => handleDeleteScore(score.id)}
                      className="text-red-500 hover:text-red-700"
                      title="削除"
                    >
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
  
  // 二次試験の点数を表示
  const renderSecondaryTestScores = () => {
    // 記述式の場合のみ二次試験を表示
    if (examType !== 'descriptive') return null;
    
    const secondaryTestSubjectScores = subjectScores.filter(score => score.exam_type === '二次試験');
    
    if (editMode) {
      return (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">二次試験</h3>
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
                {SECONDARY_TEST_SUBJECTS.map(subject => (
                  <tr key={subject}>
                    <td className="py-2 px-3 whitespace-nowrap">{subject}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <input
                        type="number"
                        className="w-20 p-1 border border-gray-300 rounded-md"
                        value={secondaryTestScores[subject]?.score || ''}
                        onChange={(e) => handleSecondaryTestScoreChange(subject, 'score', e.target.value)}
                        placeholder="得点"
                        step="0.1"
                      />
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <input
                        type="number"
                        className="w-20 p-1 border border-gray-300 rounded-md"
                        value={secondaryTestScores[subject]?.maxScore || ''}
                        onChange={(e) => handleSecondaryTestScoreChange(subject, 'maxScore', e.target.value)}
                        placeholder="満点"
                        step="0.1"
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
    
    if (secondaryTestSubjectScores.length === 0) {
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
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">得点</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">満点</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {secondaryTestSubjectScores.map(score => (
                <tr key={score.id}>
                  <td className="py-2 px-3 whitespace-nowrap">{score.subject}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.score !== null ? score.score : '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.max_score !== null ? score.max_score : '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <button
                      onClick={() => handleDeleteScore(score.id)}
                      className="text-red-500 hover:text-red-700"
                      title="削除"
                    >
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
  
  // 合計点を表示
  const renderTotalScore = () => {
    if (subjectScores.length === 0) {
      return null;
    }
    
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
    <div className="mt-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">科目別点数</h2>
        {editMode ? (
          <div className="flex gap-2">
            <button
              onClick={() => setEditMode(false)}
              className="btn btn-outline btn-sm"
            >
              キャンセル
            </button>
            <button
              onClick={handleSaveScores}
              className="btn btn-primary btn-sm flex items-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" />
                  保存
                </>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="btn btn-primary btn-sm flex items-center"
          >
            <Plus className="w-4 h-4 mr-1" />
            編集
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

export default MockExamSubjectScores;
