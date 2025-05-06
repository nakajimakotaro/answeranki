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
