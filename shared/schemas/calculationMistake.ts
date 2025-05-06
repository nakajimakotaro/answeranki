import { z } from 'zod';

// 計算ミスの種類を表すスキーマ
export const CalculationMistakeTypeSchema = z.object({
  id: z.string(), // AnkiノートID
  name: z.string(),
});

export type CalculationMistakeType = z.infer<typeof CalculationMistakeTypeSchema>;

// 計算ミスの詳細を表すスキーマ
export const CalculationMistakeDetailSchema = z.object({
  id: z.string(), // AnkiノートID
  typeId: z.string(), // CalculationMistakeTypeのID
  description: z.string(),
  problemNoteId: z.number().optional(), // 関連する問題のAnkiノートID (任意)
  createdAt: z.string().datetime(), // ISO 8601形式の作成日時文字列
});

export type CalculationMistakeDetail = z.infer<typeof CalculationMistakeDetailSchema>;

// 計算ミスの詳細を更新するための入力スキーマ
export const UpdateCalculationMistakeDetailInputSchema = z.object({
  id: z.string(), // 更新対象のAnkiノートID
  typeId: z.string(), // 新しいCalculationMistakeTypeのID
  description: z.string(),
  // problemNoteId と createdAt は更新不可とする
});

export type UpdateCalculationMistakeDetailInput = z.infer<typeof UpdateCalculationMistakeDetailInputSchema>;
