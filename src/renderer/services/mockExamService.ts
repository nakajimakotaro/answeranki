/**
 * Mock Exam Service
 * 模試の管理と点数の記録を行うサービス
 */

// 模試データの型定義
export interface MockExam {
  id: number;
  name: string;
  date: string;
  exam_type: string; // 'multiple_choice' or 'descriptive'
  notes?: string;
  created_at: string;
  updated_at: string;
}

// 模試の点数データの型定義
export interface MockExamScore {
  id: number;
  mock_exam_id: number;
  note_id: number;
  descriptive_score?: number;
  multiple_choice_score?: number;
  total_score?: number;
  max_score?: number;
  created_at: string;
  updated_at: string;
  mock_exam_name?: string;
  mock_exam_date?: string;
}

// 科目別点数データの型定義
export interface SubjectScore {
  id: number;
  mock_exam_id: number;
  exam_type: string; // '共テ' or '二次試験'
  subject: string;
  score?: number;
  max_score?: number;
  created_at: string;
  updated_at: string;
}

// 新規模試作成用の型定義
export interface CreateMockExamData {
  name: string;
  date: string;
  exam_type: string;
  notes?: string;
}

// 模試点数登録用の型定義
export interface CreateMockExamScoreData {
  note_id: number;
  descriptive_score?: number;
  multiple_choice_score?: number;
  total_score?: number;
  max_score?: number;
}

// 科目別点数登録用の型定義
export interface CreateSubjectScoreData {
  exam_type: string;
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
  '情報'
];

// 二次試験の科目一覧
export const SECONDARY_TEST_SUBJECTS = [
  '国語',
  '英語',
  '化学',
  '物理',
  '数学'
];

/**
 * 模試サービスクラス
 */
class MockExamService {
  private apiBaseUrl = '/api/mock-exams';
  
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
   * すべての模試を取得する
   * @returns 模試のリスト
   */
  async getAllMockExams(): Promise<MockExam[]> {
    try {
      const response = await fetch(this.apiBaseUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch mock exams: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching mock exams:', error);
      throw error;
    }
  }

  /**
   * 特定の模試を取得する
   * @param id 模試ID
   * @returns 模試データ
   */
  async getMockExam(id: number): Promise<MockExam> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch mock exam: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching mock exam ${id}:`, error);
      throw error;
    }
  }

  /**
   * 新しい模試を作成する
   * @param data 模試データ
   * @returns 作成された模試
   */
  async createMockExam(data: CreateMockExamData): Promise<MockExam> {
    try {
      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create mock exam: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creating mock exam:', error);
      throw error;
    }
  }

  /**
   * 模試を更新する
   * @param id 模試ID
   * @param data 更新データ
   * @returns 更新された模試
   */
  async updateMockExam(id: number, data: CreateMockExamData): Promise<MockExam> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update mock exam: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error updating mock exam ${id}:`, error);
      throw error;
    }
  }

  /**
   * 模試を削除する
   * @param id 模試ID
   * @returns 成功メッセージ
   */
  async deleteMockExam(id: number): Promise<{ message: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete mock exam: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error deleting mock exam ${id}:`, error);
      throw error;
    }
  }

  /**
   * 特定の模試の点数を取得する
   * @param mockExamId 模試ID
   * @returns 点数のリスト
   */
  async getMockExamScores(mockExamId: number): Promise<MockExamScore[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${mockExamId}/scores`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch mock exam scores: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching scores for mock exam ${mockExamId}:`, error);
      throw error;
    }
  }

  /**
   * 模試の点数を追加または更新する
   * @param mockExamId 模試ID
   * @param data 点数データ
   * @returns 追加または更新された点数
   */
  async addOrUpdateScore(mockExamId: number, data: CreateMockExamScoreData): Promise<MockExamScore> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${mockExamId}/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add/update score: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error adding/updating score for mock exam ${mockExamId}:`, error);
      throw error;
    }
  }

  /**
   * 模試の点数を削除する
   * @param mockExamId 模試ID
   * @param scoreId 点数ID
   * @returns 成功メッセージ
   */
  async deleteScore(mockExamId: number, scoreId: number): Promise<{ message: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${mockExamId}/scores/${scoreId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete score: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error deleting score ${scoreId} from mock exam ${mockExamId}:`, error);
      throw error;
    }
  }

  /**
   * 特定のノートの模試点数を取得する
   * @param noteId ノートID
   * @returns 点数のリスト
   */
  async getNoteScores(noteId: number): Promise<MockExamScore[]> {
    try {
      const response = await fetch(`/api/notes/${noteId}/mock-exam-scores`);
      
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
   * 特定の模試の科目別点数を取得する
   * @param mockExamId 模試ID
   * @returns 科目別点数のリスト
   */
  async getSubjectScores(mockExamId: number): Promise<SubjectScore[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${mockExamId}/subject-scores`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch subject scores: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching subject scores for mock exam ${mockExamId}:`, error);
      throw error;
    }
  }
  
  /**
   * 科目別点数を追加または更新する
   * @param mockExamId 模試ID
   * @param data 点数データ
   * @returns 追加または更新された点数
   */
  async addOrUpdateSubjectScore(mockExamId: number, data: CreateSubjectScoreData): Promise<SubjectScore> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${mockExamId}/subject-scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add/update subject score: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error adding/updating subject score for mock exam ${mockExamId}:`, error);
      throw error;
    }
  }
  
  /**
   * 科目別点数を一括で追加または更新する
   * @param mockExamId 模試ID
   * @param scores 点数データの配列
   * @returns 追加または更新された点数の配列
   */
  async batchAddOrUpdateSubjectScores(mockExamId: number, scores: CreateSubjectScoreData[]): Promise<SubjectScore[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${mockExamId}/subject-scores/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ scores })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to batch add/update subject scores: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error batch adding/updating subject scores for mock exam ${mockExamId}:`, error);
      throw error;
    }
  }
  
  /**
   * 科目別点数を削除する
   * @param mockExamId 模試ID
   * @param scoreId 点数ID
   * @returns 成功メッセージ
   */
  async deleteSubjectScore(mockExamId: number, scoreId: number): Promise<{ message: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${mockExamId}/subject-scores/${scoreId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete subject score: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error deleting subject score ${scoreId} from mock exam ${mockExamId}:`, error);
      throw error;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const mockExamService = new MockExamService();

// クラスもエクスポートして、必要に応じてカスタム設定でインスタンス化できるようにする
export default MockExamService;
