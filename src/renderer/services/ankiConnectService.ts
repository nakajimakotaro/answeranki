import {
  AnkiConnectRequest,
  AnkiConnectResponse,
  AnkiConnectConfig,
  FindNotesResponse,
  NotesInfoResponse,
  StoreMediaFileParams,
  UpdateNoteFieldsParams,
  DeckNamesResponse,
  NoteInfo,
  GuiCurrentCardResponse
} from '../types/ankiConnect';

/**
 * AnkiConnectサービス
 * AnkiConnectとの通信を抽象化するサービス
 */
class AnkiConnectService {
  private config: AnkiConnectConfig = {
    url: 'http://localhost:8765',
    version: 6
  };

  /**
   * コンストラクタ
   * @param config AnkiConnectの設定（オプション）
   */
  constructor(config?: Partial<AnkiConnectConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * AnkiConnectへのリクエストを送信する
   * @param action アクション名
   * @param params パラメータ
   * @returns レスポンス
   */
  private async sendRequest<T extends AnkiConnectResponse>(
    action: string,
    params: Record<string, any> = {}
  ): Promise<T> {
    const request: AnkiConnectRequest = {
      action,
      version: this.config.version,
      params
    };

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as T;

      if (data.error) {
        throw new Error(`AnkiConnect error: ${data.error}`);
      }

      return data;
    } catch (error) {
      console.error('AnkiConnect request failed:', error);
      throw error;
    }
  }

  /**
   * AnkiConnectとの接続をテストする
   * @returns 接続が成功したかどうか
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.sendRequest<AnkiConnectResponse>('version');
      return response.result === this.config.version;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }


  /**
   * 指定したクエリに一致するノートのIDリストを取得する
   * @param query 検索クエリ
   * @returns ノートIDのリスト
   */
  async findNotes(query: string): Promise<number[]> {
    const response = await this.sendRequest<FindNotesResponse>('findNotes', {
      query
    });
    return response.result || [];
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

    const response = await this.sendRequest<NotesInfoResponse>('notesInfo', {
      notes: noteIds
    });
    return response.result || [];
  }

  /**
   * メディアファイルをAnkiのメディアフォルダに保存する
   * @param filename ファイル名
   * @param data Base64エンコードされたデータ
   * @returns 成功したかどうか
   */
  async storeMediaFile(filename: string, data: string): Promise<boolean> {
    const params: StoreMediaFileParams = {
      filename,
      data
    };

    const response = await this.sendRequest<AnkiConnectResponse>('storeMediaFile', params);
    return response.error === null;
  }

  /**
   * Ankiのメディアフォルダからファイルを取得する
   * @param filename ファイル名
   * @returns Base64エンコードされたデータ
   */
  async retrieveMediaFile(filename: string): Promise<string> {
    const response = await this.sendRequest<AnkiConnectResponse>('retrieveMediaFile', {
      filename
    });
    return response.result as string;
  }

  /**
   * ノートのフィールドを更新する
   * @param noteId ノートID
   * @param fields フィールドの内容
   * @returns 成功したかどうか
   */
  async updateNoteFields(noteId: number, fields: Record<string, string>): Promise<boolean> {
    const params: UpdateNoteFieldsParams = {
      note: {
        id: noteId,
        fields
      }
    };

    const response = await this.sendRequest<AnkiConnectResponse>('updateNoteFields', params);
    return response.result === null || response.result === true;
  }

  /**
   * デッキ名のリストを取得する
   * @returns デッキ名のリスト
   */
  async getDeckNames(): Promise<string[]> {
    const response = await this.sendRequest<DeckNamesResponse>('deckNames');
    return response.result || [];
  }

  /**
   * 指定したノートIDのノートが属するデッキ名を取得する
   * @param noteId ノートID
   * @returns デッキ名
   */
  async getDeckNameByNoteId(noteId: number): Promise<string | null> {
    try {
      const response = await this.sendRequest<AnkiConnectResponse>('cardsInfo', {
        cards: [noteId]
      });
      
      const cardsInfo = response.result as any[];
      if (cardsInfo && cardsInfo.length > 0) {
        return cardsInfo[0].deckName;
      }
      return null;
    } catch (error) {
      console.error('Failed to get deck name:', error);
      return null;
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
      const response = await this.sendRequest<AnkiConnectResponse>('addTags', {
        notes: noteIds,
        tags: tag
      });
      return response.result === null || response.result === true;
    } catch (error) {
      console.error('Failed to add tag:', error);
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
      const response = await this.sendRequest<AnkiConnectResponse>('removeTags', {
        notes: noteIds,
        tags: tag
      });
      return response.result === null || response.result === true;
    } catch (error) {
      console.error('Failed to remove tag:', error);
      return false;
    }
  }

  /**
   * 現在Ankiのメインウィンドウに表示されているカードの情報を取得する
   * @returns カード情報（カードID、フィールド、質問、回答など）
   */
  async getCurrentCard(): Promise<any | null> {
    try {
      const response = await this.sendRequest<AnkiConnectResponse>('guiCurrentCard');
      
      // レスポンスにnoteIdがない場合は、cardIdをnoteIdとして使用
      if (response.result && response.result.cardId && !response.result.noteId) {
        response.result.noteId = response.result.cardId;
      }
      
      return response.result || null;
    } catch (error) {
      console.error('Failed to get current card:', error);
      return null;
    }
  }

  /**
   * 指定したカードIDのカード情報を取得する
   * @param cardIds カードIDのリスト
   * @returns カード情報のリスト
   */
  async getCardsInfo(cardIds: number[]): Promise<any[]> {
    try {
      const response = await this.sendRequest<AnkiConnectResponse>('cardsInfo', {
        cards: cardIds
      });
      
      return response.result || [];
    } catch (error) {
      console.error('Failed to get cards info:', error);
      return [];
    }
  }
}

// シングルトンインスタンスをエクスポート
export const ankiConnectService = new AnkiConnectService();

// クラスもエクスポートして、必要に応じてカスタム設定でインスタンス化できるようにする
export default AnkiConnectService;
