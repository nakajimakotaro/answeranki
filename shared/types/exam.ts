import { z } from 'zod';

/**
 * Shared types for Exam data between client and server.
 */

/**
 * 試験の形式を表す型 (DBに保存される文字列)
 * - descriptive: 記述式
 * - multiple_choice: マーク式
 * - combined: 記述・マーク併用
 */
export type ExamFormatType = 'descriptive' | 'multiple_choice' | 'combined';

/**
 * 科目別点数の試験形式を表す型エイリアス (UI表示用など)
 * - 共テ: 共通テスト
 * - 二次試験: 二次試験
 */
export type SubjectExamType = '共テ' | '二次試験';


/**
 * 統合された試験情報を表すインターフェース (exams テーブルに対応)
 * This should be the single source of truth for the Exam data structure.
 */
export interface Exam {
  id: number;
  name: string;
  date: Date; // Changed to Date
  is_mock: boolean; // true: 模試, false: 本番 (Matches DB schema)
  exam_type: string; // Matches DB schema (e.g., 'descriptive', 'multiple_choice')
  university_id?: number | null; // Matches DB schema (Nullable)
  notes?: string | null; // Matches DB schema (Nullable)
  // Optional fields that might be added by API joins
  university_name?: string | null;
  scores?: ExamScore[];
  subject_scores?: SubjectScore[]; // Added for consistency if needed
}

/**
 * 試験の点数情報を表すインターフェース (exam_scores テーブルに対応)
 */
export interface ExamScore {
  id: number;
  exam_id: number; // 関連する試験ID
  note_id: number; // 関連する問題/ノートID (Ankiなど)
  descriptive_score?: number | null;
  multiple_choice_score?: number | null;
  total_score?: number | null;
  max_score?: number | null;
  created_at?: Date | null; // Changed to Date
  updated_at?: Date | null; // Changed to Date
  exam_name?: string;
  exam_date?: Date | null; // Changed to Date
  is_mock?: boolean;
}

/**
 * 科目別点数データを表すインターフェース (subject_scores テーブルに対応)
 */
export interface SubjectScore {
  id: number;
  exam_id: number;
  exam_type: string; // Matches DB schema (e.g., '共テ', '二次試験') - Note: This might differ from Exam.exam_type
  subject: string;
  score?: number | null;
  max_score?: number | null;
  created_at: Date; // Changed to Date
  updated_at: Date; // Changed to Date
}


/**
 * 新規試験作成/更新時の入力データ用インターフェース
 */
export interface ExamInput {
  name: string;
  date: Date; // Changed to Date (Consider using z.coerce.date in schema)
  is_mock: boolean;
  exam_type: string; // Matches DB schema
  university_id?: number | null;
  notes?: string | null;
}

/**
 * 新規試験点数作成/更新時の入力データ用インターフェース
 */
export interface ExamScoreInput {
  exam_id?: number;
  note_id: number;
  descriptive_score?: number | null;
  multiple_choice_score?: number | null;
  total_score?: number | null;
  max_score?: number | null;
}

/**
 * 新規科目別点数作成/更新時の入力データ用インターフェース
 */
export interface SubjectScoreInput {
  exam_id?: number;
  exam_type: string; // Matches DB schema
  subject: string;
  score?: number | null;
  max_score?: number | null;
}

/**
 * 科目別点数一括登録用の入力データ
 */
export interface BatchSubjectScoreInput {
  scores: SubjectScoreInput[];
}


// Zod Schemas
export const ExamSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  date: z.date(), // Changed to z.date()
  is_mock: z.boolean(),
  exam_type: z.string(),
  university_id: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  university_name: z.string().nullable().optional(),
  scores: z.array(z.lazy(() => ExamScoreSchema)).optional(),
  subject_scores: z.array(z.lazy(() => SubjectScoreSchema)).optional(),
});

export const ExamScoreSchema = z.object({
  id: z.number().int(),
  exam_id: z.number().int(),
  note_id: z.number().int(),
  descriptive_score: z.number().nullable().optional(),
  multiple_choice_score: z.number().nullable().optional(),
  total_score: z.number().nullable().optional(),
  max_score: z.number().nullable().optional(),
  created_at: z.date().optional().nullable(), // Changed to z.date()
  updated_at: z.date().optional().nullable(), // Changed to z.date()
  exam_name: z.string().optional(),
  exam_date: z.date().optional().nullable(), // Changed to z.date()
  is_mock: z.boolean().optional(),
});

export const SubjectScoreSchema = z.object({
  id: z.number().int(),
  exam_id: z.number().int(),
  exam_type: z.string(),
  subject: z.string(),
  score: z.number().nullable().optional(),
  max_score: z.number().nullable().optional(),
  created_at: z.date(), // Changed to z.date()
  updated_at: z.date(), // Changed to z.date()
});

// Input schema using coerce.date for flexibility
export const ExamInputSchema = z.object({
  name: z.string(),
  date: z.coerce.date(), // Use coerce.date for input
  is_mock: z.boolean(),
  exam_type: z.string(),
  university_id: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type ExamInputType = z.infer<typeof ExamInputSchema>; // Export inferred type

// Add ExamUpdateSchema by extending ExamInputSchema with id
export const ExamUpdateSchema = ExamInputSchema.extend({
  id: z.number().int().positive(),
});
export type ExamUpdateInputType = z.infer<typeof ExamUpdateSchema>; // Export inferred type

// Consider adding input schemas for ExamScore and SubjectScore if needed
