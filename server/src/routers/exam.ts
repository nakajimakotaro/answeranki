import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, PrismaClient } from '@prisma/client';
import { publicProcedure, router } from '../trpc.js';
import prisma from '../db/prisma.js';
import {
  ExamSchema,
  ExamScoreSchema,
  SubjectScoreSchema,
  type Exam,
  type ExamScore,
  type SubjectScore,
} from '@answeranki/shared/types/exam';

class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

const CreateExamInputSchema = z.object({
  name: z.string().min(1, 'Exam name is required'),
  date: z.string().min(1, 'Exam date is required'),
  is_mock: z.boolean(),
  exam_type: z.string().min(1),
  university_id: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const UpdateExamInputSchema = CreateExamInputSchema.extend({
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

const BatchSubjectScoreItemSchema = z.object({
    exam_type: z.string().min(1),
    subject: z.string().min(1),
    score: z.number().nullable().optional(),
    max_score: z.number().nullable().optional(),
});
const BatchUpsertSubjectScoresInputSchema = z.object({
    examId: z.number().int(),
    scores: z.array(BatchSubjectScoreItemSchema),
});

const ExamScoreWithExamDetailsSchema = ExamScoreSchema.extend({
  exam_name: z.string(),
  exam_date: z.string(),
  is_mock: z.boolean(),
});


export const examRouter = router({

  getAll: publicProcedure
    .query(async () => {
      try {
        const examsData = await prisma.exams.findMany({
          orderBy: {
            date: 'desc',
          },
        });
        return z.array(ExamSchema).parse(examsData);
      } catch (error) {
          if (error instanceof z.ZodError) {
             throw new TRPCError({
                 code: 'INTERNAL_SERVER_ERROR',
                 message: 'Failed to validate exam data.',
                 cause: error,
             });
          }
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve exams.',
              cause: error,
          });
      }
    }),

  getById: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      try {
        const examData = await prisma.exams.findUnique({
          where: { id: input.id },
        });
        if (!examData) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Exam not found' });
        }
        return ExamSchema.parse(examData);
      } catch (error) {
          if (error instanceof TRPCError) throw error;
          if (error instanceof z.ZodError) {
             throw new TRPCError({
                 code: 'INTERNAL_SERVER_ERROR',
                 message: 'Failed to validate exam data.',
                 cause: error,
             });
          }
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve exam.',
              cause: error,
          });
      }
    }),

  create: publicProcedure
    .input(CreateExamInputSchema)
    .mutation(async ({ input }) => {
      const { name, date, is_mock, exam_type, university_id, notes } = input;
      try {
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
      } catch (error) {
         if (error instanceof z.ZodError) {
             throw new TRPCError({
                 code: 'INTERNAL_SERVER_ERROR',
                 message: 'Failed to validate created exam data.',
                 cause: error,
             });
         }
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create exam.',
            cause: error,
        });
      }
    }),

  update: publicProcedure
    .input(UpdateExamInputSchema)
    .mutation(async ({ input }) => {
      const { id, name, date, is_mock, exam_type, university_id, notes } = input;
      try {
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
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Exam not found' });
        }
         if (error instanceof z.ZodError) {
             throw new TRPCError({
                 code: 'INTERNAL_SERVER_ERROR',
                 message: 'Failed to validate created exam data.',
                 cause: error,
             });
         }
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update exam.', // Corrected message context
            cause: error,
        });
      }
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const { id } = input;
      try {
        await prisma.exams.delete({
          where: { id },
        });
        return { success: true, message: 'Exam deleted successfully' };
      } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
              throw new TRPCError({ code: 'NOT_FOUND', message: 'Exam not found' });
          }
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to delete exam.',
              cause: error,
          });
      }
    }),

  getScoresByExamId: publicProcedure
    .input(z.object({ examId: z.number().int() }))
    .query(async ({ input }) => {
      try {
        const scoresData = await prisma.exam_scores.findMany({
          where: { exam_id: input.examId },
        });
        return z.array(ExamScoreSchema).parse(scoresData);
      } catch (error) {
          if (error instanceof z.ZodError) {
             throw new TRPCError({
                 code: 'INTERNAL_SERVER_ERROR',
                 message: 'Failed to validate exam score data.',
                 cause: error,
             });
          }
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve exam scores.',
              cause: error,
          });
      }
    }),

  upsertExamScore: publicProcedure
    .input(UpsertExamScoreInputSchema)
    .mutation(async ({ input }) => {
      const { exam_id, note_id, descriptive_score, multiple_choice_score, total_score, max_score } = input;

      try {
        const existingScore = await prisma.exam_scores.findFirst({
            where: {
                exam_id: exam_id,
                note_id: note_id,
            }
        });

        let savedScore;
        if (existingScore) {
            // Update existing score
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
      } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
              if (error.code === 'P2003' || error.code === 'P2025') {
                   throw new TRPCError({ code: 'NOT_FOUND', message: `Exam with ID ${exam_id} not found or related constraint failed.` });
              }
          }
          if (error instanceof z.ZodError) {
              throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Data validation failed for the saved exam score.', cause: error });
          }
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to save exam score.',
               cause: error,
           });
      }
    }),

  deleteScore: publicProcedure
    .input(z.object({ scoreId: z.number().int() }))
    .mutation(async ({ input }) => {
      const { scoreId } = input;
      try {
        await prisma.exam_scores.delete({
          where: { id: scoreId },
        });
        return { success: true, message: 'Score deleted successfully' };
      } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
              throw new TRPCError({ code: 'NOT_FOUND', message: 'Score not found' });
          }
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to delete score.',
              cause: error,
          });
      }
    }),

  getSubjectScoresByExamId: publicProcedure
    .input(z.object({ examId: z.number().int() }))
    .query(async ({ input }) => {
      try {
        const scoresData = await prisma.subject_scores.findMany({
          where: { exam_id: input.examId },
        });
        return z.array(SubjectScoreSchema).parse(scoresData);
      } catch (error) {
           if (error instanceof z.ZodError) {
               throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Data validation failed for subject scores.', cause: error });
           }
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve subject scores.',
              cause: error,
          });
      }
    }),

  upsertSubjectScore: publicProcedure
    .input(UpsertSubjectScoreInputSchema)
    .mutation(async ({ input }) => {
      const { exam_id, exam_type, subject, score, max_score } = input;
      try {
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
      } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
              if (error.code === 'P2003' || error.code === 'P2025') {
                   throw new TRPCError({ code: 'NOT_FOUND', message: `Exam with ID ${exam_id} not found or related constraint failed.` });
              }
          }
          if (error instanceof z.ZodError) {
              throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Data validation failed for the saved subject score.', cause: error });
          }
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to save subject score.',
               cause: error,
           });
       }
    }),

  batchUpsertSubjectScores: publicProcedure
    .input(BatchUpsertSubjectScoresInputSchema)
    .mutation(async ({ input }) => {
        const { examId, scores } = input;

        const examExists = await prisma.exams.findUnique({ where: { id: examId } });
        if (!examExists) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Exam with ID ${examId} not found` });
        }

        try {
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
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Data validation failed after batch update: ${error.message}`, cause: error });
            }
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                 throw new TRPCError({ code: 'NOT_FOUND', message: `One or more related exams not found during batch update.` });
            }
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Batch subject score update failed.',
                cause: error,
            });
        }
    }),

  deleteSubjectScore: publicProcedure
    .input(z.object({ scoreId: z.number().int() }))
    .mutation(async ({ input }) => {
      const { scoreId } = input;
      try {
        await prisma.subject_scores.delete({
          where: { id: scoreId },
        });
        return { success: true, message: 'Subject score deleted successfully' };
      } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
              throw new TRPCError({ code: 'NOT_FOUND', message: 'Subject score not found' });
          }
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to delete subject score.',
              cause: error,
          });
      }
    }),

  getScoresByNoteId: publicProcedure
    .input(z.object({ noteId: z.number().int() }))
    .query(async ({ input }) => {
      try {
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
      } catch (error) {
          if (error instanceof z.ZodError) {
              throw new TRPCError({
                  code: 'INTERNAL_SERVER_ERROR',
                  message: 'Failed to validate scores for note data.',
                  cause: error,
              });
          }
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve scores for note.',
              cause: error,
          });
      }
    }),

});

export type ExamRouter = typeof examRouter;
