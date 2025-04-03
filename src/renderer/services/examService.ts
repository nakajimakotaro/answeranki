/**
 * Exam Service
 * 試験（模試・本番）の管理と点数の記録を行うサービス
 */
import { Exam, ExamFormatType, ExamInput, ExamScore, ExamScoreInput, SubjectExamType } from '../types/exam';

// 科目別点数データの型定義
export interface SubjectScore {
  id: number;
  exam_id: number;
  exam_type: SubjectExamType; // e.g., '共テ' or '二次試験'
  subject: string;
  score?: number;
  max_score?: number;
  created_at: string;
  updated_at: string;
}

// 科目別点数登録用の型定義
export interface CreateSubjectScoreData {
  exam_type: SubjectExamType;
  subject: string;
  score?: number;
  max_score?: number;
}

// 共通テストの科目一覧
export const COMMON_TEST_SUBJECTS = [
  '国語_現代文',
  '国語_古文',
  '国語_漢文',
  '数学_1a',
  '数学_2b',
  '英語_リーディング',
  '英語_リスニング',
  '化学',
  '物理',
  '公民・政治経済',
  '情報',
];

// 共通テストの満点
export const COMMON_TEST_MAX_SCORES: Record<string, number> = {
  '国語_現代文': 110,
  '国語_古文': 45,
  '国語_漢文': 45,
  '数学_1a': 100,
  '数学_2b': 100,
  '英語_リーディング': 100,
  '英語_リスニング': 100,
  '化学': 100,
  '物理': 100,
  '公民・政治経済': 100,
  '情報': 100,
};

// 二次試験の科目一覧
export const SECONDARY_TEST_SUBJECTS = [
  '国語',
  '英語',
  '化学',
  '物理',
  '数学'
];

/**
 * 試験サービスクラス
 */
class ExamService {
  private apiBaseUrl = '/api/exams';

  // 科目別点数の合計を計算する
  calculateTotalScore(scores: SubjectScore[]): { totalScore: number, totalMaxScore: number } {
    let totalScore = 0;
    let totalMaxScore = 0;

    scores.forEach(score => {
      if (score.score !== undefined && score.score !== null) {
        totalScore += score.score;
      }

      if (score.max_score !== undefined && score.max_score !== null) {
        totalMaxScore += score.max_score;
      }
    });

    return { totalScore, totalMaxScore };
  }

  /**
   * 全ての試験リストを取得する
   * @returns 試験のリスト (Exam[])
   */
  async getAllExams(): Promise<Exam[]> {
    try {
      const response = await fetch(this.apiBaseUrl); // GET request to the base URL

      if (!response.ok) {
        throw new Error(`Failed to fetch exams: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching all exams:', error);
      throw error;
    }
  }

  /**
   * 特定の試験を取得する
   * @param id 試験ID
   * @returns 試験データ
   */
  async getExam(id: number): Promise<Exam> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${id}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch exam: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching exam ${id}:`, error);
      throw error;
    }
  }

  /**
   * 新しい試験を作成する
   * @param data 試験データ (ExamInput)
   * @returns 作成された試験 (Exam)
   */
  async createExam(data: ExamInput): Promise<Exam> {
    try {
      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Failed to create exam: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating exam:', error);
      throw error;
    }
  }

  /**
   * 試験を更新する
   * @param id 試験ID
   * @param data 更新データ (ExamInput)
   * @returns 更新された試験 (Exam)
   */
  async updateExam(id: number, data: ExamInput): Promise<Exam> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Failed to update exam: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error updating exam ${id}:`, error);
      throw error;
    }
  }

  /**
   * 試験を削除する
   * @param id 試験ID
   * @returns 成功メッセージ
   */
  async deleteExam(id: number): Promise<{ message: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to delete exam: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error deleting exam ${id}:`, error);
      throw error;
    }
  }

  /**
   * 特定の試験の点数を取得する
   * @param examId 試験ID
   * @returns 点数のリスト (ExamScore[])
   */
  async getExamScores(examId: number): Promise<ExamScore[]> {
    try {
      // Assuming the API endpoint structure remains similar
      const response = await fetch(`${this.apiBaseUrl}/${examId}/scores`);

      if (!response.ok) {
        throw new Error(`Failed to fetch exam scores: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching scores for exam ${examId}:`, error);
      throw error;
    }
  }

  /**
   * 試験の点数を追加または更新する
   * @param examId 試験ID
   * @param data 点数データ (ExamScoreInput)
   * @returns 追加または更新された点数 (ExamScore)
   */
  async addOrUpdateExamScore(examId: number, data: ExamScoreInput): Promise<ExamScore> {
     // Ensure exam_id from ExamScoreInput is used correctly, or add if missing
     const payload = { ...data, exam_id: examId }; // Ensure exam_id is in payload if API expects it

    try {
      const response = await fetch(`${this.apiBaseUrl}/${examId}/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        // Send payload which includes exam_id if needed by backend logic
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to add/update exam score: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error adding/updating score for exam ${examId}:`, error);
      throw error;
    }
  }

  /**
   * 試験の点数を削除する
   * @param examId 試験ID
   * @param scoreId 点数ID
   * @returns 成功メッセージ
   */
  async deleteExamScore(examId: number, scoreId: number): Promise<{ message: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${examId}/scores/${scoreId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to delete exam score: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error deleting score ${scoreId} from exam ${examId}:`, error);
      throw error;
    }
  }

  /**
   * 特定のノートの試験点数を取得する
   * @param noteId ノートID
   * @returns 点数のリスト (ExamScore[])
   */
  async getNoteScores(noteId: number): Promise<ExamScore[]> {
    try {
      // Update API endpoint if necessary
      const response = await fetch(`/api/notes/${noteId}/exam-scores`);

      if (!response.ok) {
        throw new Error(`Failed to fetch note scores: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching scores for note ${noteId}:`, error);
      throw error;
    }
  }

  /**
   * 特定の試験の科目別点数を取得する
   * @param examId 試験ID
   * @returns 科目別点数のリスト (SubjectScore[])
   */
  async getSubjectScores(examId: number): Promise<SubjectScore[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${examId}/subject-scores`);

      if (!response.ok) {
        throw new Error(`Failed to fetch subject scores: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching subject scores for exam ${examId}:`, error);
      throw error;
    }
  }

  /**
   * 科目別点数を追加または更新する
   * @param examId 試験ID
   * @param data 点数データ (CreateSubjectScoreData)
   * @returns 追加または更新された点数 (SubjectScore)
   */
  async addOrUpdateSubjectScore(examId: number, data: CreateSubjectScoreData): Promise<SubjectScore> {
     // Ensure exam_id is included if needed by the API
     const payload = { ...data, exam_id: examId };

    try {
      const response = await fetch(`${this.apiBaseUrl}/${examId}/subject-scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload) // Send payload
      });

      if (!response.ok) {
        throw new Error(`Failed to add/update subject score: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error adding/updating subject score for exam ${examId}:`, error);
      throw error;
    }
  }

  /**
   * 科目別点数を一括で追加または更新する
   * @param examId 試験ID
   * @param scores 点数データの配列 (CreateSubjectScoreData[])
   * @returns 追加または更新された点数の配列 (SubjectScore[])
   */
  async batchAddOrUpdateSubjectScores(examId: number, scores: CreateSubjectScoreData[]): Promise<SubjectScore[]> {
    // Ensure exam_id is included for each score if needed by the API
    const payload = { scores: scores.map(s => ({ ...s, exam_id: examId })) };

    try {
      const response = await fetch(`${this.apiBaseUrl}/${examId}/subject-scores/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload) // Send payload
      });

      if (!response.ok) {
        throw new Error(`Failed to batch add/update subject scores: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error batch adding/updating subject scores for exam ${examId}:`, error);
      throw error;
    }
  }

  /**
   * 科目別点数を削除する
   * @param examId 試験ID
   * @param scoreId 点数ID
   * @returns 成功メッセージ
   */
  async deleteSubjectScore(examId: number, scoreId: number): Promise<{ message: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${examId}/subject-scores/${scoreId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to delete subject score: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error deleting subject score ${scoreId} from exam ${examId}:`, error);
      throw error;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const examService = new ExamService();

// クラスもエクスポートして、必要に応じてカスタム設定でインスタンス化できるようにする
export default ExamService;
