import { useState, useCallback } from 'react';
import { format } from 'date-fns'; // Import format from date-fns
import ankiConnectService from '../services/ankiConnectService';
import { NoteInfo } from '../types/ankiConnect';

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
      
      // 現在の日時をフォーマット (date-fns を使用)
      const now = new Date();
      const dateTimeStr = format(now, 'yyyy/MM/dd HH:mm:ss'); // Combine date and time

      let imageTags = '';
      // 画像ファイル名が存在する場合のみ画像タグを生成
      if (imageFilename) {
        // 画像ファイル名がカンマ区切りの場合は複数の画像として処理
        const imageFilenames = imageFilename.split(',');
        // 画像タグを生成
        imageTags = imageFilenames.map(filename => `<img src="${filename}" class="mb-2">`).join('');
      }
      
      // 新しい解答を追加
      let newContent;
      
      // フィールド名が '過去解答' の場合は特別な処理
      if (fieldName === '過去解答') {
        // 過去解答フィールドが存在しない場合は新規作成
        if (!currentNote.fields[fieldName]) {
          newContent = `<div class="answer-entry"><p><strong>${dateTimeStr}</strong></p>${imageTags}<p>${memo}</p></div>`;
        } else {
          // 既存の過去解答フィールドに追加
          newContent = `${currentField}<hr><div class="answer-entry"><p><strong>${dateTimeStr}</strong></p>${imageTags}<p>${memo}</p></div>`;
        }
      } else {
        // 通常の裏面フィールドに追加
        newContent = `${currentField}<hr><div class="answer-entry"><p><strong>${dateTimeStr}</strong></p>${imageTags}<p>${memo}</p></div>`;
      }
      
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
        const noteInfo = await ankiConnectService.getNotesInfo([currentCard.noteId]);
        
        if (noteInfo.length > 0) {
          // 現在のノートリストを更新
          setNotes([noteInfo[0]]);
          
          return {
            ...currentCard,
            noteInfo: noteInfo[0]
          };
        }
      }
      
      return currentCard;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * カードに解答する
   * @param cardId カードID
   * @param ease 難易度（1: もう一度, 2: 難しい, 3: 普通, 4: 簡単）
   */
  const answerCard = useCallback(async (cardId: number, ease: 1 | 2 | 3 | 4) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const success = await ankiConnectService.answerCard(cardId, ease);
      return success;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error during card answer');
      setError(error);
      throw error;
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
    fetchCurrentCard,
    answerCard
  };
}
