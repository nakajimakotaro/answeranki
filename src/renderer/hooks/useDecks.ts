import { useState, useCallback } from 'react';
import { ankiConnectService } from '../services/ankiConnectService';

/**
 * デッキ関連の機能を提供するフック
 */
export function useDecks() {
  const [decks, setDecks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * デッキリストを取得する
   */
  const fetchDecks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const deckNames = await ankiConnectService.getDeckNames();
      setDecks(deckNames);
      return deckNames;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('デッキリストの取得に失敗しました'));
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 指定したノートIDのノートが属するデッキ名を取得する
   * @param noteId ノートID
   */
  const getDeckNameByNoteId = useCallback(async (noteId: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const deckName = await ankiConnectService.getDeckNameByNoteId(noteId);
      return deckName;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('デッキ名の取得に失敗しました'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    decks,
    isLoading,
    error,
    fetchDecks,
    getDeckNameByNoteId
  };
}
