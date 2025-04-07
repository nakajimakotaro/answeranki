export interface AnkiConnectRequest {
  action: string;
  version: number;
  params: Record<string, any>;
}

export interface AnkiConnectResponse {
  result?: any;
  error?: string;
}

export interface NoteInfo {
  noteId: number;
  modelName: string;
  tags: string[];
  fields: Record<string, {
    value: string;
    order: number;
  }>;
}

export interface FindNotesResponse extends AnkiConnectResponse {
  result?: number[];
}

export interface NotesInfoResponse extends AnkiConnectResponse {
  result?: NoteInfo[];
}

export interface StoreMediaFileParams {
  filename: string;
  data: string;
}

export interface UpdateNoteFieldsParams {
  note: {
    id: number;
    fields: Record<string, string>;
  };
}

export interface DeckNamesResponse extends AnkiConnectResponse {
  result?: string[];
}

export interface GuiCurrentCardResponse extends AnkiConnectResponse {
  result?: {
    cardId: number;
    noteId: number;
    deckName: string;
    question: string;
    answer: string;
  };
}

export interface AnkiConnectConfig {
  url: string;
  version: number;
}
