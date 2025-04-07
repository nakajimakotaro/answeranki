/**
 * スケジュール管理サービス (tRPC移行中)
 * バックエンドのスケジュールAPIと通信するためのサービス (一部残存)
 */
import { parseISO } from 'date-fns';
import type { Exam } from '@shared/types/exam'; // Removed .js extension
import { trpc } from '../lib/trpc'; // Import the tRPC client - Removed .js extension

// University interface removed, handled by tRPC
// Textbook interface removed, handled by tRPC

// 勉強スケジュールの型定義 (Keep if used by remaining methods)
export interface StudySchedule {
  id?: number;
  textbook_id: number;
  textbook_title?: string;
  textbook_subject?: string;
  start_date: string;
  end_date: string;
  daily_goal?: number;
  buffer_days?: number;
  weekday_goals?: string; // 曜日ごとの問題数（JSON文字列）
  total_problems?: number; // 総問題数（指定された場合）
  created_at?: string;
  updated_at?: string;
}

// 学習ログの型定義 (Keep if used by remaining methods)
export interface StudyLog {
  id?: number;
  date: string;
  textbook_id: number;
  textbook_title?: string;
  textbook_subject?: string;
  planned_amount: number;
  actual_amount: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// 進捗情報の型定義 (Keep if used by remaining methods)
// Note: Textbook type here needs to be addressed if it was defined locally
// Assuming a temporary or placeholder type if the original is removed
interface PlaceholderTextbook { id?: number; title: string; subject: string; total_problems: number; }
export interface Progress {
  textbook: PlaceholderTextbook; // Use placeholder or import correct type
  schedule?: StudySchedule;
  progress: {
    totalProblems: number;
    solvedProblems: number;
    remainingProblems: number;
    progressPercentage: number;
    daysRemaining: number;
    dailyTarget: number;
  };
  logs: StudyLog[];
}

// 年間学習ログの型定義 (Keep if used by remaining methods)
export interface YearlyLogData {
  logs: {
    date: string;
    total_amount: number;
  }[];
  statistics: {
    totalAmount: number;
    studyDays: number;
    maxDay: number;
    avgPerDay: number;
  };
  filters: {
    subjects: string[];
    textbooks: {
      id: number;
      title: string;
      subject: string;
    }[];
  };
}

// APIエラーの型定義 (Keep if used by remaining methods)
export interface ApiError {
  error: string;
  details?: string;
}

// タイムラインイベントの型定義 (サーバー側と合わせる) (Keep if used by remaining methods)
export interface TimelineEvent {
  id: string; // 例: "schedule-1", "exam-5", "mock_exam-10"
  type: 'schedule' | 'exam' | 'mock_exam';
  title: string; // 例: "数学 参考書A", "大学X 共通テスト", "第1回 模試Y"
  startDate: Date; // Use Date object
  endDate?: Date; // Use Date object (optional for schedule)
  details: StudySchedule | Exam | any; // Use shared Exam type for exam/mock_exam details - 'any' might need refinement based on actual usage
}

// Raw event type received from API before parsing dates (Keep if used by remaining methods)
// Note: This might become obsolete if tRPC handles date parsing or returns Date objects directly
interface RawTimelineEvent {
    id: string;
    type: 'schedule' | 'exam' | 'mock_exam';
    title: string;
    startDate: string; // Date string from API
    endDate?: string; // Date string from API
    details: any;
}


/**
 * スケジュールサービスクラス (tRPC移行中)
 */
class ScheduleService {
  // private baseUrl = '/api/schedule'; // No longer needed
  // private async fetchApi<T>(...) // No longer needed

  // --- University API methods removed (handled by tRPC) ---

  // --- Textbook API methods removed (handled by tRPC) ---

  // --- Study Schedule Methods (Migrated to tRPC) ---
  // Note: These methods now directly call tRPC procedures.
  // Consider using tRPC hooks (useQuery, useMutation) directly in components/hooks instead of this service layer.
  // The methods below are placeholders and should be removed.
  // Use `trpc.schedule.listSchedules.useQuery()` in your components/hooks.
  async listSchedules(): Promise<StudySchedule[]> {
    throw new Error("Deprecated: Use tRPC hooks directly. e.g., trpc.schedule.listSchedules.useQuery()");
  }
  // Use `trpc.schedule.createSchedule.useMutation()` in your components/hooks.
  async createSchedule(schedule: Omit<StudySchedule, 'id' | 'textbook_title' | 'textbook_subject' | 'created_at' | 'updated_at'>): Promise<StudySchedule> {
     throw new Error("Deprecated: Use tRPC hooks directly. e.g., trpc.schedule.createSchedule.useMutation()");
  }
   // Use `trpc.schedule.updateSchedule.useMutation()` in your components/hooks.
  async updateSchedule(schedule: Omit<StudySchedule, 'textbook_title' | 'textbook_subject' | 'created_at' | 'updated_at'>): Promise<StudySchedule> {
     throw new Error("Deprecated: Use tRPC hooks directly. e.g., trpc.schedule.updateSchedule.useMutation()");
  }
  // Use `trpc.schedule.deleteSchedule.useMutation()` in your components/hooks.
  async deleteSchedule(id: number): Promise<{ success: boolean; message: string }> {
    throw new Error("Deprecated: Use tRPC hooks directly. e.g., trpc.schedule.deleteSchedule.useMutation()");
  }

  // --- Study Log Methods (Migrated to tRPC) ---
  // Use `trpc.schedule.listLogs.useQuery()` in your components/hooks.
  async getLogs(params?: { start_date?: string; end_date?: string; textbook_id?: number; }): Promise<StudyLog[]> {
    throw new Error("Deprecated: Use tRPC hooks directly. e.g., trpc.schedule.listLogs.useQuery()");
  }
  // Use `trpc.schedule.createLog.useMutation()` in your components/hooks.
  async createLog(log: Omit<StudyLog, 'id' | 'textbook_title' | 'textbook_subject' | 'created_at' | 'updated_at'>): Promise<StudyLog> {
    throw new Error("Deprecated: Use tRPC hooks directly. e.g., trpc.schedule.createLog.useMutation()");
  }
  // Use `trpc.schedule.updateLog.useMutation()` in your components/hooks.
  async updateLog(log: Omit<StudyLog, 'textbook_title' | 'textbook_subject' | 'created_at' | 'updated_at'>): Promise<StudyLog> {
    throw new Error("Deprecated: Use tRPC hooks directly. e.g., trpc.schedule.updateLog.useMutation()");
  }
  // Use `trpc.schedule.deleteLog.useMutation()` in your components/hooks.
  async deleteLog(id: number): Promise<{ success: boolean; message: string }> {
    throw new Error("Deprecated: Use tRPC hooks directly. e.g., trpc.schedule.deleteLog.useMutation()");
  }

  // --- Progress Method (TODO: Needs tRPC endpoint) ---
  async getProgress(textbookId: number): Promise<Progress> {
     // Placeholder: This needs a corresponding tRPC procedure
     console.warn("getProgress is not yet migrated to tRPC.");
     // return this.fetchApi<Progress>(`/progress/${textbookId}`);
     throw new Error("getProgress not implemented in tRPC yet.");
  }

  // --- Anki連携関連のAPI (Removed, handled by tRPC) ---

  // --- Yearly Logs Method (TODO: Needs tRPC endpoint) ---
  async getYearlyLogs(params?: { year?: number | string; textbook_id?: number; subject?: string; }): Promise<YearlyLogData> {
    // Placeholder: This needs a corresponding tRPC procedure
    console.warn("getYearlyLogs is not yet migrated to tRPC.");
    // let endpoint = '/logs/yearly'; ...
    // return this.fetchApi<YearlyLogData>(endpoint);
    throw new Error("getYearlyLogs not implemented in tRPC yet.");
  }

  // --- Timeline Events Method (Migrated to tRPC) ---
   // Use `trpc.schedule.getTimelineEvents.useQuery()` in your components/hooks.
   // The date parsing logic should ideally live within the hook or component using the data.
  async getTimelineEvents(startDate?: string, endDate?: string): Promise<TimelineEvent[]> {
     throw new Error("Deprecated: Use tRPC hooks directly. e.g., trpc.schedule.getTimelineEvents.useQuery()");
    // // Fetch raw events using tRPC - This call is incorrect here.
    // const rawEvents = await trpc.schedule.getTimelineEvents.query({ startDate, endDate });
    //
    // // Parse dates on the client side (as server returns strings for now)
    // // TODO: Consider refining the server output schema and transformation
    // return rawEvents.map((event: any) => ({ // Fix 'any' type if keeping this structure
    //     ...event,
    //     startDate: parseISO(event.startDate),
    //     endDate: event.endDate ? parseISO(event.endDate) : undefined,
    // }));
  }
}

// シングルトンインスタンスをエクスポート
export const scheduleService = new ScheduleService();

export default ScheduleService;
