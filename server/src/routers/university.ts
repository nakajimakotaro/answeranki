import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import { getDbPool } from '../db/database.js'; // Changed to getDbPool
import { NotFoundError, BadRequestError } from '../middleware/errorHandler.js';
import { TRPCError } from '@trpc/server'; // Import TRPCError

// Zod スキーマ定義
const universitySchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, { message: 'University name is required' }),
  rank: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  // created_at と updated_at はDBから取得するが、入力や共通型としては含めない
});

// DBから取得する際の型（タイムスタンプを含む）
// tRPCの出力型は自動推論されるため、明示的な型定義は必須ではないが、
// DB操作の結果を扱う際に役立つことがある
export interface UniversityDbRecord extends z.infer<typeof universitySchema> {
  created_at?: string;
  updated_at?: string;
}

const createUniversityInput = universitySchema.omit({ id: true }); // 作成時はID不要
const updateUniversityInput = universitySchema.extend({ // 更新時はID必須
  id: z.number(),
});
const deleteUniversityInput = z.object({
  id: z.number(),
});

export const universityRouter = router({
  /**
   * 大学一覧を取得
   */
  getAll: publicProcedure
    .query(async () => {
      const pool = getDbPool(); // Changed to getDbPool
      try {
        // Use pool.query for PostgreSQL
        const result = await pool.query<UniversityDbRecord>('SELECT * FROM universities ORDER BY rank, name');
        const universitiesData = result.rows;
        // Zodスキーマでパースして、不要なフィールドを除去し、型を保証する
        return z.array(universitySchema).parse(universitiesData);
      } catch (error) {
        console.error("Failed to parse universities data:", error);
        // Use TRPCError for error handling
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve universities due to data validation error.',
            cause: error,
        });
      }
    }),

  /**
   * 大学を作成
   */
  create: publicProcedure
    .input(createUniversityInput)
    .mutation(async ({ input }) => {
      const { name, rank, notes } = input;
      const pool = getDbPool(); // Changed to getDbPool
      try {
        // Use pool.query and RETURNING *
        const result = await pool.query(
          'INSERT INTO universities (name, rank, notes) VALUES ($1, $2, $3) RETURNING *',
          [name, rank ?? null, notes ?? null] // Handle potential nulls
        );
        const newUniversity = result.rows[0];
        if (!newUniversity) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve newly created university' });
        }
        // 作成時もスキーマでパースして返す
        return universitySchema.parse(newUniversity);
      } catch (error: any) {
          console.error("Error creating university:", error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Failed to create university' });
      }
    }),
  /**
   * 大学を更新
   */
  update: publicProcedure
    .input(updateUniversityInput)
    .mutation(async ({ input }) => {
      const { id, name, rank, notes } = input;
      const pool = getDbPool(); // Changed to getDbPool
      try {
          // Check if university exists
          const existingResult = await pool.query('SELECT id FROM universities WHERE id = $1', [id]);
          if (existingResult.rowCount === 0) {
            throw new NotFoundError('University not found'); // Use custom error
          }

          // Use pool.query and RETURNING *
          const result = await pool.query(
            'UPDATE universities SET name = $1, rank = $2, notes = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [name, rank ?? null, notes ?? null, id] // Handle potential nulls
          );
          const updatedUniversity = result.rows[0];
           if (!updatedUniversity) {
            // This case should ideally not happen if update succeeded
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve updated university' });
          }
          // 更新時もスキーマでパースして返す
          return universitySchema.parse(updatedUniversity);
      } catch (error: any) {
          console.error(`Error updating university ${id}:`, error);
          if (error instanceof NotFoundError) throw error; // Re-throw known errors
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Failed to update university' });
      }
    }),
  /**
   * 大学を削除
   */
  delete: publicProcedure
    .input(deleteUniversityInput)
    .mutation(async ({ input }) => {
      const { id } = input;
      const pool = getDbPool(); // Changed to getDbPool
      // Use pool.query for DELETE
      const result = await pool.query('DELETE FROM universities WHERE id = $1', [id]);
      if (result.rowCount === 0) { // Check rowCount
        throw new NotFoundError('University not found'); // Use custom error
      }
      return { message: 'University deleted successfully' };
    }),
});

// ルーターの型定義 (クライアントで使用)
export type UniversityRouter = typeof universityRouter;
