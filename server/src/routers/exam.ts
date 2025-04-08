import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, PrismaClient } from '@prisma/client';
import { publicProcedure, router } from '../trpc.js';
import prisma from '../db/prisma.js';
import {
  ExamSchema,
  ExamScoreSchema,
  SubjectScoreSchema,
  ExamInputSchema,
  type Exam,
  type ExamScore,
  type SubjectScore,
} from '@answeranki/shared/types/exam';


const UpdateExamInputSchema = ExamInputSchema.extend({
  id: z.number().int(),
});

const UpsertExamScoreInputSchema = z.object({
    exam_id: z.number().int(),
    note_id: z.number().int(),
    descriptive_score: z.number().nullable().optional(),
    multiple_choice_score: z.number().nullable().optional(),
    total_score: z.number().nullable().optional(),
    max_score: z.number().nullable().optional(),
});

const UpsertSubjectScoreInputSchema = z.object({
    exam_id: z.number().int(),
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
    examId: z.number().int(),
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
      const examsData = await prisma.exams.findMany({
        orderBy: {
          date: 'desc',
        },
      });
      return z.array(ExamSchema).parse(examsData);
    }),

  getById: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const examData = await prisma.exams.findUnique({
        where: { id: input.id },
      });
      if (!examData) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Exam not found' });
      }
      return ExamSchema.parse(examData);
    }),

  create: publicProcedure
    .input(ExamInputSchema)
    .mutation(async ({ input }) => {
      const { name, date, is_mock, exam_type, university_id, notes } = input;
      const newExam = await prisma.exams.create({
        data: {
          name,
          date: date,
          is_mock,
          exam_type,
          university_id: university_id ?? null,
          notes: notes ?? null,
        },
      });
      return ExamSchema.parse(newExam);
    }),

  update: publicProcedure
    .input(UpdateExamInputSchema)
    .mutation(async ({ input }) => {
      const { id, name, date, is_mock, exam_type, university_id, notes } = input;
      const updatedExam = await prisma.exams.update({
        where: { id },
        data: {
            name,
            date: date,
            is_mock,
            exam_type,
            university_id: university_id ?? null,
            notes: notes ?? null,
          },
        });
      return ExamSchema.parse(updatedExam);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const { id } = input;
      await prisma.exams.delete({
        where: { id },
      });
      return { success: true, message: 'Exam deleted successfully' };
    }),

  getScoresByExamId: publicProcedure
    .input(z.object({ examId: z.number().int() }))
    .query(async ({ input }) => {
      const scoresData = await prisma.exam_scores.findMany({
        where: { exam_id: input.examId },
      });
      return z.array(ExamScoreSchema).parse(scoresData);
    }),

  upsertExamScore: publicProcedure
    .input(UpsertExamScoreInputSchema)
    .mutation(async ({ input }) => {
      const { exam_id, note_id, descriptive_score, multiple_choice_score, total_score, max_score } = input;

      const existingScore = await prisma.exam_scores.findFirst({
          where: {
                exam_id: exam_id,
                note_id: note_id,
            }
        });

        let savedScore;
        if (existingScore) {
            savedScore = await prisma.exam_scores.update({
                where: { id: existingScore.id },
                data: {
                    descriptive_score: descriptive_score ?? null,
                    multiple_choice_score: multiple_choice_score ?? null,
                    total_score: total_score ?? null,
                    max_score: max_score ?? null,
                },
            });
        } else {
            savedScore = await prisma.exam_scores.create({
                data: {
                    exams: { connect: { id: exam_id } },
                    note_id: note_id,
                    descriptive_score: descriptive_score ?? null,
                    multiple_choice_score: multiple_choice_score ?? null,
                    total_score: total_score ?? null,
                    max_score: max_score ?? null,
                },
            });
        }
      return ExamScoreSchema.parse(savedScore);
    }),

  deleteScore: publicProcedure
    .input(z.object({ scoreId: z.number().int() }))
    .mutation(async ({ input }) => {
      const { scoreId } = input;
      await prisma.exam_scores.delete({
        where: { id: scoreId },
      });
      return { success: true, message: 'Score deleted successfully' };
    }),

  getSubjectScoresByExamId: publicProcedure
    .input(z.object({ examId: z.number().int() }))
    .query(async ({ input }) => {
      const scoresData = await prisma.subject_scores.findMany({
        where: { exam_id: input.examId },
      });
      return z.array(SubjectScoreSchema).parse(scoresData);
    }),

  upsertSubjectScore: publicProcedure
    .input(UpsertSubjectScoreInputSchema)
    .mutation(async ({ input }) => {
      const { exam_id, exam_type, subject, score, max_score } = input;
      const savedScore = await prisma.subject_scores.upsert({
        where: {
          exam_id_exam_type_subject: {
              exam_id: exam_id,
              exam_type: exam_type,
              subject: subject,
            }
          },
          update: {
            score: score ?? null,
            max_score: max_score ?? null,
          },
          create: {
            exams: { connect: { id: exam_id } },
            exam_type: exam_type,
            subject: subject,
            score: score ?? null,
            max_score: max_score ?? null,
          },
        });
      return SubjectScoreSchema.parse(savedScore);
    }),

  batchUpsertSubjectScores: publicProcedure
    .input(BatchUpsertSubjectScoresInputSchema)
    .mutation(async ({ input }) => {
        const { examId, scores } = input;

        const examExists = await prisma.exams.findUnique({ where: { id: examId } });
        if (!examExists) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Exam with ID ${examId} not found` });
        }

        const results = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const upsertPromises = scores.map(item => {
                const { exam_type, subject, score, max_score } = item;
                    return tx.subject_scores.upsert({
                        where: {
                            exam_id_exam_type_subject: {
                                exam_id: examId,
                                exam_type: exam_type,
                                subject: subject,
                            }
                        },
                        update: {
                            score: score ?? null,
                            max_score: max_score ?? null,
                        },
                        create: {
                            exams: { connect: { id: examId } },
                            exam_type: exam_type,
                            subject: subject,
                            score: score ?? null,
                            max_score: max_score ?? null,
                        },
                    });
                });
                const savedScores = await Promise.all(upsertPromises);
            return z.array(SubjectScoreSchema).parse(savedScores);
        });
        return results;
    }),

  deleteSubjectScore: publicProcedure
    .input(z.object({ scoreId: z.number().int() }))
    .mutation(async ({ input }) => {
      const { scoreId } = input;
      await prisma.subject_scores.delete({
        where: { id: scoreId },
      });
      return { success: true, message: 'Subject score deleted successfully' };
    }),

  getScoresByNoteId: publicProcedure
    .input(z.object({ noteId: z.number().int() }))
    .query(async ({ input }) => {
      const scoresData = await prisma.exam_scores.findMany({
        where: { note_id: input.noteId },
        include: {
          exams: {
            select: {
              name: true,
              date: true,
              is_mock: true,
            }
          }
        },
        orderBy: {
          exams: {
            date: 'desc',
          }
        }
      });

      type ScoreWithExam = Prisma.exam_scoresGetPayload<{
          include: { exams: { select: { name: true, date: true, is_mock: true } } }
      }>;

      const transformedScores = scoresData.map((score: ScoreWithExam) => ({
        ...score,
        exam_name: score.exams.name,
        exam_date: score.exams.date,
        is_mock: score.exams.is_mock,
      }));

      return z.array(ExamScoreWithExamDetailsSchema).parse(transformedScores);
    }),

});

export type ExamRouter = typeof examRouter;
