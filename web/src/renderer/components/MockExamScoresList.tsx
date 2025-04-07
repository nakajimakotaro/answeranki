import { format, parseISO } from 'date-fns';
import { AlertCircle, FileCheck, RefreshCw } from 'lucide-react';
import { trpc } from '../lib/trpc.js';

interface NoteExamScoreData {
  id: number; // Assuming score ID
  exam_id: number; // Assuming exam ID
  note_id: number;
  descriptive_score?: number | null; // Allow undefined
  multiple_choice_score?: number | null; // Allow undefined
  total_score?: number | null; // Allow undefined
  max_score?: number | null; // Allow undefined
  created_at?: string; // Allow undefined (or Date if parsed)
  updated_at?: string; // Allow undefined (or Date if parsed)
  // Properties joined from the Exam table
  exam_name: string;
  exam_date: string; // Or Date if parsed
  // Add any other properties returned by the query
}


interface MockExamScoresListProps {
  noteId: number;
}

/**
 * 特定のノートの模試点数を表示するコンポーネント
 */
const MockExamScoresList = ({ noteId }: MockExamScoresListProps) => {
  // Removed 'error' from destructuring, it will be handled by GlobalErrorBoundary
  const { data: noteExamScores = [], isLoading, refetch } = trpc.exam.getScoresByNoteId.useQuery(
    { noteId },
    {
      enabled: typeof noteId === 'number' && noteId > 0,
    }
  );

  // 日付をフォーマット
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
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
          onClick={() => refetch()} // Call tRPC refetch function
          className="text-xs text-gray-500 flex items-center hover:text-gray-700"
          title="更新"
          disabled={isLoading} // Disable button while loading
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          更新
       </button>
     </div>

     {/* Removed local error display block */}

     {isLoading ? (
       <div className="text-center py-4 text-gray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-500 mx-auto mb-2"></div>
          <p>模試データを読み込み中...</p>
        </div>
      ) : noteExamScores && noteExamScores.length > 0 ? ( // Check if data exists
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
              {/* Map over the data returned by the tRPC query */}
              {noteExamScores.map((score: NoteExamScoreData) => (
                <tr key={score.id}>
                  {/* Access properties based on the joined data structure (ScoreWithExamDetails) */}
                  <td className="py-2 px-3 whitespace-nowrap">{score.exam_name}</td>
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
