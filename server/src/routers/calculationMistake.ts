import { z } from 'zod';
import { publicProcedure, router } from '../trpc.js';
import { YankiConnect } from 'yanki-connect';
import {
  CalculationMistakeTypeSchema,
  CalculationMistakeDetailSchema,
  UpdateCalculationMistakeDetailInputSchema // 更新用スキーマをインポート
} from '@answeranki/shared/schemas/calculationMistake';
import { TRPCError } from '@trpc/server';
import { toStringAnkiQuery } from '../utils.js';

const ankiConnect = new YankiConnect();

export const calculationMistakeRouter = router({
  /**
   * 計算ミスの種類一覧を取得する
   */
  listTypes: publicProcedure
    .output(z.array(CalculationMistakeTypeSchema))
    .query(async () => {
      try {
        // Ankiから"Meta"デッキの"MetaData"ノートタイプ、"CalculationMistakeType"タグを持つノートを検索
        const noteIds = await ankiConnect.note.findNotes({
          query: 'deck:"Meta" note:"MetaData" tag:"CalculationMistakeType"'
        });

        if (noteIds.length === 0) {
          return [];
        }

        // 各ノートの詳細情報を取得
        const notesInfo = await ankiConnect.note.notesInfo({
          notes: noteIds
        });

        // ノート情報から種類データを抽出・検証
        const types = notesInfo.map(note => {
          try {
            // Infoフィールドからデータを取得し、JSONパース
            const typeData = JSON.parse(note.fields.Info.value);
            // AnkiノートIDを追加
            const typeWithId = { ...typeData, id: note.noteId.toString() }; // IDは文字列として扱う
            // Zodスキーマで検証
            return CalculationMistakeTypeSchema.parse(typeWithId);
          } catch (error) {
            console.error(`Failed to parse CalculationMistakeType from note ${note.noteId}:`, error);
            // パースや検証に失敗したノートはスキップ（またはエラー処理）
            return null;
          }
        }).filter((type): type is z.infer<typeof CalculationMistakeTypeSchema> => type !== null); // nullを除外

        return types;

      } catch (error) {
        console.error("Failed to list calculation mistake types:", error);
        // AnkiConnectへの接続エラーなどを考慮
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch calculation mistake types from Anki.',
          cause: error,
        });
      }
    }),

  /**
   * 新しい計算ミスの種類を作成する
   */
  createType: publicProcedure
    .input(z.object({ name: z.string() }))
    .output(z.number().nullable()) // AnkiノートIDまたはnullを返す
    .mutation(async ({ input }) => {
      try {
        // Ankiに新しいノートを追加
        const noteId = await ankiConnect.note.addNote({
          note: {
            deckName: "Meta",
            modelName: "MetaData",
            fields: {
              // Infoフィールドに種類名をJSON形式で保存
              Info: JSON.stringify({ name: input.name })
            },
            tags: ["CalculationMistakeType"] // 識別用のタグを追加
          }
        });

        return noteId;

      } catch (error) {
        console.error("Failed to create calculation mistake type:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create calculation mistake type in Anki.',
          cause: error,
        });
      }
    }),

  /**
   * 計算ミスの詳細一覧を取得する
   * オプションで種類IDや問題ノートIDでフィルタリング可能
   */
  listDetails: publicProcedure
    .input(z.object({
      typeId: z.string().optional(),
      problemNoteId: z.number().optional(),
    }).optional())
    .output(z.array(CalculationMistakeDetailSchema))
    .query(async ({ input }) => {
      try {
        // 基本クエリ
        let query = 'deck:"Meta" note:"MetaData" tag:"CalculationMistakeDetail"';

        // Ankiからノートを検索
        const noteIds = await ankiConnect.note.findNotes({ query });

        if (noteIds.length === 0) {
          return [];
        }

        // 各ノートの詳細情報を取得
        const notesInfo = await ankiConnect.note.notesInfo({ notes: noteIds });

        // ノート情報から詳細データを抽出・検証
        let details = notesInfo.map(note => {
          try {
            const detailData = JSON.parse(note.fields.Info.value);
            const detailWithId = { ...detailData, id: note.noteId.toString() };
            return CalculationMistakeDetailSchema.parse(detailWithId);
          } catch (error) {
            console.error(`Failed to parse CalculationMistakeDetail from note ${note.noteId}:`, error);
            return null;
          }
        }).filter((detail): detail is z.infer<typeof CalculationMistakeDetailSchema> => detail !== null);

        // フィルタリング
        if (input?.typeId) {
          details = details.filter(detail => detail.typeId === input.typeId);
        }
        if (input?.problemNoteId) {
          details = details.filter(detail => detail.problemNoteId === input.problemNoteId);
        }

        // 作成日時で降順ソート
        details.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return details;

      } catch (error) {
        console.error("Failed to list calculation mistake details:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch calculation mistake details from Anki.',
          cause: error,
        });
      }
    }),

  /**
   * 新しい計算ミスの詳細を作成する
   */
  createDetail: publicProcedure
    .input(z.object({
      typeId: z.string(),
      description: z.string(),
      problemNoteId: z.number().optional(),
    }))
    .output(z.number().nullable()) // AnkiノートIDまたはnullを返す
    .mutation(async ({ input }) => {
      try {
        // 保存するデータを作成
        const detailData = {
          typeId: input.typeId,
          description: input.description,
          problemNoteId: input.problemNoteId,
          createdAt: new Date().toISOString(), // ISO 8601形式で現在時刻を保存
        };

        // Ankiに新しいノートを追加
        const noteId = await ankiConnect.note.addNote({
          note: {
            deckName: "Meta",
            modelName: "MetaData",
            fields: {
              // Infoフィールドに詳細データをJSON形式で保存
              Info: JSON.stringify(detailData)
            },
            tags: ["CalculationMistakeDetail"] // 識別用のタグを追加
          }
        });

        return noteId;

      } catch (error) {
        console.error("Failed to create calculation mistake detail:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create calculation mistake detail in Anki.',
          cause: error,
        });
      }
    }),

  /**
   * 計算ミスの詳細を更新する
   */
  updateDetail: publicProcedure
    .input(UpdateCalculationMistakeDetailInputSchema) // 更新用スキーマを使用
    .mutation(async ({ input }) => {
      try {
        // 1. 更新対象のノート情報を取得して既存データを確認
        const notesInfo = await ankiConnect.note.notesInfo({ notes: [parseInt(input.id, 10)] });
        if (notesInfo.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Calculation mistake detail with ID ${input.id} not found.`,
          });
        }
        const existingNote = notesInfo[0];
        let existingData: Partial<z.infer<typeof CalculationMistakeDetailSchema>> = {};
        try {
          existingData = JSON.parse(existingNote.fields.Info.value);
        } catch (parseError) {
          console.warn(`Failed to parse existing data for note ${input.id}. Proceeding with update, but some fields might be lost.`, parseError);
          // パース失敗しても、最低限の更新は試みる
        }

        // 2. 更新後のデータを作成 (createdAt と problemNoteId は既存の値を維持)
        const updatedDetailData = {
          typeId: input.typeId,
          description: input.description,
          problemNoteId: existingData.problemNoteId, // 既存の値を維持
          createdAt: existingData.createdAt ?? new Date().toISOString(), // 既存の値、なければ現在時刻 (フォールバック)
        };

        // 3. Ankiノートのフィールドを更新
        await ankiConnect.note.updateNoteFields({
          note: {
            id: parseInt(input.id, 10),
            fields: {
              Info: JSON.stringify(updatedDetailData)
            }
            // タグは変更しない
          }
        });

        // 更新成功時は何も返さない (void)
        return;

      } catch (error) {
        // TRPCError はそのままスロー
        if (error instanceof TRPCError) {
          throw error;
        }
        // その他のエラー
        console.error("Failed to update calculation mistake detail:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update calculation mistake detail in Anki.',
          cause: error,
        });
      }
    }),
});
