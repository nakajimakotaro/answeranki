import { useEffect } from 'react'; // Removed useState
import { format, parseISO, isValid } from 'date-fns'; // Import date-fns functions
import { AlertCircle, FileCheck, RefreshCw } from 'lucide-react';
// import { useExams } from '../hooks'; // Removed useExams import
import { trpc } from '../lib/trpc.js'; // Import trpc
// import { ExamScore } from '../types/exam'; // Type will be inferred from tRPC

// Define the expected structure for the score data explicitly
// This should match the structure returned by the server's getScoresByNoteId procedure
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
 * 特定のノートの模試点数を表示するコンポーネント (tRPC版)
 */
const MockExamScoresList = ({ noteId }: MockExamScoresListProps) => {
  // Use tRPC query to fetch scores for the given noteId
  const { data: noteExamScores = [], isLoading, error, refetch } = trpc.exam.getScoresByNoteId.useQuery(
    { noteId },
    {
      // Only run the query if noteId is a positive number
      enabled: typeof noteId === 'number' && noteId > 0,
    }
  );

  // useEffect for initial fetch is no longer needed as useQuery handles it based on 'enabled' option

  // 日付をフォーマット (date-fns を使用)
  const formatDate = (dateString: string) => {
    try {
      const date = parseISO(dateString); // Assume 'yyyy-MM-dd' format
      if (!isValid(date)) {
        return '無効な日付';
      }
      return format(date, 'yyyy年M月d日');
    } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return '日付エラー';
    }
  };

  // No separate renderError function needed, handle inline

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

      {/* Display tRPC query error */}
      {error && (
         <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-start">
           <AlertCircle className="w-5 h-5 mr-2 mt-0.5" />
           <div>
             <p className="font-semibold">エラーが発生しました</p>
             <p>{error.message}</p>
           </div>
         </div>
      )}

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
              {noteExamScores.map((score: NoteExamScoreData) => ( // Add explicit type annotation
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
