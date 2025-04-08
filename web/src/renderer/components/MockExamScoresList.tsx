import { format } from 'date-fns';
import { AlertCircle, FileCheck, RefreshCw } from 'lucide-react';
import { trpc } from '../lib/trpc.js';

interface MockExamScoresListProps {
  noteId: number;
}

/**
 * 特定のノートの模試点数を表示するコンポーネント
 */
const MockExamScoresList = ({ noteId }: MockExamScoresListProps) => {
  const { data: noteExamScores = [], isLoading, refetch } = trpc.exam.getScoresByNoteId.useQuery(
    { noteId },
    {
      enabled: typeof noteId === 'number' && noteId > 0,
    }
  );

  // 日付をフォーマット
  const formatDate = (date: Date) => {
    return format(date, 'yyyy年M月d日');
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-gray-500 flex items-center">
          <FileCheck className="w-4 h-4 mr-1" />
          模試の点数
        </div>
        <button
          onClick={() => refetch()} 
          className="text-xs text-gray-500 flex items-center hover:text-gray-700"
          title="更新"
          disabled={isLoading}
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          更新
       </button>
     </div>

     {isLoading ? (
       <div className="text-center py-4 text-gray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-500 mx-auto mb-2"></div>
          <p>模試データを読み込み中...</p>
        </div>
      ) : noteExamScores && noteExamScores.length > 0 ? (
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
              {/* Map over the data returned by the tRPC query, let TS infer 'score' type */}
              {noteExamScores.map((score) => (
                <tr key={score.id}>
                  {/* Access properties based on the inferred type */}
                  <td className="py-2 px-3 whitespace-nowrap">{score.exam_name}</td>
                  {/* Pass Date object directly to formatDate */}
                  <td className="py-2 px-3 whitespace-nowrap">{score.exam_date ? formatDate(score.exam_date) : '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.descriptive_score ?? '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.multiple_choice_score ?? '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.total_score ?? '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{score.max_score ?? '-'}</td>
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
