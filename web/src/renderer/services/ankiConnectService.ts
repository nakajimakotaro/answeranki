import {
  AnkiConnectResponse,
  FindNotesResponse,
  NotesInfoResponse,
  StoreMediaFileParams,
  UpdateNoteFieldsParams,
  DeckNamesResponse,
  NoteInfo, // Keep only one NoteInfo import
  GuiCurrentCardResponse
} from '../types/ankiConnect'; // Keep necessary types
import { rawTrpcClient } from '../lib/trpc'; // Import the raw tRPC client instance
import type { TRPCClient } from '@trpc/client'; // Keep TRPCClient type for constructor typing
import type { AppRouter } from '@server/router'; // Import AppRouter type

/**
 * AnkiConnectサービス (tRPC版)
 * AnkiConnectとの通信をtRPC経由で行うサービス
 */
class AnkiConnectService {
  private trpcClient: TRPCClient<AppRouter>;

  constructor(client: TRPCClient<AppRouter>) {
    this.trpcClient = client;
  }

  /**
   * AnkiConnectとの接続をテストする
   * @returns 接続が成功したかどうか、バージョン情報、エラーメッセージ
   */
  async testConnection(): Promise<{ connected: boolean; version: number | null; error: string | null }> {
    try {
      // Use the injected trpcClient instance
      const result = await this.trpcClient.anki.testConnection.query();
      return result;
    } catch (error) {
      console.error('Connection test failed via tRPC client:', error);
      // Return a consistent error format matching the query's expected return type
      return {
        connected: false,
        version: null,
        error: error instanceof Error ? error.message : 'Unknown connection error',
      };
    }
  }


  /**
   * 指定したクエリに一致するノートのIDリストを取得する
   * @param query 検索クエリ
   * @returns ノートIDのリスト
   */
  async findNotes(query: string): Promise<number[]> {
    try {
      const response = await this.trpcClient.anki.proxy.mutate({ // Use this.trpcClient
        action: 'findNotes',
        params: { query }
      }) as FindNotesResponse; // Cast to expected response type

      if (response.error) {
        throw new Error(`AnkiConnect error: ${response.error}`);
      }
      return response.result || [];
    } catch (error) {
       console.error('findNotes failed via tRPC client:', error);
       throw error; // Re-throw the error for the hook/caller to handle
    }
  }

  /**
   * 指定したノートIDのノート情報を取得する
   * @param noteIds ノートIDのリスト
   * @returns ノート情報のリスト
   */
  async getNotesInfo(noteIds: number[]): Promise<NoteInfo[]> {
    if (noteIds.length === 0) {
      return [];
    }
    try {
      const response = await this.trpcClient.anki.proxy.mutate({ // Use this.trpcClient
        action: 'notesInfo',
        params: { notes: noteIds }
      }) as NotesInfoResponse; // Cast to expected response type

      if (response.error) {
        throw new Error(`AnkiConnect error: ${response.error}`);
      }
      return response.result || [];
     } catch (error) {
       console.error('getNotesInfo failed via tRPC client:', error);
       throw error;
     }
  }

  /**
   * メディアファイルをAnkiのメディアフォルダに保存する
   * @param filename ファイル名
   * @param data Base64エンコードされたデータ
   * @returns 成功したかどうかを示すファイル名（成功時）、または null（失敗時）
   */
  async storeMediaFile(filename: string, data: string): Promise<string | null> {
     try {
        // Create a plain object matching the expected params structure for the proxy
        const paramsForProxy: Record<string, unknown> = { filename, data };
        const response = await this.trpcClient.anki.proxy.mutate({ // Use this.trpcClient
          action: 'storeMediaFile',
          params: paramsForProxy // Pass the plain object
        }) as AnkiConnectResponse; // Use base response type

        if (response.error) {
          console.error(`AnkiConnect storeMediaFile error: ${response.error}`);
          return null; // Indicate failure
        }
        // storeMediaFile returns the filename on success
        return response.result as string ?? null;
     } catch (error) {
       console.error('storeMediaFile failed via tRPC client:', error);
       return null; // Indicate failure on tRPC error
     }
  }

  /**
   * Ankiのメディアフォルダからファイルを取得する
   * @param filename ファイル名
   * @returns Base64エンコードされたデータ
   */
  async retrieveMediaFile(filename: string): Promise<string> {
    try {
      const response = await this.trpcClient.anki.proxy.mutate({ // Use this.trpcClient
        action: 'retrieveMediaFile',
        params: { filename }
      }) as AnkiConnectResponse; // Use base response type

      if (response.error) {
        throw new Error(`AnkiConnect error: ${response.error}`);
      }
      // retrieveMediaFile returns base64 data on success
      if (typeof response.result !== 'string') {
          throw new Error('Invalid response format from retrieveMediaFile');
      }
      return response.result;
    } catch (error) {
       console.error('retrieveMediaFile failed via tRPC client:', error);
       throw error;
    }
  }

  /**
   * ノートのフィールドを更新する
   * @param noteId ノートID
   * @param fields フィールドの内容
   * @returns 成功したかどうか
   */
  async updateNoteFields(noteId: number, fields: Record<string, string>): Promise<boolean> {
    try {
      // Create a plain object matching the expected params structure for the proxy
      const paramsForProxy: Record<string, unknown> = {
        note: { id: noteId, fields }
      };
      const response = await this.trpcClient.anki.proxy.mutate({ // Use this.trpcClient
        action: 'updateNoteFields',
        params: paramsForProxy // Pass the plain object
      }) as AnkiConnectResponse; // Use base response type

      // updateNoteFields returns null on success
      if (response.error) {
         console.error(`AnkiConnect updateNoteFields error: ${response.error}`);
         return false;
      }
      return response.result === null; // Check for null which indicates success
    } catch (error) {
       console.error('updateNoteFields failed via tRPC client:', error);
       return false; // Indicate failure on tRPC error
    }
  }

  /**
   * デッキ名のリストを取得する
   * @returns デッキ名のリスト
   */
  async getDeckNames(): Promise<string[]> {
    try {
      const response = await this.trpcClient.anki.proxy.mutate({ // Use this.trpcClient
        action: 'deckNames',
        params: {} // No params needed for deckNames
      }) as DeckNamesResponse; // Cast to expected response type

      if (response.error) {
        throw new Error(`AnkiConnect error: ${response.error}`);
      }
      return response.result || [];
    } catch (error) {
       console.error('getDeckNames failed via tRPC client:', error);
       throw error;
    }
  }

  /**
   * 指定したノートIDのノートが属するデッキ名を取得する
   * @param noteId ノートID
   * @returns デッキ名
   */
  async getDeckNameByNoteId(noteId: number): Promise<string | null> {
     try {
        // cardsInfo action requires an array of card IDs.
        // Assuming noteId corresponds to a cardId for this purpose.
        const response = await this.trpcClient.anki.proxy.mutate({ // Use this.trpcClient
          action: 'cardsInfo',
          params: { cards: [noteId] } // Pass noteId as cardId in an array
        }) as AnkiConnectResponse; // Use base response type

        if (response.error) {
          console.error(`AnkiConnect cardsInfo error: ${response.error}`);
          return null;
        }

        const cardsInfo = response.result as any[]; // Adjust type if a stricter one exists
        if (cardsInfo && cardsInfo.length > 0 && cardsInfo[0].deckName) {
          return cardsInfo[0].deckName;
        }
        return null; // No deck name found or error in response structure
     } catch (error) {
       console.error('getDeckNameByNoteId failed via tRPC client:', error);
       return null; // Indicate failure
     }
  }

  /**
   * 指定したノートにタグを追加する
   * @param noteIds ノートIDのリスト
   * @param tag 追加するタグ
   * @returns 成功したかどうか
   */
  async addTag(noteIds: number[], tag: string): Promise<boolean> {
    try {
      const response = await this.trpcClient.anki.proxy.mutate({ // Use this.trpcClient
        action: 'addTags',
        params: { notes: noteIds, tags: tag }
      }) as AnkiConnectResponse;

      if (response.error) {
         console.error(`AnkiConnect addTags error: ${response.error}`);
         return false;
      }
      return response.result === null; // Success is indicated by null result
    } catch (error) {
       console.error('addTag failed via tRPC client:', error);
       return false;
    }
  }

  /**
   * 指定したノートからタグを削除する
   * @param noteIds ノートIDのリスト
   * @param tag 削除するタグ
   * @returns 成功したかどうか
   */
  async removeTag(noteIds: number[], tag: string): Promise<boolean> {
     try {
        const response = await this.trpcClient.anki.proxy.mutate({ // Use this.trpcClient
          action: 'removeTags',
          params: { notes: noteIds, tags: tag }
        }) as AnkiConnectResponse;

        if (response.error) {
           console.error(`AnkiConnect removeTags error: ${response.error}`);
           return false;
        }
        return response.result === null; // Success is indicated by null result
     } catch (error) {
       console.error('removeTag failed via tRPC client:', error);
       return false;
     }
  }

  /**
   * 現在Ankiのメインウィンドウに表示されているカードの情報を取得する
   * @returns カード情報（カードID、フィールド、質問、回答など）
   */
  async getCurrentCard(): Promise<GuiCurrentCardResponse['result'] | null> {
     try {
        const response = await this.trpcClient.anki.proxy.mutate({ // Use this.trpcClient
          action: 'guiCurrentCard',
          params: {}
        }) as GuiCurrentCardResponse; // Use specific response type

        if (response.error) {
          console.error(`AnkiConnect guiCurrentCard error: ${response.error}`);
          return null;
        }

        // Adjust response if needed (e.g., mapping cardId to noteId if missing)
        if (response.result && response.result.cardId && !response.result.noteId) {
          response.result.noteId = response.result.cardId;
        }

        return response.result || null;
     } catch (error) {
       console.error('getCurrentCard failed via tRPC client:', error);
       return null;
     }
  }

  /**
   * 指定したカードIDのカード情報を取得する
   * @param cardIds カードIDのリスト
   * @returns カード情報のリスト
   */
  async getCardsInfo(cardIds: number[]): Promise<any[]> { // Consider defining a stricter type for card info
     try {
        const response = await this.trpcClient.anki.proxy.mutate({ // Use this.trpcClient
          action: 'cardsInfo',
          params: { cards: cardIds }
        }) as AnkiConnectResponse; // Use base or a specific CardsInfoResponse type

        if (response.error) {
          console.error(`AnkiConnect cardsInfo error: ${response.error}`);
          return []; // Return empty array on error
        }
        return (response.result as any[]) || []; // Adjust type cast as needed
     } catch (error) {
       console.error('getCardsInfo failed via tRPC client:', error);
       return []; // Return empty array on tRPC error
     }
  }

  /**
   * カードに解答する
   * @param cardId カードID
   * @param ease 難易度（1: もう一度, 2: 難しい, 3: 普通, 4: 簡単）
   * @returns 成功したかどうか
   */
  async answerCard(cardId: number, ease: 1 | 2 | 3 | 4): Promise<boolean> {
    try {
      const response = await this.trpcClient.anki.proxy.mutate({
        action: 'answerCards',
        params: { 
          answers: [
            { cardId, ease }
          ]
        }
      }) as AnkiConnectResponse;

      if (response.error) {
        console.error(`AnkiConnect answerCard error: ${response.error}`);
        return false;
      }
      
      // answerCard returns true on success
      return response.result === true;
    } catch (error) {
      console.error('answerCard failed via tRPC client:', error);
      return false;
    }
  }
}

// Create and export a singleton instance using the raw tRPC client
const ankiConnectService = new AnkiConnectService(rawTrpcClient);
export default ankiConnectService;
