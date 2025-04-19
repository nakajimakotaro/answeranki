import { z } from 'zod';
import { publicProcedure, router } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { YankiConnect } from 'yanki-connect';
import { nanoid } from 'nanoid';
import { toStringAnkiQuery } from '../utils.js';

const ankiConnect = new YankiConnect();

// Zod schema for Textbook
const TextbookSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required'),
  subject: z.string().min(1, 'Subject is required'),
  total_problems: z.number().int().min(0),
  anki_deck_name: z.string().nullable(),
  anki_note_id: z.number().int().optional(), // Ankiノート情報を追加
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

// Input schema for creation (omit auto-generated fields)
const CreateTextbookInputSchema = TextbookSchema.omit({
  id: true,
  anki_note_id: true, // 作成時にはAnkiノートIDはまだ存在しない
  created_at: true,
  updated_at: true,
});

// Input schema for update (require id, make others optional)
const UpdateTextbookInputSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  subject: z.string().min(1),
  total_problems: z.number().int().min(0).optional(),
  anki_deck_name: z.string().nullable().optional(),
});

export const textbookRouter = router({
  // Get all textbooks
  getTextbooks: publicProcedure
    .query(async () => {
      // Ankiから"Meta"デッキのノートを検索
      const noteIds = await ankiConnect.note.findNotes({
        query: 'deck:"Meta" tag:textbook'
      });
      
      // 各ノートの詳細情報を取得
      const notesInfo = await ankiConnect.note.notesInfo({
        notes: noteIds
      });
      
      // ノート情報から参考書データを抽出
      const textbooks = notesInfo.map(note => {
        // Infoフィールドから参考書データを取得し、zodで検証
        const textbookData = TextbookSchema.parse(JSON.parse(note.fields.Info.value));
        // Ankiノート情報を追加
        textbookData.anki_note_id = note.noteId;
        return textbookData;
      });
      
      // 科目とタイトルでソート
      textbooks.sort((a, b) => {
        if (a.subject !== b.subject) {
          return a.subject.localeCompare(b.subject);
        }
        return a.title.localeCompare(b.title);
      });
      
      return textbooks;
    }),

  // Create a new textbook
  createTextbook: publicProcedure
    .input(CreateTextbookInputSchema)
    .mutation(async ({ input }) => {
      // 参考書データを作成
      // anki_note_id は後で追加するため、型定義に含める
      const textbookData: z.infer<typeof TextbookSchema> = {
        id: nanoid(),
        title: input.title,
        subject: input.subject,
        total_problems: input.total_problems,
        anki_deck_name: input.anki_deck_name || null,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // 参考書データをJSON形式に変換
      const textbookJson = JSON.stringify(textbookData);
      
      // Ankiに保存
      const noteId = await ankiConnect.note.addNote({
        note: {
          deckName: "Meta",
          modelName: "MetaData",
          fields: {
            Info: textbookJson
          },
          tags: ["textbook", textbookData.subject]
        }
      });
      
      if (!noteId) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create textbook in Anki'
        });
      }
      
      // Ankiノート情報を追加
      textbookData.anki_note_id = noteId;
      
      return TextbookSchema.parse(textbookData);
    }),

  // Update an existing textbook
  updateTextbook: publicProcedure
    .input(UpdateTextbookInputSchema)
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;
      
      // Ankiからノート情報を取得
      const noteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:textbook ${toStringAnkiQuery(`"id":"${id}"`)}`
      });
      
      if (noteIds.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Textbook with ID ${id} not found in Anki`
        });
      }
      
      // 最初のノートを使用
      const noteId = noteIds[0];
      
      // 現在の参考書データを取得
      const noteInfo = await ankiConnect.note.notesInfo({
        notes: [noteId]
      });
      
      const currentTextbookData = JSON.parse(noteInfo[0].fields.Info.value);
      
      // 更新する参考書データを作成
      // anki_note_id は後で追加するため、型定義に含める
      const updatedTextbookData: z.infer<typeof TextbookSchema> = {
        ...currentTextbookData,
        ...updateData,
        ...(updateData.anki_deck_name !== undefined && { anki_deck_name: updateData.anki_deck_name || null }),
        updated_at: new Date()
      };
      
      // 参考書データをJSON形式に変換
      const textbookJson = JSON.stringify(updatedTextbookData);
      
      // Ankiのノートを更新
      await ankiConnect.note.updateNoteFields({
        note: {
          id: noteId,
          fields: {
            Info: textbookJson
          }
        }
      });
      
      // タグを更新（科目が変更された場合）
      if (updateData.subject) {
        const currentTags = noteInfo[0].tags.filter(tag => tag !== 'textbook' && tag !== currentTextbookData.subject);
        await ankiConnect.note.updateNoteTags({
          note: noteId,
          tags: [...currentTags, 'textbook', updateData.subject]
        });
      }
      
      // Ankiノート情報を追加
      updatedTextbookData.anki_note_id = noteId;
      
      return TextbookSchema.parse(updatedTextbookData);
    }),

  // Delete a textbook
  deleteTextbook: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const { id } = input;
      
      // Ankiからノート情報を取得
      const noteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:textbook ${toStringAnkiQuery(`"id":"${id}"`)}`
      });
      
      if (noteIds.length > 0) {
        // ノートを削除
        await ankiConnect.note.deleteNotes({
          notes: noteIds
        });
      }

      // Delete linked schedules
      const scheduleNoteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:schedule ${toStringAnkiQuery(`"textbook_id":"${id}"`)}`
      });
      if (scheduleNoteIds.length > 0) {
        await ankiConnect.note.deleteNotes({
          notes: scheduleNoteIds
        });
      }

      return { success: true, message: 'Textbook deleted successfully' };
    }),

  linkAnkiDeck: publicProcedure
    .input(z.object({
      textbookId: z.string(),
      deckName: z.string().min(1, 'Deck name is required'),
    }))
    .mutation(async ({ input }) => {
      const { textbookId, deckName } = input;
      
      // Ankiからノート情報を取得
      const noteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:textbook ${toStringAnkiQuery(`"id":"${textbookId}"`)}`
      });
      
      if (noteIds.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Textbook with ID ${textbookId} not found in Anki`
        });
      }
      
      // 最初のノートを使用
      const noteId = noteIds[0];
      
      // 現在の参考書データを取得
      const noteInfo = await ankiConnect.note.notesInfo({
        notes: [noteId]
      });
      
      const currentTextbookData = JSON.parse(noteInfo[0].fields.Info.value);
      
      // 更新する参考書データを作成
      const updatedTextbookData: z.infer<typeof TextbookSchema> = {
        ...currentTextbookData,
        anki_deck_name: deckName,
        updated_at: new Date()
      };
      
      // 参考書データをJSON形式に変換
      const textbookJson = JSON.stringify(updatedTextbookData);
      
      // Ankiのノートを更新
      await ankiConnect.note.updateNoteFields({
        note: {
          id: noteId,
          fields: {
            Info: textbookJson
          }
        }
      });
      
      // Ankiノート情報を追加
      updatedTextbookData.anki_note_id = noteId;
      
      return TextbookSchema.parse(updatedTextbookData);
    }),
});

export type TextbookRouter = typeof textbookRouter;
