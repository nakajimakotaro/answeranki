import { useCallback } from 'react';
import { format } from 'date-fns';
import { trpc } from '../lib/trpc';
import { TRPCClientError } from '@trpc/client';

interface AddAnswerToNoteVariables {
  cardId: number;
  imageFilename: string;
  memo: string;
  fieldName?: string;
}

/**
 * 解答画像とメモをノートに追加するための tRPC mutation フック
 */
export function useAddAnswerToNote() {
  const utils = trpc.useUtils();

  // グローバルな onError ハンドラは維持しても良い
  const mutation = trpc.anki.note.updateNoteFields.useMutation({
    onError: (error) => {
      console.error("Error adding answer to note (global handler):", error);
      // ここでエラーに応じたUIフィードバックを行うことも可能
    }, // <--- Add comma here
  });

  // mutateAsync の代わりに mutate を使用し、Promise を返すようにラップする
  const addAnswerToNote = useCallback(async ({
    cardId, // cardId を useCallback スコープで保持
    imageFilename,
    memo,
    fieldName = '過去解答'
  }: AddAnswerToNoteVariables) => {

    // 1. cardId から noteId と現在のフィールド値を取得 (変更なし)
    let noteId: number;
    let currentField = '';
    try {
      const cardInfoResult = await utils.anki.card.cardsInfo.fetch({ cards: [cardId] });
      if (!cardInfoResult || cardInfoResult.length === 0) {
        throw new Error(`Card info not found for cardId: ${cardId}`);
      }
      const cardInfo = cardInfoResult[0];
      noteId = cardInfo.note; // noteId ではなく note プロパティを使用
      currentField = cardInfo.fields[fieldName]?.value || '';
    } catch (error) {
      console.error("Error fetching card info:", error);
      if (error instanceof TRPCClientError) {
         throw new Error(`Failed to fetch card info: ${error.message}`);
      }
      throw new Error('Failed to fetch card info.');
    }

    // 2. 新しいフィールド内容を構築 (変更なし)
    const now = new Date();
    const dateTimeStr = format(now, 'yyyy/MM/dd HH:mm:ss');
    let imageTags = '';
    if (imageFilename) {
      const imageFilenames = imageFilename.split(',');
      imageTags = imageFilenames.map(filename => `<img src="${filename}" class="mb-2">`).join('');
    }
    const newEntryHtml = `<div class="answer-entry"><p><strong>${dateTimeStr}</strong></p>${imageTags ? `${imageTags}<br>` : ''}<p>${memo.replace(/\n/g, '<br>')}</p></div>`;
    const newContent = currentField ? `${currentField}<hr>${newEntryHtml}` : newEntryHtml;

    return new Promise<void>((resolve, reject) => {
      mutation.mutate({
        note: {
          id: noteId,
          fields: {
            [fieldName]: newContent
          }
        }
      }, {
        onSuccess: () => {
          // このスコープでは cardId が利用可能
          utils.anki.card.cardsInfo.invalidate({ cards: [cardId] });
          // 必要なら notesInfo も無効化
          // utils.anki.note.notesInfo.invalidate({ notes: [noteId] });
          resolve(); // Promise を解決
        },
        onError: (error) => {
          console.error("Error during mutation:", error);
          reject(error); // Promise を拒否
        }
      });
    });

  }, [utils, mutation]); // mutation を依存配列に追加

  return {
    addAnswerToNote, // ラップした Promise を返す関数
    isLoading: mutation.isPending, // isPending を使用 (v11)
    isSuccess: mutation.isSuccess,
    error: mutation.error,
  };
}
