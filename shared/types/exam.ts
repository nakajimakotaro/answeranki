import { z } from 'zod'; // Import Zod

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
  date: string; // YYYY-MM-DD (Matches DB schema)
  is_mock: boolean; // true: 模試, false: 本番 (Matches DB schema)
  exam_type: string; // Matches DB schema (e.g., 'descriptive', 'multiple_choice')
  university_id?: number | null; // Matches DB schema (Nullable)
  notes?: string | null; // Matches DB schema (Nullable)
  // created_at and updated_at are internal, not needed by client
  // created_at: string; // Matches DB schema (Assuming string timestamp)
  // updated_at: string; // Matches DB schema (Assuming string timestamp)
  // Optional fields that might be added by API joins
  university_name?: string | null;
  // Optional: Scores might be loaded separately or included depending on the API endpoint
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
  created_at?: string;
  updated_at?: string;
  // Optional fields from joins
  exam_name?: string;
  exam_date?: string; // Keep consistent if joined data uses 'date'
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
  created_at: string;
  updated_at: string;
}


/**
 * 新規試験作成/更新時の入力データ用インターフェース
 */
export interface ExamInput {
  name: string;
  date: string; // Matches DB schema
  is_mock: boolean;
  exam_type: string; // Matches DB schema
  university_id?: number | null;
  notes?: string | null;
}

/**
 * 新規試験点数作成/更新時の入力データ用インターフェース
 */
export interface ExamScoreInput {
  // exam_id is usually provided via URL parameter, but included for completeness
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
   // exam_id is usually provided via URL parameter
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

// --- Zod Schemas ---

// Base schema for Exam, matching the interface
export const ExamSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  date: z.string(), // Consider z.date() if conversion is handled
  is_mock: z.boolean(),
  exam_type: z.string(),
  university_id: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Remove created_at and updated_at from the schema sent to client
  // created_at: z.string(), // Consider z.date()
  // updated_at: z.string(), // Consider z.date()
  // Optional fields from joins - keep optional
  university_name: z.string().nullable().optional(),
  // Optional arrays - keep optional and define their schemas
  scores: z.array(z.lazy(() => ExamScoreSchema)).optional(), // Use lazy for potential circular refs if needed
  subject_scores: z.array(z.lazy(() => SubjectScoreSchema)).optional(),
});

// Base schema for ExamScore, matching the interface
export const ExamScoreSchema = z.object({
  id: z.number().int(),
  exam_id: z.number().int(),
  note_id: z.number().int(),
  descriptive_score: z.number().nullable().optional(),
  multiple_choice_score: z.number().nullable().optional(),
  total_score: z.number().nullable().optional(),
  max_score: z.number().nullable().optional(),
  created_at: z.string().optional(), // Make optional if not always present
  updated_at: z.string().optional(), // Make optional if not always present
  // Optional fields from joins
  exam_name: z.string().optional(),
  exam_date: z.string().optional(),
  is_mock: z.boolean().optional(),
});

// Base schema for SubjectScore, matching the interface
export const SubjectScoreSchema = z.object({
  id: z.number().int(),
  exam_id: z.number().int(),
  exam_type: z.string(),
  subject: z.string(),
  score: z.number().nullable().optional(),
  max_score: z.number().nullable().optional(),
  created_at: z.string(), // Consider z.date()
  updated_at: z.string(), // Consider z.date()
});
