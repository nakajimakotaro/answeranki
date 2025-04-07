import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import prisma from '../db/prisma.js'; // Import Prisma Client
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client'; // Import Prisma types for error handling

// Zod スキーマ定義 (Prismaの型と一致させる)
// Prismaのモデルに基づいてスキーマを定義すると、型安全性が高まる
const universitySchema = z.object({
  id: z.number(), // Prismaは通常number型のIDを返す
  name: z.string().min(1, { message: 'University name is required' }),
  rank: z.number().nullable(), // nullを許容
  notes: z.string().nullable(), // nullを許容
  created_at: z.date(), // PrismaはDateオブジェクトを返す
  updated_at: z.date(), // PrismaはDateオブジェクトを返す
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
      try {
        const universities = await prisma.universities.findMany({
          orderBy: [
            { rank: 'asc' }, // rankで昇順 (nulls last by default in postgres)
            { name: 'asc' }, // 次にnameで昇順
          ],
        });
        // Prisma Clientが型付けされたデータを返す
        // 必要に応じてZodでパースして返すことも可能だが、通常は不要
        // return z.array(universitySchema).parse(universities);
        return universities;
      } catch (error) {
        console.error('Failed to retrieve universities:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve universities.',
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
      try {
        const newUniversity = await prisma.universities.create({
          data: {
            name,
            rank: rank, // Prismaはundefinedを無視するので、nullチェックは不要な場合が多い
            notes: notes,
          },
        });
        return universitySchema.parse(newUniversity); // 返却前にスキーマでパース
      } catch (error: any) {
        console.error('Error creating university:', error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2002') { // Unique constraint violation
            throw new TRPCError({
              code: 'CONFLICT',
              message: `University with name "${name}" might already exist.`, // より具体的なメッセージ
            });
          }
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create university',
          cause: error,
        });
      }
    }),

  /**
   * 大学を更新
   */
  update: publicProcedure
    .input(updateUniversityInput)
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input; // IDと更新データを分離
      try {
        const updatedUniversity = await prisma.universities.update({
          where: { id: id },
          data: updateData, // name, rank, notes が含まれるオブジェクト
        });
        return universitySchema.parse(updatedUniversity); // 返却前にスキーマでパース
      } catch (error: any) {
        console.error(`Error updating university ${id}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2025') { // Record to update not found
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `University with ID ${id} not found.`,
            });
          }
          if (error.code === 'P2002') { // Unique constraint violation during update
             throw new TRPCError({
              code: 'CONFLICT',
              message: `Cannot update university: name "${updateData.name}" might already exist for another university.`,
            });
          }
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update university',
          cause: error,
        });
      }
    }),

  /**
   * 大学を削除
   */
  delete: publicProcedure
    .input(deleteUniversityInput)
    .mutation(async ({ input }) => {
      const { id } = input;
      try {
        await prisma.universities.delete({
          where: { id: id },
        });
        // 成功時はステータスコード 204 No Content が返るのが一般的だが、
        // tRPCではメッセージを返すこともできる
        return { success: true, message: 'University deleted successfully' };
      } catch (error: any) {
        console.error(`Error deleting university ${id}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2025') { // Record to delete not found
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `University with ID ${id} not found.`,
            });
          }
           // P2003: Foreign key constraint failed (e.g., exams referencing this university)
          if (error.code === 'P2003') {
             throw new TRPCError({
              code: 'CONFLICT',
              message: `Cannot delete university with ID ${id} because it is referenced by other records (e.g., exams).`,
            });
          }
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete university',
          cause: error,
        });
      }
    }),
});

// ルーターの型定義 (クライアントで使用)
export type UniversityRouter = typeof universityRouter;
