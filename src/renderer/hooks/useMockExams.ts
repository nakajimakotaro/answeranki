import { useState, useCallback } from 'react';
import { 
  mockExamService, 
  MockExam, 
  MockExamScore, 
  SubjectScore,
  CreateMockExamData, 
  CreateMockExamScoreData,
  CreateSubjectScoreData,
  COMMON_TEST_SUBJECTS,
  SECONDARY_TEST_SUBJECTS
} from '../services/mockExamService';

/**
 * 模試と点数を管理するためのフック
 */
export function useMockExams() {
  const [mockExams, setMockExams] = useState<MockExam[]>([]);
  const [currentMockExam, setCurrentMockExam] = useState<MockExam | null>(null);
  const [mockExamScores, setMockExamScores] = useState<MockExamScore[]>([]);
  const [subjectScores, setSubjectScores] = useState<SubjectScore[]>([]);
  const [noteScores, setNoteScores] = useState<MockExamScore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * すべての模試を取得する
   */
  const fetchAllMockExams = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const exams = await mockExamService.getAllMockExams();
      setMockExams(exams);
      return exams;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('模試の取得に失敗しました'));
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 特定の模試を取得する
   * @param id 模試ID
   */
  const fetchMockExam = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const exam = await mockExamService.getMockExam(id);
      setCurrentMockExam(exam);
      return exam;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('模試の取得に失敗しました'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 新しい模試を作成する
   * @param data 模試データ
   */
  const createMockExam = useCallback(async (data: CreateMockExamData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const newExam = await mockExamService.createMockExam(data);
      setMockExams(prevExams => [...prevExams, newExam]);
      setCurrentMockExam(newExam);
      return newExam;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('模試の作成に失敗しました'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 模試を更新する
   * @param id 模試ID
   * @param data 更新データ
   */
  const updateMockExam = useCallback(async (id: number, data: CreateMockExamData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const updatedExam = await mockExamService.updateMockExam(id, data);
      
      // 模試リストを更新
      setMockExams(prevExams => 
        prevExams.map(exam => exam.id === id ? updatedExam : exam)
      );
      
      // 現在選択中の模試を更新
      if (currentMockExam && currentMockExam.id === id) {
        setCurrentMockExam(updatedExam);
      }
      
      return updatedExam;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('模試の更新に失敗しました'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentMockExam]);

  /**
   * 模試を削除する
   * @param id 模試ID
   */
  const deleteMockExam = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await mockExamService.deleteMockExam(id);
      
      // 模試リストから削除
      setMockExams(prevExams => prevExams.filter(exam => exam.id !== id));
      
      // 現在選択中の模試をクリア
      if (currentMockExam && currentMockExam.id === id) {
        setCurrentMockExam(null);
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('模試の削除に失敗しました'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentMockExam]);

  /**
   * 特定の模試の点数を取得する
   * @param mockExamId 模試ID
   */
  const fetchMockExamScores = useCallback(async (mockExamId: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const scores = await mockExamService.getMockExamScores(mockExamId);
      setMockExamScores(scores);
      return scores;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('模試の点数の取得に失敗しました'));
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 模試の点数を追加または更新する
   * @param mockExamId 模試ID
   * @param data 点数データ
   */
  const addOrUpdateScore = useCallback(async (mockExamId: number, data: CreateMockExamScoreData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const score = await mockExamService.addOrUpdateScore(mockExamId, data);
      
      // 点数リストを更新
      setMockExamScores(prevScores => {
        const index = prevScores.findIndex(s => s.id === score.id);
        
        if (index !== -1) {
          // 既存の点数を更新
          const newScores = [...prevScores];
          newScores[index] = score;
          return newScores;
        } else {
          // 新しい点数を追加
          return [...prevScores, score];
        }
      });
      
      return score;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('点数の追加/更新に失敗しました'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 模試の点数を削除する
   * @param mockExamId 模試ID
   * @param scoreId 点数ID
   */
  const deleteScore = useCallback(async (mockExamId: number, scoreId: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await mockExamService.deleteScore(mockExamId, scoreId);
      
      // 点数リストから削除
      setMockExamScores(prevScores => prevScores.filter(score => score.id !== scoreId));
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('点数の削除に失敗しました'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 特定のノートの模試点数を取得する
   * @param noteId ノートID
   */
  const fetchNoteScores = useCallback(async (noteId: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const scores = await mockExamService.getNoteScores(noteId);
      setNoteScores(scores);
      return scores;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('ノートの点数の取得に失敗しました'));
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * 特定の模試の科目別点数を取得する
   * @param mockExamId 模試ID
   */
  const fetchSubjectScores = useCallback(async (mockExamId: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const scores = await mockExamService.getSubjectScores(mockExamId);
      setSubjectScores(scores);
      return scores;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('科目別点数の取得に失敗しました'));
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * 科目別点数を追加または更新する
   * @param mockExamId 模試ID
   * @param data 点数データ
   */
  const addOrUpdateSubjectScore = useCallback(async (mockExamId: number, data: CreateSubjectScoreData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const score = await mockExamService.addOrUpdateSubjectScore(mockExamId, data);
      
      // 点数リストを更新
      setSubjectScores(prevScores => {
        const index = prevScores.findIndex(s => s.id === score.id);
        
        if (index !== -1) {
          // 既存の点数を更新
          const newScores = [...prevScores];
          newScores[index] = score;
          return newScores;
        } else {
          // 新しい点数を追加
          return [...prevScores, score];
        }
      });
      
      return score;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('科目別点数の追加/更新に失敗しました'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * 科目別点数を一括で追加または更新する
   * @param mockExamId 模試ID
   * @param scores 点数データの配列
   */
  const batchAddOrUpdateSubjectScores = useCallback(async (mockExamId: number, scores: CreateSubjectScoreData[]) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const updatedScores = await mockExamService.batchAddOrUpdateSubjectScores(mockExamId, scores);
      
      // 点数リストを更新
      setSubjectScores(prevScores => {
        const newScores = [...prevScores];
        
        updatedScores.forEach(updatedScore => {
          const index = newScores.findIndex(s => s.id === updatedScore.id);
          
          if (index !== -1) {
            // 既存の点数を更新
            newScores[index] = updatedScore;
          } else {
            // 新しい点数を追加
            newScores.push(updatedScore);
          }
        });
        
        return newScores;
      });
      
      return updatedScores;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('科目別点数の一括追加/更新に失敗しました'));
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * 科目別点数を削除する
   * @param mockExamId 模試ID
   * @param scoreId 点数ID
   */
  const deleteSubjectScore = useCallback(async (mockExamId: number, scoreId: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await mockExamService.deleteSubjectScore(mockExamId, scoreId);
      
      // 点数リストから削除
      setSubjectScores(prevScores => prevScores.filter(score => score.id !== scoreId));
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('科目別点数の削除に失敗しました'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * 科目別点数の合計を計算する
   * @param scores 科目別点数の配列
   */
  const calculateTotalScore = useCallback((scores: SubjectScore[]) => {
    return mockExamService.calculateTotalScore(scores);
  }, []);

  return {
    mockExams,
    currentMockExam,
    mockExamScores,
    subjectScores,
    noteScores,
    isLoading,
    error,
    fetchAllMockExams,
    fetchMockExam,
    createMockExam,
    updateMockExam,
    deleteMockExam,
    fetchMockExamScores,
    addOrUpdateScore,
    deleteScore,
    fetchNoteScores,
    fetchSubjectScores,
    addOrUpdateSubjectScore,
    batchAddOrUpdateSubjectScores,
    deleteSubjectScore,
    calculateTotalScore,
    COMMON_TEST_SUBJECTS,
    SECONDARY_TEST_SUBJECTS
  };
}
