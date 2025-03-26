// AnkiConnectのリクエスト・レスポンスの型定義

// 基本リクエスト型
export interface AnkiConnectRequest {
  action: string;
  version: number;
  params: Record<string, any>;
}

// 基本レスポンス型
export interface AnkiConnectResponse {
  result?: any;
  error?: string;
}

// ノート情報の型
export interface NoteInfo {
  noteId: number;
  modelName: string;
  tags: string[];
  fields: Record<string, {
    value: string;
    order: number;
  }>;
}

// findNotesのレスポンス型
export interface FindNotesResponse extends AnkiConnectResponse {
  result?: number[];
}

// notesInfoのレスポンス型
export interface NotesInfoResponse extends AnkiConnectResponse {
  result?: NoteInfo[];
}

// storeMediaFileのパラメータ型
export interface StoreMediaFileParams {
  filename: string;
  data: string; // Base64エンコードされた画像データ
}

// updateNoteFieldsのパラメータ型
export interface UpdateNoteFieldsParams {
  note: {
    id: number;
    fields: Record<string, string>;
  };
}

// deckNamesのレスポンス型
export interface DeckNamesResponse extends AnkiConnectResponse {
  result?: string[];
}

// guiCurrentCardのレスポンス型
export interface GuiCurrentCardResponse extends AnkiConnectResponse {
  result?: {
    cardId: number;
    noteId: number;
    deckName: string;
    question: string;
    answer: string;
  };
}

// AnkiConnectの設定型
export interface AnkiConnectConfig {
  url: string;
  version: number;
}
