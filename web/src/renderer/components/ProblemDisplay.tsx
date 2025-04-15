import { useState, useEffect } from 'react';
import { parse, compareDesc } from 'date-fns';
import { BookOpen, Eye, EyeOff, RotateCcw, Check, ThumbsUp, AlertCircle } from 'lucide-react';
import { trpc } from '../lib/trpc'; // tRPC クライアントをインポート

// ProblemViewから移動した型定義
export interface ProblemData {
  cardId: number;
  noteId: number;
  question: string;
  answer: string;
  deckName?: string;
  fields?: Record<string, { value: string; order: number }>;
  tags?: string[];
  // レビューモード用 (ReviewPageで使用)
  nextReviews?: string[];
  buttons?: number[];
}

interface ProblemDisplayProps {
  problemData: ProblemData | null;
  isLoading: boolean;
  error?: Error | null; // tRPCエラーなど
  showAnswer: boolean;
  onToggleAnswer: () => void;
  onAnswer?: (ease: 1 | 2 | 3 | 4) => Promise<void>; // レビューページから渡される
  isAnswering?: boolean; // レビューページから渡される
  isReviewMode?: boolean; // レビューボタン表示制御用
  mediaServerUrl?: string;
}

/**
 * 問題と解答の表示に特化したコンポーネント
 */
const ProblemDisplay = ({
  problemData,
  isLoading,
  error,
  showAnswer,
  onToggleAnswer,
  onAnswer,
  isAnswering,
  isReviewMode = false,
  mediaServerUrl = '/media'
}: ProblemDisplayProps) => {

  // --- メディアURL処理 ---
  const processHtml = (html: string) => {
    if (!mediaServerUrl || !html) return html;
    return html.replace(
      /<img\s+src="([^"]+)"/g,
      (match: string, filename: string) => {
        // 絶対パスやデータURLはそのまま
        if (filename.startsWith('http://') || filename.startsWith('https://') || filename.startsWith('data:')) {
          return match; // 元のタグを返す
        }
        // それ以外はメディアサーバーのURLを付与
        return `<img src="${mediaServerUrl}/${filename}"`;
      }
    );
  };
  // --- メディアURL処理ここまで ---

  // --- 裏面の内容から解答エントリを抽出する関数 ---
  const extractAnswerEntries = (content: string): { date: string; content: string }[] => {
    if (!content) return [];
    const entryRegex = /<div class="answer-entry"><p><strong>([^<]+)<\/strong><\/p>([\s\S]*?)<\/div>/g;
    const entries: { date: string; content: string }[] = [];
    let match;
    while ((match = entryRegex.exec(content)) !== null) {
      const dateStr = match[1];
      const entryContent = match[0];
      entries.push({ date: dateStr, content: entryContent });
    }
    // 過去解答の抽出ロジックは維持
    if (content.includes('<hr><div class="answer-entry">')) {
      const pastAnswerRegex = /<hr><div class="answer-entry"><p><strong>([^<]+)<\/strong><\/p>([\s\S]*?)<\/div>/g;
      while ((match = pastAnswerRegex.exec(content)) !== null) {
        const dateStr = match[1];
        const entryContent = match[0];
        if (!entries.some(entry => entry.date === dateStr)) {
          entries.push({ date: dateStr, content: content });
        }
      }
    }
    return entries.sort((a, b) => {
      try {
        const dateA = parse(a.date, 'yyyy/MM/dd HH:mm:ss', new Date());
        const dateB = parse(b.date, 'yyyy/MM/dd HH:mm:ss', new Date());
        return compareDesc(dateA, dateB);
      } catch (e) {
        console.error("Error parsing date for sorting:", a.date, b.date, e);
        return 0;
      }
    });
  };
  // --- 解答エントリ抽出ここまで ---

  // 過去解答の抽出 (problemDataが更新されたら再計算)
  const [pastAnswers, setPastAnswers] = useState<{ date: string; content: string }[]>([]);
  useEffect(() => {
    const pastAnswerField = problemData?.fields?.['過去解答']?.value;
    if (pastAnswerField) {
      setPastAnswers(extractAnswerEntries(pastAnswerField));
    } else {
      setPastAnswers([]);
    }
  }, [problemData]);


  // --- レンダリング ---
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        <span className="ml-2 text-lg">問題データを読み込み中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-start">
        <AlertCircle className="w-5 h-5 mr-2 mt-0.5" />
        <div>
          <p className="font-semibold">問題データの取得中にエラーが発生しました</p>
          <p>{error.message}</p>
        </div>
      </div>
    );
  }

  // problemData が null の場合の表示は呼び出し元 (ReviewPage) に任せる
  if (!problemData) {
    return null; // 何もレンダリングしない
  }


  return (
    <div className="card p-6 border rounded-lg shadow-sm mb-4 bg-white">
      <h2 className="text-xl font-semibold mb-3 flex items-center">
        <BookOpen className="w-5 h-5 mr-2" />
        問題情報
      </h2>

      {/* デッキ名 */}
      {problemData.deckName && (
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-1">デッキ</div>
          <div className="font-medium">{problemData.deckName}</div>
        </div>
      )}

      {/* タグ */}
      {problemData.tags && problemData.tags.length > 0 && (
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-1">タグ</div>
          <div className="flex flex-wrap gap-1">
            {problemData.tags.map((tag: string) => (
              <span key={tag} className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* 表面 */}
      <div className="mb-4">
        <div className="text-sm text-gray-500 mb-1">表面</div>
        <div className="p-3 bg-gray-50 rounded border prose max-w-none" dangerouslySetInnerHTML={{ __html: processHtml(problemData.question) }} />
      </div>

      {/* 解答表示ボタン */}
      <div className="mb-4">
        <button onClick={onToggleAnswer} className="btn btn-outline flex items-center">
          {showAnswer ? (<><EyeOff className="w-4 h-4 mr-2" />解答を隠す</>) : (<><Eye className="w-4 h-4 mr-2" />解答を表示</>)}
        </button>
      </div>

      {/* 裏面とレビューボタン */}
      {showAnswer && (
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-1">裏面（解答）</div>
          <div className="p-3 bg-gray-50 rounded border prose max-w-none" dangerouslySetInnerHTML={{ __html: processHtml(problemData.answer || '解答がありません') }} />

          {/* レビューモード用の解答ボタンは削除 (コントロールパネルと重複するため) */}
        </div>
      )}

      {/* 過去の解答 */}
      {showAnswer && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm text-gray-500">過去の解答用紙</div>
          </div>
          {pastAnswers.length > 0 ? (
            <div className="p-3 bg-gray-50 rounded border prose max-w-none">
              {pastAnswers.map((entry, index) => (
                <div key={index} dangerouslySetInnerHTML={{ __html: processHtml(entry.content) }} />
              ))}
            </div>
          ) : (
            <div className="p-3 bg-gray-50 rounded border text-gray-500">過去の解答はありません</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProblemDisplay;
