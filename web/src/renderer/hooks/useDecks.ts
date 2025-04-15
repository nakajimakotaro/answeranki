import { useCallback } from 'react';
import { trpc } from '../lib/trpc';

/**
 * デッキ関連の機能を提供するフック
 */
export function useDecks() {
  // useQuery から refetch も取得する
  const { data: decks, isLoading, error, refetch } = trpc.anki.deck.deckNames.useQuery(undefined, {
    // 初期データや staleTime などを設定できます
    // initialData: [],
    // staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // useQuery が状態管理を行うため、useState と fetchDecks は不要になります

  /**
   * 指定したノートIDのノートが属するデッキ名を取得する
   * @deprecated この関数は ankiConnectService に依存しており、tRPC に移行する必要があります。
   * @param _noteId ノートID (現在は未使用)
   */
  const getDeckNameByNoteId = useCallback(async (_noteId: number) => {
    // setIsLoading(true); // isLoading は useQuery から取得
    // setError(null); // error は useQuery から取得

    try {
      // TODO: Replace with tRPC call if available, or adjust logic
      // For now, keeping the structure but noting the dependency is gone.
      // This part might need further refactoring depending on tRPC capabilities.
      console.warn('getDeckNameByNoteId is deprecated and needs replacement with a tRPC call.');
      // Simulating an error state as the required functionality is missing
      throw new Error('getDeckNameByNoteId functionality is not implemented with tRPC yet.');
    } catch (err) {
      // setError(err instanceof Error ? err : new Error('デッキ名の取得に失敗しました')); // error は useQuery で管理されるべきか、別途状態を持つか検討
      console.error('Error in getDeckNameByNoteId (deprecated):', err);
      return null; // またはエラーを再スロー
    } finally {
      // setIsLoading(false); // isLoading は useQuery から取得
    }
  }, []);

  return {
    // useQuery から取得した decks を返す (undefined の可能性あり)
    // 必要に応じてデフォルト値を提供: decks ?? []
    decks: decks ?? [],
    isLoading,
    error,
    refetch, // refetch を返すように追加
    // fetchDecks は削除
    getDeckNameByNoteId // この関数は現状動作しないため注意
  };
}
