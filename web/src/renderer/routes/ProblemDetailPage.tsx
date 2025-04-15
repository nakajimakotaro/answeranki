import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RefreshCw, ChevronLeft, AlertCircle } from 'lucide-react';
import ProblemDisplay, { ProblemData } from '../components/ProblemDisplay';
import { trpc } from '../lib/trpc';

/**
 * 問題詳細ページ
 */
const ProblemDetailPage = () => {
  const { noteId: noteIdString } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const noteId = noteIdString ? parseInt(noteIdString, 10) : undefined;

  const [showAnswer, setShowAnswer] = useState(false);
  const [problemData, setProblemData] = useState<ProblemData | null>(null);

  // --- tRPC データ取得ロジック ---

  // 1. noteId から notesInfo を取得
  const { data: notesInfoData, isLoading: isLoadingNotesInfo, error: notesInfoError, refetch: refetchNotesInfo } = trpc.anki.note.notesInfo.useQuery(
    { notes: [noteId!] },
    { enabled: !!noteId }
  );
  const cardIdFromNote = notesInfoData?.[0]?.cards?.[0]; // notesInfo から cardId を取得

  // 2. notesInfo から得た cardId で cardsInfo を取得
  const { data: cardsInfoData, isLoading: isLoadingCardsInfo, error: cardsInfoError, refetch: refetchCardsInfo } = trpc.anki.card.cardsInfo.useQuery(
    { cards: [cardIdFromNote!] },
    { enabled: !!cardIdFromNote }
  );

  // --- データ結合ロジック ---
  useEffect(() => {
    let data: ProblemData | null = null;
    const cardInfo = cardsInfoData?.[0];
    const noteInfo = notesInfoData?.[0];

    if (cardInfo && noteInfo) {
      data = {
        cardId: cardInfo.cardId,
        noteId: cardInfo.note,
        question: cardInfo.question, // cardInfo から取得
        answer: cardInfo.answer,     // cardInfo から取得
        deckName: cardInfo.deckName,
        fields: cardInfo.fields,
        tags: noteInfo.tags,
        // 詳細ページでは nextReviews, buttons は不要
      };
    }
    setProblemData(data);
  }, [cardsInfoData, notesInfoData]);

  // --- ハンドラー関数 ---

  const handleRefresh = useCallback(() => {
    if (noteId) refetchNotesInfo();
    if (cardIdFromNote) refetchCardsInfo();
    setShowAnswer(false);
  }, [noteId, cardIdFromNote, refetchNotesInfo, refetchCardsInfo]);

  const handleNavigateBack = useCallback(() => {
    navigate(-1); // 前のページに戻る
  }, [navigate]);

  const handleToggleAnswer = useCallback(() => {
    setShowAnswer(prev => !prev);
  }, []);

  // --- ローディングとエラー状態の集約 ---
  const isLoading = isLoadingNotesInfo || isLoadingCardsInfo;
  const queryError = notesInfoError || cardsInfoError;

  return (
    <div className="container mx-auto p-4">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">問題詳細</h1>
        <div className="flex gap-2">
          <button
            onClick={handleNavigateBack}
            className="btn btn-outline flex items-center"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            戻る
          </button>
          <button
            onClick={handleRefresh}
            className="btn btn-primary flex items-center"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? '読込中' : '更新'}
          </button>
        </div>
      </div>

      {/* グローバルエラー表示 */}
      {queryError && !isLoading && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 mt-0.5" />
          <div>
            <p className="font-semibold">エラーが発生しました</p>
            <p>{queryError.message}</p>
          </div>
        </div>
      )}

      {/* 問題表示エリア */}
      <ProblemDisplay
        problemData={problemData}
        isLoading={isLoading}
        // error はここで表示するので渡さない
        showAnswer={showAnswer}
        onToggleAnswer={handleToggleAnswer}
        // 詳細ページでは onAnswer, isAnswering, isReviewMode は不要
      />

      {/* データがない場合の表示 (ローディング完了後) */}
      {!isLoading && !problemData && !queryError && (
         <div className="text-center text-gray-500 py-10">
           指定された問題が見つかりません。
         </div>
      )}
    </div>
  );
};

export default ProblemDetailPage;
