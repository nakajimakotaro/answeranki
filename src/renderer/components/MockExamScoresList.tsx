import { useState, useEffect } from 'react';
import { AlertCircle, FileCheck, RefreshCw } from 'lucide-react';
import { useMockExams } from '../hooks';
import { MockExamScore } from '../services/mockExamService';

interface MockExamScoresListProps {
  noteId: number;
}

/**
 * 特定のノートの模試点数を表示するコンポーネント
 */
const MockExamScoresList = ({ noteId }: MockExamScoresListProps) => {
  const { noteScores, isLoading, error, fetchNoteScores } = useMockExams();
  
  // 初期データ読み込み
  useEffect(() => {
    if (noteId) {
      fetchNoteScores(noteId);
    }
  }, [noteId, fetchNoteScores]);
  
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
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-gray-500 flex items-center">
          <FileCheck className="w-4 h-4 mr-1" />
          模試の点数
        </div>
        <button
          onClick={() => fetchNoteScores(noteId)}
          className="text-xs text-gray-500 flex items-center hover:text-gray-700"
          title="更新"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>
      
      {renderError()}
      
      {isLoading ? (
        <div className="text-center py-4 text-gray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-500 mx-auto mb-2"></div>
          <p>模試データを読み込み中...</p>
        </div>
      ) : noteScores.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">模試名</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">実施日</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">記述式</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">マーク式</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">合計点</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">満点</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {noteScores.map((score: MockExamScore) => (
                <tr key={score.id}>
                  <td className="py-2 px-3 whitespace-nowrap">{score.mock_exam_name}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.mock_exam_date ? formatDate(score.mock_exam_date) : '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.descriptive_score !== undefined ? score.descriptive_score : '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.multiple_choice_score !== undefined ? score.multiple_choice_score : '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.total_score !== undefined ? score.total_score : '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.max_score !== undefined ? score.max_score : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500 bg-gray-50 rounded border">
          <p>この問題の模試点数データはありません</p>
          <p className="text-xs mt-1">「模試管理」ページから登録できます</p>
        </div>
      )}
    </div>
  );
};

export default MockExamScoresList;
