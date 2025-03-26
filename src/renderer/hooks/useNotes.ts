import { useState, useCallback } from 'react';
import { ankiConnectService } from '../services/ankiConnectService';
import { NoteInfo } from '../types/ankiConnect';

// 現在表示中のカード情報の型
interface CurrentCard {
  cardId: number;
  noteId: number;
  deckName: string;
  question: string;
  answer: string;
}

/**
 * ノート関連の機能を提供するフック
 */
export function useNotes() {
  const [notes, setNotes] = useState<NoteInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * 指定したクエリに一致するノートを取得する
   * @param query 検索クエリ
   */
  const fetchNotesByQuery = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // クエリでノートIDを検索
      const noteIds = await ankiConnectService.findNotes(query);
      
      if (noteIds.length === 0) {
        setNotes([]);
        return [];
      }
      
      // ノート詳細情報を取得
      const notesInfo = await ankiConnectService.getNotesInfo(noteIds);
      setNotes(notesInfo);
      return notesInfo;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('ノートの取得に失敗しました'));
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 指定したノートIDのノート情報を取得する
   * @param noteId ノートID
   */
  const fetchNoteById = useCallback(async (noteId: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // ノート詳細情報を取得
      const notesInfo = await ankiConnectService.getNotesInfo([noteId]);
      
      if (notesInfo.length === 0) {
        return null;
      }
      
      return notesInfo[0];
    } catch (err) {
      setError(err instanceof Error ? err : new Error('ノートの取得に失敗しました'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * ノートのフィールドを更新する
   * @param noteId ノートID
   * @param fields フィールドの内容
   */
  const updateNoteFields = useCallback(async (noteId: number, fields: Record<string, string>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const success = await ankiConnectService.updateNoteFields(noteId, fields);
      
      if (success) {
        // 更新後のノート情報を取得して状態を更新
        const updatedNote = await ankiConnectService.getNotesInfo([noteId]);
        
        if (updatedNote.length > 0) {
          setNotes(prevNotes => {
            const index = prevNotes.findIndex(note => note.noteId === noteId);
            
            if (index !== -1) {
              const newNotes = [...prevNotes];
              newNotes[index] = updatedNote[0];
              return newNotes;
            }
            
            return prevNotes;
          });
        }
      }
      
      return success;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('ノートの更新に失敗しました'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 解答画像とメモをノートに追加する
   * @param noteId ノートID
   * @param imageFilename 画像ファイル名（単一または複数のカンマ区切り）
   * @param memo メモ
   * @param fieldName 更新するフィールド名（デフォルト: '裏面'）
   */
  const addAnswerToNote = useCallback(async (
    noteId: number,
    imageFilename: string,
    memo: string,
    fieldName: string = '裏面'
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 現在のノート情報を取得
      const noteInfo = await ankiConnectService.getNotesInfo([noteId]);
      
      if (noteInfo.length === 0) {
        throw new Error('ノートが見つかりませんでした');
      }
      
      const currentNote = noteInfo[0];
      const currentField = currentNote.fields[fieldName]?.value || '';
      
      // 現在の日時
      const now = new Date();
      const dateStr = now.toLocaleDateString('ja-JP');
      const timeStr = now.toLocaleTimeString('ja-JP');
      
      // 画像ファイル名がカンマ区切りの場合は複数の画像として処理
      const imageFilenames = imageFilename.split(',');
      
      // 画像タグを生成
      const imageTags = imageFilenames.map(filename => `<img src="${filename}" class="mb-2">`).join('');
      
      // 新しい解答を追加
      const newContent = `${currentField}<hr><div class="answer-entry"><p><strong>${dateStr} ${timeStr}</strong></p>${imageTags}<p>${memo}</p></div>`;
      
      // フィールドを更新
      const fields: Record<string, string> = {
        [fieldName]: newContent
      };
      
      const success = await ankiConnectService.updateNoteFields(noteId, fields);
      
      if (success) {
        // 更新後のノート情報を取得して状態を更新
        const updatedNote = await ankiConnectService.getNotesInfo([noteId]);
        
        if (updatedNote.length > 0) {
          setNotes(prevNotes => {
            const index = prevNotes.findIndex(note => note.noteId === noteId);
            
            if (index !== -1) {
              const newNotes = [...prevNotes];
              newNotes[index] = updatedNote[0];
              return newNotes;
            }
            
            return prevNotes;
          });
        }
      }
      
      return success;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('解答の追加に失敗しました'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 現在Ankiのメインウィンドウに表示されているカードの情報を取得する
   */
  const fetchCurrentCard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 現在表示中のカード情報を取得
      const currentCard = await ankiConnectService.getCurrentCard();
      
      if (!currentCard) {
        return null;
      }
      
      // noteIdが存在する場合のみノート情報を取得
      if (currentCard.noteId) {
        try {
          const noteInfo = await ankiConnectService.getNotesInfo([currentCard.noteId]);
          
          if (noteInfo.length > 0) {
            // 現在のノートリストを更新
            setNotes([noteInfo[0]]);
            
            return {
              ...currentCard,
              noteInfo: noteInfo[0]
            };
          }
        } catch (noteErr) {
          console.error('Failed to get note info:', noteErr);
        }
      }
      
      // ノート情報が取得できなかった場合は、カード情報のみを返す
      return currentCard;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('現在のカード情報の取得に失敗しました'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    notes,
    isLoading,
    error,
    fetchNotesByQuery,
    fetchNoteById,
    updateNoteFields,
    addAnswerToNote,
    fetchCurrentCard
  };
}
