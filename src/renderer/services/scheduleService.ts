/**
 * スケジュール管理サービス
 * バックエンドのスケジュールAPIと通信するためのサービス
 */

// 大学情報の型定義
export interface University {
  id?: number;
  name: string;
  rank?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// 参考書情報の型定義
export interface Textbook {
  id?: number;
  title: string;
  subject: string;
  total_problems: number;
  anki_deck_name?: string;
  created_at?: string;
  updated_at?: string;
}

// 勉強スケジュールの型定義
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

// 受験日の型定義
export interface ExamDate {
  id?: number;
  university_id: number;
  university_name?: string;
  exam_date: string;
  exam_type: string;
  created_at?: string;
  updated_at?: string;
}

// 学習ログの型定義
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

// 進捗情報の型定義
export interface Progress {
  textbook: Textbook;
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

// 年間学習ログの型定義
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

// APIエラーの型定義
export interface ApiError {
  error: string;
  details?: string;
}

/**
 * スケジュールサービスクラス
 */
class ScheduleService {
  private baseUrl = '/api/schedule';

  /**
   * APIリクエストを送信する
   * @param endpoint エンドポイント
   * @param method HTTPメソッド
   * @param body リクエストボディ（オプション）
   * @returns レスポンスデータ
   */
  private async fetchApi<T>(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'APIリクエストが失敗しました');
    }

    return response.json() as Promise<T>;
  }

  // 大学関連のAPI

  /**
   * 大学一覧を取得する
   * @returns 大学一覧
   */
  async getUniversities(): Promise<University[]> {
    return this.fetchApi<University[]>('/universities');
  }

  /**
   * 大学を作成する
   * @param university 大学情報
   * @returns 作成された大学情報
   */
  async createUniversity(university: University): Promise<University> {
    return this.fetchApi<University>('/universities', 'POST', university);
  }

  /**
   * 大学を更新する
   * @param id 大学ID
   * @param university 更新する大学情報
   * @returns 更新された大学情報
   */
  async updateUniversity(id: number, university: University): Promise<University> {
    return this.fetchApi<University>(`/universities/${id}`, 'PUT', university);
  }

  /**
   * 大学を削除する
   * @param id 大学ID
   * @returns 削除結果
   */
  async deleteUniversity(id: number): Promise<{ message: string }> {
    return this.fetchApi<{ message: string }>(`/universities/${id}`, 'DELETE');
  }

  // 参考書関連のAPI

  /**
   * 参考書一覧を取得する
   * @returns 参考書一覧
   */
  async getTextbooks(): Promise<Textbook[]> {
    return this.fetchApi<Textbook[]>('/textbooks');
  }

  /**
   * 参考書を作成する
   * @param textbook 参考書情報
   * @returns 作成された参考書情報
   */
  async createTextbook(textbook: Textbook): Promise<Textbook> {
    return this.fetchApi<Textbook>('/textbooks', 'POST', textbook);
  }

  /**
   * 参考書を更新する
   * @param id 参考書ID
   * @param textbook 更新する参考書情報
   * @returns 更新された参考書情報
   */
  async updateTextbook(id: number, textbook: Textbook): Promise<Textbook> {
    return this.fetchApi<Textbook>(`/textbooks/${id}`, 'PUT', textbook);
  }

  /**
   * 参考書を削除する
   * @param id 参考書ID
   * @returns 削除結果
   */
  async deleteTextbook(id: number): Promise<{ message: string }> {
    return this.fetchApi<{ message: string }>(`/textbooks/${id}`, 'DELETE');
  }

  // スケジュール関連のAPI

  /**
   * スケジュール一覧を取得する
   * @returns スケジュール一覧
   */
  async getSchedules(): Promise<StudySchedule[]> {
    return this.fetchApi<StudySchedule[]>('/schedules');
  }

  /**
   * スケジュールを作成する
   * @param schedule スケジュール情報
   * @returns 作成されたスケジュール情報
   */
  async createSchedule(schedule: StudySchedule): Promise<StudySchedule> {
    return this.fetchApi<StudySchedule>('/schedules', 'POST', schedule);
  }

  /**
   * スケジュールを更新する
   * @param id スケジュールID
   * @param schedule 更新するスケジュール情報
   * @returns 更新されたスケジュール情報
   */
  async updateSchedule(id: number, schedule: StudySchedule): Promise<StudySchedule> {
    return this.fetchApi<StudySchedule>(`/schedules/${id}`, 'PUT', schedule);
  }

  /**
   * スケジュールを削除する
   * @param id スケジュールID
   * @returns 削除結果
   */
  async deleteSchedule(id: number): Promise<{ message: string }> {
    return this.fetchApi<{ message: string }>(`/schedules/${id}`, 'DELETE');
  }

  // 受験日関連のAPI

  /**
   * 受験日一覧を取得する
   * @returns 受験日一覧
   */
  async getExams(): Promise<ExamDate[]> {
    return this.fetchApi<ExamDate[]>('/exams');
  }

  /**
   * 受験日を作成する
   * @param exam 受験日情報
   * @returns 作成された受験日情報
   */
  async createExam(exam: ExamDate): Promise<ExamDate> {
    return this.fetchApi<ExamDate>('/exams', 'POST', exam);
  }

  /**
   * 受験日を更新する
   * @param id 受験日ID
   * @param exam 更新する受験日情報
   * @returns 更新された受験日情報
   */
  async updateExam(id: number, exam: ExamDate): Promise<ExamDate> {
    return this.fetchApi<ExamDate>(`/exams/${id}`, 'PUT', exam);
  }

  /**
   * 受験日を削除する
   * @param id 受験日ID
   * @returns 削除結果
   */
  async deleteExam(id: number): Promise<{ message: string }> {
    return this.fetchApi<{ message: string }>(`/exams/${id}`, 'DELETE');
  }

  // 学習ログ関連のAPI

  /**
   * 学習ログ一覧を取得する
   * @param params 検索条件
   * @returns 学習ログ一覧
   */
  async getLogs(params?: {
    start_date?: string;
    end_date?: string;
    textbook_id?: number;
  }): Promise<StudyLog[]> {
    let endpoint = '/logs';
    
    if (params) {
      const queryParams = new URLSearchParams();
      
      if (params.start_date) {
        queryParams.append('start_date', params.start_date);
      }
      
      if (params.end_date) {
        queryParams.append('end_date', params.end_date);
      }
      
      if (params.textbook_id) {
        queryParams.append('textbook_id', params.textbook_id.toString());
      }
      
      const queryString = queryParams.toString();
      if (queryString) {
        endpoint += `?${queryString}`;
      }
    }
    
    return this.fetchApi<StudyLog[]>(endpoint);
  }

  /**
   * 学習ログを作成する
   * @param log 学習ログ情報
   * @returns 作成された学習ログ情報
   */
  async createLog(log: StudyLog): Promise<StudyLog> {
    return this.fetchApi<StudyLog>('/logs', 'POST', log);
  }

  /**
   * 学習ログを更新する
   * @param id 学習ログID
   * @param log 更新する学習ログ情報
   * @returns 更新された学習ログ情報
   */
  async updateLog(id: number, log: StudyLog): Promise<StudyLog> {
    return this.fetchApi<StudyLog>(`/logs/${id}`, 'PUT', log);
  }

  /**
   * 学習ログを削除する
   * @param id 学習ログID
   * @returns 削除結果
   */
  async deleteLog(id: number): Promise<{ message: string }> {
    return this.fetchApi<{ message: string }>(`/logs/${id}`, 'DELETE');
  }

  // 進捗関連のAPI

  /**
   * 参考書の進捗情報を取得する
   * @param textbookId 参考書ID
   * @returns 進捗情報
   */
  async getProgress(textbookId: number): Promise<Progress> {
    return this.fetchApi<Progress>(`/progress/${textbookId}`);
  }

  // Anki連携関連のAPI

  /**
   * Ankiと連携している参考書一覧を取得する
   * @returns Ankiと連携している参考書一覧
   */
  async getAnkiLinkedTextbooks(): Promise<Textbook[]> {
    return this.fetchApi<Textbook[]>('/anki/textbooks');
  }

  /**
   * 参考書とAnkiデッキを紐付ける
   * @param textbookId 参考書ID
   * @param deckName デッキ名
   * @returns 更新された参考書情報
   */
  async linkTextbookToAnkiDeck(textbookId: number, deckName: string): Promise<Textbook> {
    return this.fetchApi<Textbook>(`/anki/link/${textbookId}`, 'PUT', { deckName });
  }

  /**
   * 年間の学習ログを取得する
   * @param params 検索条件
   * @returns 年間学習ログデータ
   */
  async getYearlyLogs(params?: {
    year?: number | string;
    textbook_id?: number;
    subject?: string;
  }): Promise<YearlyLogData> {
    let endpoint = '/logs/yearly';
    
    if (params) {
      const queryParams = new URLSearchParams();
      
      if (params.year) {
        queryParams.append('year', params.year.toString());
      }
      
      if (params.textbook_id) {
        queryParams.append('textbook_id', params.textbook_id.toString());
      }
      
      if (params.subject) {
        queryParams.append('subject', params.subject);
      }
      
      const queryString = queryParams.toString();
      if (queryString) {
        endpoint += `?${queryString}`;
      }
    }
    
    return this.fetchApi<YearlyLogData>(endpoint);
  }
}

// シングルトンインスタンスをエクスポート
export const scheduleService = new ScheduleService();

export default ScheduleService;
