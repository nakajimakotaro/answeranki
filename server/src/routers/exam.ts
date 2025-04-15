import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, router } from '../trpc.js';
import { YankiConnect } from 'yanki-connect';
import { nanoid } from 'nanoid';
import { toStringAnkiQuery } from '../utils.js';
import {
  ExamSchema as BaseExamSchema,
  ExamScoreSchema,
  SubjectScoreSchema,
  ExamInputSchema,
  type Exam,
  type ExamScore,
  type SubjectScore,
} from '@answeranki/shared/types/exam';

const ankiConnect = new YankiConnect();

// Ankiノート情報を含むように拡張したExamSchema
const ExamSchema = BaseExamSchema.extend({
  anki_note_id: z.number().optional(),
});

// Ankiノート情報を含むExam型
type ExamWithAnkiNote = {
  id: string;
  name: string;
  date: Date;
  is_mock: boolean;
  exam_type: string;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
  exam_scores: ExamScore[];
  subject_scores: SubjectScore[];
  anki_note_id?: number;
};


const UpdateExamInputSchema = ExamInputSchema.extend({
  id: z.string(),
});

const UpsertExamScoreInputSchema = z.object({
    exam_id: z.string(),
    note_id: z.number().int(),
    descriptive_score: z.number().nullable().optional(),
    multiple_choice_score: z.number().nullable().optional(),
    total_score: z.number().nullable().optional(),
    max_score: z.number().nullable().optional(),
});

const UpsertSubjectScoreInputSchema = z.object({
    exam_id: z.string(),
    exam_type: z.string().min(1),
    subject: z.string().min(1),
    score: z.number().nullable().optional(),
    max_score: z.number().nullable().optional(),
});

// Define the missing schema for batch items
const BatchSubjectScoreItemSchema = z.object({
    exam_type: z.string().min(1),
    subject: z.string().min(1),
    score: z.number().nullable().optional(),
    max_score: z.number().nullable().optional(),
});

const BatchUpsertSubjectScoresInputSchema = z.object({
    examId: z.string(),
    scores: z.array(BatchSubjectScoreItemSchema), // Use the defined schema
});

// Keep only one definition of ExamScoreWithExamDetailsSchema
const ExamScoreWithExamDetailsSchema = ExamScoreSchema.extend({
  exam_name: z.string(),
  exam_date: z.date().nullable().optional(),
  is_mock: z.boolean(),
});


export const examRouter = router({

  getAll: publicProcedure
    .query(async () => {
      // Ankiから"Meta"デッキのノートを検索
      const noteIds = await ankiConnect.note.findNotes({
        query: 'deck:"Meta" tag:exam'
      });
      
      // 各ノートの詳細情報を取得
      const notesInfo = await ankiConnect.note.notesInfo({
        notes: noteIds
      });
      
      // ノート情報から試験データを抽出
      const exams = notesInfo.map(note => {
        // Infoフィールドから試験データを取得
        const examData = JSON.parse(note.fields.Info.value) as ExamWithAnkiNote;
        // Ankiノート情報を追加
        examData.anki_note_id = note.noteId;
        return examData;
      });
      
      // 日付でソート
      exams.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB.getTime() - dateA.getTime(); // 降順
      });
      
      return z.array(ExamSchema).parse(exams);
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      // Ankiからノート情報を取得
      const noteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:exam ${toStringAnkiQuery(`"id":"${input.id}"`)}`
      });
      
      if (noteIds.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Exam not found' });
      }
      
      // 最初のノートを使用
      const noteInfo = await ankiConnect.note.notesInfo({
        notes: [noteIds[0]]
      });
      
      const examData = JSON.parse(noteInfo[0].fields.Info.value) as ExamWithAnkiNote;
      // Ankiノート情報を追加
      examData.anki_note_id = noteInfo[0].noteId;
      
      return ExamSchema.parse(examData);
    }),

  create: publicProcedure
    .input(ExamInputSchema)
    .mutation(async ({ input }) => {
      const { name, date, is_mock, exam_type, notes } = input;
      
      // 試験データを作成
      const examData = {
        id: nanoid(),
        name,
        date,
        is_mock,
        exam_type,
        notes: notes,
        created_at: new Date(),
        updated_at: new Date(),
        exam_scores: [],
        subject_scores: []
      };
      
      // 試験データをJSON形式に変換
      const examJson = JSON.stringify(examData);
      
      // Ankiに保存
      const noteId = await ankiConnect.note.addNote({
        note: {
          deckName: "Meta",
          modelName: "MetaData",
          fields: {
            Info: examJson
          },
          tags: ["exam", exam_type]
        }
      });
      
      if (!noteId) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create exam in Anki'
        });
      }
      
      // Ankiノート情報を追加
      (examData as ExamWithAnkiNote).anki_note_id = noteId;
      
      return ExamSchema.parse(examData);
    }),

  update: publicProcedure
    .input(UpdateExamInputSchema)
    .mutation(async ({ input }) => {
      const { id, name, date, is_mock, exam_type, notes } = input;
      
      // Ankiからノート情報を取得
      const noteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:exam ${toStringAnkiQuery(`"id":"${id}"`)}`
      });
      
      if (noteIds.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Exam with ID ${id} not found in Anki`
        });
      }
      
      // 最初のノートを使用
      const noteId = noteIds[0];
      const noteInfo = await ankiConnect.note.notesInfo({
        notes: [noteId]
      });
      
      // 現在の試験データを取得
      const currentExamData = JSON.parse(noteInfo[0].fields.Info.value);
      
      // 更新する試験データを作成
      const updatedExamData = {
        ...currentExamData,
        name,
        date,
        is_mock,
        exam_type,
        notes: notes,
        updated_at: new Date()
      };
      
      // 試験データをJSON形式に変換
      const examJson = JSON.stringify(updatedExamData);
      
      // Ankiのノートを更新
      await ankiConnect.note.updateNoteFields({
        note: {
          id: noteId,
          fields: {
            Info: examJson
          }
        }
      });
      
      // タグを更新（試験タイプが変更された場合）
      if (exam_type !== currentExamData.exam_type) {
        const currentTags = noteInfo[0].tags.filter(tag => tag !== 'exam' && tag !== currentExamData.exam_type);
        await ankiConnect.note.updateNoteTags({
          note: noteId,
          tags: [...currentTags, 'exam', exam_type]
        });
      }
      
      // Ankiノート情報を追加
      (updatedExamData as ExamWithAnkiNote).anki_note_id = noteId;
      
      return ExamSchema.parse(updatedExamData);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const { id } = input;
      
      // Ankiからノート情報を取得
      const noteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:exam ${toStringAnkiQuery(`"id":"${id}"`)}`
      });
      
      if (noteIds.length > 0) {
        // ノートを削除
        await ankiConnect.note.deleteNotes({
          notes: noteIds
        });
      }
      
      return { success: true, message: 'Exam deleted successfully' };
    }),

  getScoresByExamId: publicProcedure
    .input(z.object({ examId: z.number().int() }))
    .query(async ({ input }) => {
      // Ankiからノート情報を取得
      const noteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:exam ${toStringAnkiQuery(`"id":"${input.examId}"`)}`
      });
      
      if (noteIds.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Exam with ID ${input.examId} not found in Anki`
        });
      }
      
      // 最初のノートを使用
      const noteInfo = await ankiConnect.note.notesInfo({
        notes: [noteIds[0]]
      });
      
      // 試験データを取得
      const examData = JSON.parse(noteInfo[0].fields.Info.value);
      
      // 試験スコアを返す
      return examData.exam_scores || [];
    }),

  upsertExamScore: publicProcedure
    .input(UpsertExamScoreInputSchema)
    .mutation(async ({ input }) => {
      const { exam_id, note_id, descriptive_score, multiple_choice_score, total_score, max_score } = input;
      
      // Ankiからノート情報を取得
      const noteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:exam ${toStringAnkiQuery(`"id":"${exam_id}"`)}`
      });
      
      if (noteIds.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Exam with ID ${exam_id} not found in Anki`
        });
      }
      
      // 最初のノートを使用
      const noteId = noteIds[0];
      const noteInfo = await ankiConnect.note.notesInfo({
        notes: [noteId]
      });
      
      // 試験データを取得
      const examData = JSON.parse(noteInfo[0].fields.Info.value);
      
      // 既存のスコアを検索
      const existingScoreIndex = examData.exam_scores?.findIndex(
        (score: ExamScore) => score.note_id === note_id
      ) ?? -1;
      
      // 新しいスコアデータを作成
      const scoreData: ExamScore = {
        id: existingScoreIndex >= 0 ? examData.exam_scores[existingScoreIndex].id : nanoid(),
        exam_id,
        note_id,
        descriptive_score: descriptive_score ?? null,
        multiple_choice_score: multiple_choice_score ?? null,
        total_score: total_score ?? null,
        max_score: max_score ?? null,
        created_at: existingScoreIndex >= 0 ? examData.exam_scores[existingScoreIndex].created_at : new Date(),
        updated_at: new Date()
      };
      
      // 試験データを更新
      if (existingScoreIndex >= 0) {
        examData.exam_scores[existingScoreIndex] = scoreData;
      } else {
        if (!examData.exam_scores) {
          examData.exam_scores = [];
        }
        examData.exam_scores.push(scoreData);
      }
      
      // 更新日時を更新
      examData.updated_at = new Date();
      
      // 試験データをJSON形式に変換
      const examJson = JSON.stringify(examData);
      
      // Ankiのノートを更新
      await ankiConnect.note.updateNoteFields({
        note: {
          id: noteId,
          fields: {
            Info: examJson
          }
        }
      });
      
      return ExamScoreSchema.parse(scoreData);
    }),

  deleteScore: publicProcedure
    .input(z.object({ scoreId: z.string() }))
    .mutation(async ({ input }) => {
      const { scoreId } = input;
      
      // すべての試験ノートを検索
      const noteIds = await ankiConnect.note.findNotes({
        query: 'deck:"Meta" tag:exam'
      });
      
      // 各ノートの詳細情報を取得
      const notesInfo = await ankiConnect.note.notesInfo({
        notes: noteIds
      });
      
      // スコアIDを持つノートを検索
      let foundExamData = null;
      let foundNoteId = null;
      let foundScoreIndex = -1;
      
      for (const note of notesInfo) {
        const examData = JSON.parse(note.fields.Info.value);
        const scoreIndex = examData.exam_scores?.findIndex(
          (score: ExamScore) => score.id === scoreId
        ) ?? -1;
        
        if (scoreIndex >= 0) {
          foundExamData = examData;
          foundNoteId = note.noteId;
          foundScoreIndex = scoreIndex;
          break;
        }
      }
      
      if (!foundExamData || foundNoteId === null || foundScoreIndex === -1) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Score with ID ${scoreId} not found`
        });
      }
      
      // スコアを削除
      foundExamData.exam_scores.splice(foundScoreIndex, 1);
      
      // 更新日時を更新
      foundExamData.updated_at = new Date();
      
      // 試験データをJSON形式に変換
      const examJson = JSON.stringify(foundExamData);
      
      // Ankiのノートを更新
      await ankiConnect.note.updateNoteFields({
        note: {
          id: foundNoteId,
          fields: {
            Info: examJson
          }
        }
      });
      
      return { success: true, message: 'Score deleted successfully' };
    }),

  getSubjectScoresByExamId: publicProcedure
    .input(z.object({ examId: z.string() }))
    .query(async ({ input }) => {
      // Ankiからノート情報を取得
      const noteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:exam ${toStringAnkiQuery(`"id":"${input.examId}"`)}`
      });
      
      if (noteIds.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Exam with ID ${input.examId} not found in Anki`
        });
      }
      
      // 最初のノートを使用
      const noteInfo = await ankiConnect.note.notesInfo({
        notes: [noteIds[0]]
      });
      
      // 試験データを取得
      const examData = JSON.parse(noteInfo[0].fields.Info.value);
      
      // 科目別スコアを返す
      return examData.subject_scores || [];
    }),

  upsertSubjectScore: publicProcedure
    .input(UpsertSubjectScoreInputSchema)
    .mutation(async ({ input }) => {
      const { exam_id, exam_type, subject, score, max_score } = input;
      
      // Ankiからノート情報を取得
      const noteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:exam ${toStringAnkiQuery(`"id":"${exam_id}"`)}`
      });
      
      if (noteIds.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Exam with ID ${exam_id} not found in Anki`
        });
      }
      
      // 最初のノートを使用
      const noteId = noteIds[0];
      const noteInfo = await ankiConnect.note.notesInfo({
        notes: [noteId]
      });
      
      // 試験データを取得
      const examData = JSON.parse(noteInfo[0].fields.Info.value);
      
      // 既存のスコアを検索
      const existingScoreIndex = examData.subject_scores?.findIndex(
        (score: SubjectScore) => score.exam_type === exam_type && score.subject === subject
      ) ?? -1;
      
      // 新しいスコアデータを作成
      const scoreData: SubjectScore = {
        id: existingScoreIndex >= 0 ? examData.subject_scores[existingScoreIndex].id : nanoid(),
        exam_id,
        exam_type,
        subject,
        score: score ?? null,
        max_score: max_score ?? null,
        created_at: existingScoreIndex >= 0 ? examData.subject_scores[existingScoreIndex].created_at : new Date(),
        updated_at: new Date()
      };
      
      // 試験データを更新
      if (existingScoreIndex >= 0) {
        examData.subject_scores[existingScoreIndex] = scoreData;
      } else {
        if (!examData.subject_scores) {
          examData.subject_scores = [];
        }
        examData.subject_scores.push(scoreData);
      }
      
      // 更新日時を更新
      examData.updated_at = new Date();
      
      // 試験データをJSON形式に変換
      const examJson = JSON.stringify(examData);
      
      // Ankiのノートを更新
      await ankiConnect.note.updateNoteFields({
        note: {
          id: noteId,
          fields: {
            Info: examJson
          }
        }
      });
      
      return SubjectScoreSchema.parse(scoreData);
    }),

  batchUpsertSubjectScores: publicProcedure
    .input(BatchUpsertSubjectScoresInputSchema)
    .mutation(async ({ input }) => {
      const { examId, scores } = input;
      
      // Ankiからノート情報を取得
      const noteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:exam ${toStringAnkiQuery(`"id":"${examId}"`)}`
      });
      
      if (noteIds.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Exam with ID ${examId} not found in Anki`
        });
      }
      
      // 最初のノートを使用
      const noteId = noteIds[0];
      const noteInfo = await ankiConnect.note.notesInfo({
        notes: [noteId]
      });
      
      // 試験データを取得
      const examData = JSON.parse(noteInfo[0].fields.Info.value);
      
      // 科目別スコアを更新
      const updatedScores: SubjectScore[] = [];
      
      for (const item of scores) {
        const { exam_type, subject, score, max_score } = item;
        
        // 既存のスコアを検索
        const existingScoreIndex = examData.subject_scores?.findIndex(
          (s: SubjectScore) => s.exam_type === exam_type && s.subject === subject
        ) ?? -1;
        
        // 新しいスコアデータを作成
        const scoreData: SubjectScore = {
          id: existingScoreIndex >= 0 ? examData.subject_scores[existingScoreIndex].id : nanoid(),
          exam_id: examId,
          exam_type,
          subject,
          score: score ?? null,
          max_score: max_score ?? null,
          created_at: existingScoreIndex >= 0 ? examData.subject_scores[existingScoreIndex].created_at : new Date(),
          updated_at: new Date()
        };
        
        // 試験データを更新
        if (existingScoreIndex >= 0) {
          examData.subject_scores[existingScoreIndex] = scoreData;
        } else {
          if (!examData.subject_scores) {
            examData.subject_scores = [];
          }
          examData.subject_scores.push(scoreData);
        }
        
        updatedScores.push(scoreData);
      }
      
      // 更新日時を更新
      examData.updated_at = new Date();
      
      // 試験データをJSON形式に変換
      const examJson = JSON.stringify(examData);
      
      // Ankiのノートを更新
      await ankiConnect.note.updateNoteFields({
        note: {
          id: noteId,
          fields: {
            Info: examJson
          }
        }
      });
      
      return updatedScores;
    }),

  deleteSubjectScore: publicProcedure
    .input(z.object({ scoreId: z.string() }))
    .mutation(async ({ input }) => {
      const { scoreId } = input;
      
      // すべての試験ノートを検索
      const noteIds = await ankiConnect.note.findNotes({
        query: 'deck:"Meta" tag:exam'
      });
      
      // 各ノートの詳細情報を取得
      const notesInfo = await ankiConnect.note.notesInfo({
        notes: noteIds
      });
      
      // スコアIDを持つノートを検索
      let foundExamData = null;
      let foundNoteId = null;
      let foundScoreIndex = -1;
      
      for (const note of notesInfo) {
        const examData = JSON.parse(note.fields.Info.value);
        const scoreIndex = examData.subject_scores?.findIndex(
          (score: SubjectScore) => score.id === scoreId
        ) ?? -1;
        
        if (scoreIndex >= 0) {
          foundExamData = examData;
          foundNoteId = note.noteId;
          foundScoreIndex = scoreIndex;
          break;
        }
      }
      
      if (!foundExamData || foundNoteId === null || foundScoreIndex === -1) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Subject score with ID ${scoreId} not found`
        });
      }
      
      // スコアを削除
      foundExamData.subject_scores.splice(foundScoreIndex, 1);
      
      // 更新日時を更新
      foundExamData.updated_at = new Date();
      
      // 試験データをJSON形式に変換
      const examJson = JSON.stringify(foundExamData);
      
      // Ankiのノートを更新
      await ankiConnect.note.updateNoteFields({
        note: {
          id: foundNoteId,
          fields: {
            Info: examJson
          }
        }
      });
      
      return { success: true, message: 'Subject score deleted successfully' };
    }),

  getScoresByNoteId: publicProcedure
    .input(z.object({ noteId: z.number().int() }))
    .query(async ({ input }) => {
      // すべての試験ノートを検索
      const noteIds = await ankiConnect.note.findNotes({
        query: 'deck:"Meta" tag:exam'
      });
      
      // 各ノートの詳細情報を取得
      const notesInfo = await ankiConnect.note.notesInfo({
        notes: noteIds
      });
      
      // 指定されたノートIDに関連するスコアを持つ試験を検索
      const matchingScores: ExamScore[] = [];
      
      for (const note of notesInfo) {
        const examData = JSON.parse(note.fields.Info.value);
        const scores = examData.exam_scores?.filter(
          (score: ExamScore) => score.note_id === input.noteId
        ) || [];
        
        // 各スコアに試験の詳細情報を追加
        scores.forEach((score: ExamScore) => {
          matchingScores.push({
            ...score,
            exam_name: examData.name,
            exam_date: examData.date,
            is_mock: examData.is_mock
          });
        });
      }
      
      // 日付でソート
      matchingScores.sort((a, b) => {
        const dateA = new Date(a.exam_date || 0);
        const dateB = new Date(b.exam_date || 0);
        return dateB.getTime() - dateA.getTime(); // 降順
      });
      
      return z.array(ExamScoreWithExamDetailsSchema).parse(matchingScores);
    }),

});

export type ExamRouter = typeof examRouter;
