import { useState, useCallback, useEffect } from 'react';
import { examService } from '../services/examService'; // Renamed service import
import { Exam, ExamScore, ExamInput, ExamScoreInput } from '../types/exam'; // Corrected import path

// Define the combined type for note-specific scores within the hook
interface NoteExamScoreData extends ExamScore {
  name: string; // Name from the related Exam object
  date: string; // Date from the related Exam object
}

/**
 * 試験データ（模試・本番）と関連する点数を管理するためのカスタムフック
 */
export const useExams = () => {
  const [exams, setExams] = useState<Exam[]>([]); // Renamed state variable, use Exam type
  const [examScores, setExamScores] = useState<Record<number, ExamScore[]>>({}); // Use ExamScore type
  // Use the combined type for noteExamScores state
  const [noteExamScores, setNoteExamScores] = useState<NoteExamScoreData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 試験リストを取得する関数 (APIから取得する想定)
  // Note: This function might need to be adapted based on how exams are actually fetched (e.g., from a timeline endpoint)
  const fetchExams = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch all exams using the service method
      const fetchedExams = await examService.getAllExams();
      setExams(fetchedExams);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch exams'));
      console.error('Error fetching exams:', err);
      setExams([]); // Set to empty array on error
    } finally {
      setIsLoading(false);
    }
  }, []); // Keep dependencies empty as it doesn't depend on component state/props

  // 特定の試験の点数を取得する関数
  const fetchExamScores = useCallback(async (examId: number) => { // Renamed parameter
    // Avoid refetching if already loading or data exists (optional optimization)
    // if (isLoading || examScores[examId]) return;

    setIsLoading(true);
    setError(null);
    try {
      const scores = await examService.getExamScores(examId); // Use renamed service method
      setExamScores(prev => ({ ...prev, [examId]: scores }));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch exam scores'));
      console.error(`Error fetching scores for exam ${examId}:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [/* isLoading, examScores */]); // Dependencies removed for simplicity, add back if optimization is used

  // 特定のノートに関連する試験点数を取得する関数
  const fetchNoteExamScores = useCallback(async (noteId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch the basic scores for the note
      const scoresData: ExamScore[] = await examService.getNoteScores(noteId);

      // 2. Combine with exam details (name, date) from the 'exams' state
      const combinedScores: NoteExamScoreData[] = scoresData.map(score => {
        const relatedExam = exams.find(exam => exam.id === score.exam_id);
        return {
          ...score,
          name: relatedExam?.name || '不明な試験', // Provide fallback name
          date: relatedExam?.date || '不明な日付'   // Provide fallback date
        };
      });

      setNoteExamScores(combinedScores); // Set the combined data
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch note exam scores'));
      console.error(`Error fetching scores for note ${noteId}:`, err);
      setNoteExamScores([]); // Clear scores on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 新しい試験を作成する関数
  const createExam = useCallback(async (data: ExamInput) => { // Renamed function, use ExamInput type
    setIsLoading(true);
    setError(null);
    try {
      const newExam = await examService.createExam(data); // Use renamed service method
      setExams(prev => [...prev, newExam]); // Add to local state
      // Optionally refetch all exams or rely on local update
      // await fetchExams();
      return newExam;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create exam'));
      console.error('Error creating exam:', err);
      throw err; // Re-throw to allow UI to handle error
    } finally {
      setIsLoading(false);
    }
  }, []); // Dependency removed

  // 試験を更新する関数
  const updateExam = useCallback(async (id: number, data: ExamInput) => { // Renamed function, use ExamInput type
    setIsLoading(true);
    setError(null);
    try {
      const updatedExamData = await examService.updateExam(id, data); // Use renamed service method
      setExams(prev => prev.map(exam => exam.id === id ? updatedExamData : exam));
      // Optionally refetch
      // await fetchExams();
      return updatedExamData;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update exam'));
      console.error(`Error updating exam ${id}:`, err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []); // Dependency removed

  // 試験を削除する関数
  const deleteExam = useCallback(async (id: number) => { // Renamed function
    setIsLoading(true);
    setError(null);
    try {
      await examService.deleteExam(id); // Use renamed service method
      setExams(prev => prev.filter(exam => exam.id !== id));
      // Remove scores for the deleted exam
      setExamScores(prev => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
      // Optionally refetch
      // await fetchExams();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete exam'));
      console.error(`Error deleting exam ${id}:`, err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []); // Dependency removed

  // 試験の点数を追加または更新する関数
  const addOrUpdateExamScore = useCallback(async (examId: number, data: ExamScoreInput) => { // Renamed function, use ExamScoreInput
    setIsLoading(true);
    setError(null);
    try {
      // The service method now likely handles adding exam_id to the payload
      const updatedScore = await examService.addOrUpdateExamScore(examId, data); // Use renamed service method
      // Update local scores state
      setExamScores(prev => {
        const scores = prev[examId] || [];
        const existingIndex = scores.findIndex(s => s.id === updatedScore.id);
        let newScores;
        if (existingIndex > -1) {
          newScores = [...scores];
          newScores[existingIndex] = updatedScore;
        } else {
          newScores = [...scores, updatedScore];
        }
        return { ...prev, [examId]: newScores };
      });
      return updatedScore;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to add or update exam score'));
      console.error(`Error adding/updating score for exam ${examId}:`, err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 試験の点数を削除する関数
  const deleteExamScore = useCallback(async (examId: number, scoreId: number) => { // Renamed function
    setIsLoading(true);
    setError(null);
    try {
      await examService.deleteExamScore(examId, scoreId); // Use renamed service method
      // Update local scores state
      setExamScores(prev => {
        const scores = prev[examId] || [];
        const newScores = scores.filter(s => s.id !== scoreId);
        return { ...prev, [examId]: newScores };
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete exam score'));
      console.error(`Error deleting score ${scoreId} for exam ${examId}:`, err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);


  // Initial fetch on component mount
  useEffect(() => {
    fetchExams(); // Call fetchExams to load initial data
  }, [fetchExams]); // Dependency array includes fetchExams

  return {
    exams,
    examScores,
    isLoading,
    error,
    fetchExams, // Export if needed externally
    fetchExamScores,
    noteExamScores, // Added export
    fetchNoteExamScores, // Added export
    createExam,
    updateExam,
    deleteExam,
    addOrUpdateExamScore, // Renamed export
    deleteExamScore      // Renamed export
  };
};
