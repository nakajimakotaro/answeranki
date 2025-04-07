import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import prisma from '../db/prisma.js';

// Zod スキーマ定義 (Prismaの型と一致させる)
// Prismaのモデルに基づいてスキーマを定義すると、型安全性が高まる
const universitySchema = z.object({
  id: z.number(), // Prismaは通常number型のIDを返す
  name: z.string().min(1, { message: 'University name is required' }),
  rank: z.number().nullable(),
  notes: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

// 入力スキーマ
const createUniversityInput = universitySchema.omit({ id: true, created_at: true, updated_at: true }); // 作成時は自動生成フィールドを除外
const updateUniversityInput = z.object({ // 更新時はIDと更新したいフィールドを指定
  id: z.number(),
  name: z.string().min(1).optional(),
  rank: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
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
      const universities = await prisma.universities.findMany({
        orderBy: [
          { rank: 'asc' }, // rankで昇順 (nulls last by default in postgres)
            { name: 'asc' }, // 次にnameで昇順
          ],
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
      const newUniversity = await prisma.universities.create({
        data: {
          name,
            rank: rank,
            notes: notes,
        },
      });
      return universitySchema.parse(newUniversity);
    }),

  /**
   * 大学を更新
   */
  update: publicProcedure
    .input(updateUniversityInput)
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;
      const updatedUniversity = await prisma.universities.update({
        where: { id: id },
        data: updateData,
      });
      return universitySchema.parse(updatedUniversity);
    }),

  /**
   * 大学を削除
   */
  delete: publicProcedure
    .input(deleteUniversityInput)
    .mutation(async ({ input }) => {
      const { id } = input;
      await prisma.universities.delete({
        where: { id: id },
      });
      return { success: true, message: 'University deleted successfully' };
    }),
});

// ルーターの型定義 (クライアントで使用)
export type UniversityRouter = typeof universityRouter;
