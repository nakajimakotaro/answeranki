import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { YankiConnect } from 'yanki-connect';
import { nanoid } from 'nanoid';
import { toStringAnkiQuery } from '../utils.js';

const ankiConnect = new YankiConnect();

// Zod スキーマ定義
const universitySchema = z.object({
  id: z.string(),
  name: z.string().min(1, { message: 'University name is required' }),
  rank: z.number().nullable(),
  notes: z.string().nullable(),
  anki_note_id: z.number().int().optional(), // Ankiノート情報を追加
  created_at: z.date(),
  updated_at: z.date(),
});

// 入力スキーマ
const createUniversityInput = universitySchema.omit({ id: true, anki_note_id: true, created_at: true, updated_at: true }); // 作成時は自動生成フィールドを除外
const updateUniversityInput = z.object({ // 更新時はIDと更新したいフィールドを指定
  id: z.string(),
  name: z.string().min(1).optional(),
  rank: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});
const deleteUniversityInput = z.object({
  id: z.string(),
});

export const universityRouter = router({
  /**
   * 大学一覧を取得
   */
  getAll: publicProcedure
    .query(async () => {
      // Ankiから"Meta"デッキのノートを検索
      const noteIds = await ankiConnect.note.findNotes({
        query: 'deck:"Meta" tag:university'
      });
      
      // 各ノートの詳細情報を取得
      const notesInfo = await ankiConnect.note.notesInfo({
        notes: noteIds
      });
      
      // ノート情報から大学データを抽出
      const universities = notesInfo.map(note => {
        // Infoフィールドから大学データを取得
        const universityData: z.infer<typeof universitySchema> = JSON.parse(note.fields.Info.value);
        // Ankiノート情報を追加
        universityData.anki_note_id = note.noteId;
        return universityData;
      });
      
      // rankとnameでソート
      universities.sort((a, b) => {
        // rankがnullの場合は最後に
        if (a.rank === null && b.rank !== null) return 1;
        if (a.rank !== null && b.rank === null) return -1;
        // rankで昇順
        if (a.rank !== b.rank) {
          return (a.rank || 0) - (b.rank || 0);
        }
        // 次にnameで昇順
        return a.name.localeCompare(b.name);
      });
      
      return universities;
    }),

  /**
   * 大学を作成
   */
  create: publicProcedure
    .input(createUniversityInput)
    .mutation(async ({ input }) => {
      const { name, rank, notes } = input;
      
      // 大学データを作成
      const universityData: z.infer<typeof universitySchema> = {
        id: nanoid(),
        name,
        rank,
        notes,
        anki_note_id: undefined, // 後で設定するためにundefinedで初期化
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // 大学データをJSON形式に変換
      const universityJson = JSON.stringify(universityData);
      
      // Ankiに保存
      const noteId = await ankiConnect.note.addNote({
        note: {
          deckName: "Meta",
          modelName: "MetaData",
          fields: {
            Info: universityJson
          },
          tags: ["university"]
        }
      });
      
      if (!noteId) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create university in Anki'
        });
      }
      
      // Ankiノート情報を追加
      universityData.anki_note_id = noteId;
      
      return universitySchema.parse(universityData);
    }),

  /**
   * 大学を更新
   */
  update: publicProcedure
    .input(updateUniversityInput)
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;
      
      // Ankiからノート情報を取得
      const noteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:university ${toStringAnkiQuery(`"id":"${id}"`)}`
      });
      
      if (noteIds.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `University with ID ${id} not found in Anki`
        });
      }
      
      // 最初のノートを使用
      const noteId = noteIds[0];
      
      // 現在の大学データを取得
      const noteInfo = await ankiConnect.note.notesInfo({
        notes: [noteId]
      });
      
      const currentUniversityData: z.infer<typeof universitySchema> = JSON.parse(noteInfo[0].fields.Info.value);
      
      // 更新する大学データを作成
      const updatedUniversityData: z.infer<typeof universitySchema> = {
        ...currentUniversityData,
        ...updateData,
        updated_at: new Date()
      };
      
      // 大学データをJSON形式に変換
      const universityJson = JSON.stringify(updatedUniversityData);
      
      // Ankiのノートを更新
      await ankiConnect.note.updateNoteFields({
        note: {
          id: noteId,
          fields: {
            Info: universityJson
          }
        }
      });
      
      // Ankiノート情報を追加
      updatedUniversityData.anki_note_id = noteId;
      
      return universitySchema.parse(updatedUniversityData);
    }),

  /**
   * 大学を削除
   */
  delete: publicProcedure
    .input(deleteUniversityInput)
    .mutation(async ({ input }) => {
      const { id } = input;
      
      // Ankiからノート情報を取得
      const noteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:university ${toStringAnkiQuery(`"id":"${id}"`)}`
      });
      
      if (noteIds.length > 0) {
        // ノートを削除
        await ankiConnect.note.deleteNotes({
          notes: noteIds
        });
      }
      
      return { success: true, message: 'University deleted successfully' };
    }),
});

// ルーターの型定義 (クライアントで使用)
export type UniversityRouter = typeof universityRouter;
