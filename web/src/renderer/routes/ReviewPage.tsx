import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom'; // useSearchParams をインポート
import { RefreshCw, ChevronLeft, AlertCircle, BookOpen } from 'lucide-react'; // BookOpen をインポート
import ProblemDisplay, { ProblemData } from '../components/ProblemDisplay';
import ReviewPanel from '../components/ReviewPanel/index'; // Corrected import path
import { ReviewPanelSaveData } from '../components/ReviewPanel/types'; // Import type separately
import { trpc } from '../lib/trpc';
// useAnkiAction はまだ使わないのでコメントアウト (必要なら後で追加)
// import { useAddAnswerToNote, useMediaFiles, useAnkiAction } from '../hooks/index.js';
import { useAddAnswerToNote, useMediaFiles } from '../hooks/index.js';

/**
 * Ankiレビューページ
 */
const ReviewPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // searchParams を取得
  const utils = trpc.useUtils();
  const { addAnswerToNote, isLoading: isSavingAnswer, isSuccess: saveSuccess, error: saveError } = useAddAnswerToNote();
  const { uploadImage, isLoading: isMediaLoading } = useMediaFiles(); // 画像アップロード用

  const [showAnswer, setShowAnswer] = useState(false);
  const [problemData, setProblemData] = useState<ProblemData | null>(null);
  const [currentDeckName, setCurrentDeckName] = useState<string | null>(null); // デッキ名を保持する state

  // --- tRPC データ取得ロジック ---

  // 1. 現在のレビューカードを取得
  const { data: currentCard, refetch: refetchCurrentCard, isLoading: isLoadingCurrentCard, error: currentCardError } = trpc.anki.graphical.guiCurrentCard.useQuery(undefined, {
    retry: 2,
    staleTime: 0,
    gcTime: 0,
  });
  const cardIdFromReview = currentCard?.cardId;

  // 2. cardId から cardsInfo を取得
  const { data: cardsInfoData, isLoading: isLoadingCardsInfo, error: cardsInfoError } = trpc.anki.card.cardsInfo.useQuery(
    { cards: [cardIdFromReview!] },
    { enabled: !!cardIdFromReview, }
  );
  const noteIdFromReview = cardsInfoData?.[0]?.note;

  // 3. noteId から notesInfo を取得
  const { data: notesInfoData, isLoading: isLoadingNotesInfo, error: notesInfoError } = trpc.anki.note.notesInfo.useQuery(
    { notes: [noteIdFromReview!] },
    { enabled: !!noteIdFromReview }
  );

  // 4. カード解答ミューテーション
  const { mutateAsync: guiAnswerCard, isPending: isAnswering, isSuccess: answerSuccess, error: answerError } = trpc.anki.graphical.guiAnswerCard.useMutation({
    onSuccess: async () => {
      console.log('解答が登録されました');
      // 次のカードを表示するために現在のカード情報を再取得
      await refetchCurrentCard();
      setShowAnswer(false); // 解答を隠す
      // ReviewPanel の状態リセットは handleSaveReview で行う
    },
    onError: (err) => {
      console.error('解答の登録に失敗しました:', err);
      // UIでエラー表示
    }
  });

  // 5. 解答表示ミューテーション
  const { mutateAsync: guiShowAnswer, isPending: isShowingAnswer, error: showAnswerError } = trpc.anki.graphical.guiShowAnswer.useMutation({
    onError: (err) => {
      console.error('解答の表示に失敗しました:', err);
      // UIでエラー表示など検討
    }
  });


  // --- データ結合ロジック ---
  useEffect(() => {
    // データ取得中は古いデータをクリア
    if (isLoadingCurrentCard || isLoadingCardsInfo || isLoadingNotesInfo) {
      setProblemData(null);
      return;
    }

    let data: ProblemData | null = null;
    const cardInfo = cardsInfoData?.[0];
    const noteInfo = notesInfoData?.[0];

    // データ取得完了後にデータを設定
    if (currentCard && cardInfo && noteInfo) {
      data = {
        cardId: currentCard.cardId,
        noteId: cardInfo.note,
        question: currentCard.question,
        answer: currentCard.answer,
        deckName: cardInfo.deckName,
        fields: cardInfo.fields,
        tags: noteInfo.tags,
        nextReviews: currentCard.nextReviews,
        buttons: currentCard.buttons,
      };
    }
    setProblemData(data);
  }, [currentCard, cardsInfoData, notesInfoData, isLoadingCurrentCard, isLoadingCardsInfo, isLoadingNotesInfo]);

  // URLクエリからデッキ名を取得して state にセット
  useEffect(() => {
    const deck = searchParams.get('deck');
    if (deck) {
      setCurrentDeckName(decodeURIComponent(deck));
    } else {
      // クエリパラメータがない場合はデッキ名を null に設定
      setCurrentDeckName(null);
    }
  }, [searchParams]);

  // --- ハンドラー関数 ---

  const handleRefresh = useCallback(() => {
    refetchCurrentCard();
    setShowAnswer(false);
  }, [refetchCurrentCard, utils, cardIdFromReview, noteIdFromReview]);

  const handleNavigateBack = useCallback(() => {
    navigate(-1); // 前のページに戻る
  }, [navigate]);

  const handleToggleAnswer = useCallback(() => {
    setShowAnswer(prev => !prev);
  }, []);

  // ProblemDisplay から呼ばれる解答処理
  const handleAnswerCard = useCallback(async (ease: 1 | 2 | 3 | 4) => {
    if (!problemData) return;
    try {
      await guiShowAnswer(); // ★ 解答を表示
      await guiAnswerCard({ ease });
    } catch (error) {
      console.error("Error during answering card:", error);
      // TODO: UIでのエラー表示を検討
    }
  }, [problemData, guiShowAnswer, guiAnswerCard]);

  // ReviewPanel から呼ばれる保存処理
  const handleSaveReview = useCallback(async (saveData: ReviewPanelSaveData) => {
    if (!problemData) {
      console.error('Attempted to save without problem data.');
      return;
    }

    const { memo, images, solvingTime, reviewTime, selectedEase } = saveData;
    const hasContentToSave = images.length > 0 || memo.trim() !== '' || solvingTime !== '' || reviewTime !== '';

    // 1. 解答内容の保存 (画像アップロード + ノート更新)
    if (hasContentToSave) {
      let imageFilenames = '';
      if (images.length > 0) {
        try {
          const uploadPromises = images.map(image => uploadImage(image, undefined, true));
          const uploadResults = await Promise.all(uploadPromises);
          const successfulUploads = uploadResults.filter(result => result.success);
          if (successfulUploads.length !== images.length) {
            throw new Error('一部の画像のアップロードに失敗しました。');
          }
          imageFilenames = successfulUploads.map(result => result.filename).join(',');
        } catch (uploadError: any) {
          console.error("Error during image upload:", uploadError);
          throw new Error(`画像アップロードエラー: ${uploadError.message}`);
        }
      }

      let timeInfo = '';
      if (solvingTime) timeInfo += `【解答時間: ${solvingTime}】`;
      if (reviewTime) {
        if (timeInfo) timeInfo += ' ';
        timeInfo += `【復習時間: ${reviewTime}】`;
      }
      let memoWithTime = memo;
      if (timeInfo) memoWithTime = `${timeInfo}\n${memo}`;

      await addAnswerToNote({
        cardId: problemData.cardId,
        imageFilename: imageFilenames,
        memo: memoWithTime,
        fieldName: '過去解答'
      });
    }

    // 2. 難易度の登録
    if (selectedEase !== null) {
      try {
        await guiShowAnswer(); // ★ 解答を表示
        await guiAnswerCard({ ease: selectedEase });
        // guiAnswerCard の onSuccess で次のカードが読み込まれる
      } catch (error) {
         console.error("Error during saving review and answering card:", error);
         // TODO: UIでのエラー表示を検討
         // エラーが発生しても、ノート更新などは完了している可能性があるため、
         // ユーザーへのフィードバック方法を検討する必要がある
      }
    } else if (hasContentToSave) {
      // 解答内容のみ保存した場合、現在のカード情報を再取得して表示を更新
      await refetchCurrentCard();
      setShowAnswer(false); // 解答を隠す
    }

  }, [problemData, uploadImage, addAnswerToNote, guiShowAnswer, guiAnswerCard, refetchCurrentCard]); // guiShowAnswer を依存配列に追加


  // --- ローディングとエラー状態の集約 ---
  const isLoading = isLoadingCurrentCard || isLoadingCardsInfo || isLoadingNotesInfo || isShowingAnswer; // isShowingAnswer を追加
  const queryError = currentCardError || cardsInfoError || notesInfoError || showAnswerError; // showAnswerError を追加
  const panelError = saveError || answerError || showAnswerError; // showAnswerError を追加

  return (
    <div className="container mx-auto p-4 relative">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">レビュー</h1>
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
            disabled={isLoading || isSavingAnswer || isAnswering || isShowingAnswer} // isShowingAnswer を追加
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading || isShowingAnswer ? 'animate-spin' : ''}`} />
            {isLoading || isShowingAnswer ? '読込中' : '更新'}
          </button>
        </div>
      </div>

      {/* デッキ名表示 */}
      {currentDeckName && (
        <div className="mb-4 text-lg text-gray-600 flex items-center">
          <BookOpen className="w-5 h-5 mr-2 text-primary" />
          <span>{currentDeckName}</span>
        </div>
      )}

      {/* グローバルエラー表示 */}
      {queryError && !isLoading && ( // ローディング中でない場合のみエラー表示
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 mt-0.5" />
          <div>
            <p className="font-semibold">エラーが発生しました</p>
            <p>{queryError.message}</p>
            {/* 必要に応じてリトライボタンなどを追加 */}
          </div>
        </div>
      )}

      {/* メインコンテンツエリア */}
      <div className="flex">
        {/* 問題表示エリア (problemData がある場合のみ表示) */}
        {problemData && (
          <div className="flex-grow">
            <ProblemDisplay
              key={problemData.cardId} // cardId を key に設定してカード変更時にコンポーネントを再生成
              problemData={problemData}
              isLoading={isLoading}
            showAnswer={showAnswer}
            onToggleAnswer={handleToggleAnswer}
            onAnswer={handleAnswerCard} // ProblemDisplay内のボタンから呼ぶ
            isAnswering={isAnswering}
              isReviewMode={true} // レビューボタンを表示
            />
          </div>
        )}

        {/* レビューパネル (常に表示、位置調整はCSSで行う想定) */}
        <ReviewPanel
          cardId={problemData?.cardId}
          onSave={handleSaveReview}
          isSaving={isSavingAnswer || isMediaLoading || isAnswering || isShowingAnswer} // isShowingAnswer を追加
          saveSuccess={saveSuccess || answerSuccess} // ノート更新成功 または 解答成功
          // panelError が存在する場合、新しい Error オブジェクトを作成して渡す
          saveError={panelError ? new Error(panelError.message) : null} // panelError に showAnswerError が含まれるようになった
        />
      </div>

       {/* データがない、またはデッキが指定されていない場合の表示 (ローディング完了後) */}
       {!isLoading && (!problemData || !currentDeckName) && !queryError && (
         <div className="text-center text-gray-500 py-10">
           { !currentDeckName ? "レビュー対象のデッキが指定されていません。" : "レビューするカードがありません。" }
         </div>
      )}
    </div>
  );
};

export default ReviewPage;
