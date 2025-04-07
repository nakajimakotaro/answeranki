import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, PrismaClient } from '@prisma/client'; // Import Prisma namespace and client for types
import { publicProcedure, router } from '../trpc.js';
import prisma from '../db/prisma.js'; // Use default import for Prisma Client instance
// Import shared types and schemas
import {
  ExamSchema,
  ExamScoreSchema,
  SubjectScoreSchema,
  type Exam,
  type ExamScore,
  type SubjectScore,
} from '@answeranki/shared/types/exam';

// --- Custom Error ---
class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

// Remove direct use of SharedExamSchema
// const ExamSchema = SharedExamSchema;

const CreateExamInputSchema = z.object({
  name: z.string().min(1, 'Exam name is required'),
  date: z.string().min(1, 'Exam date is required'), // Basic validation, refine if needed (e.g., regex)
  is_mock: z.boolean(),
  exam_type: z.string().min(1),
  university_id: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const UpdateExamInputSchema = CreateExamInputSchema.extend({
  id: z.number().int(), // Require ID for updates
});

// Remove direct use of SharedExamScoreSchema
// const ExamScoreSchema = SharedExamScoreSchema;

// Input for creating/updating (upserting) an exam score
const UpsertExamScoreInputSchema = z.object({
    exam_id: z.number().int(),
    note_id: z.number().int(),
    descriptive_score: z.number().nullable().optional(),
    multiple_choice_score: z.number().nullable().optional(),
    total_score: z.number().nullable().optional(),
    max_score: z.number().nullable().optional(),
});

// Remove direct use of SharedSubjectScoreSchema
// const SubjectScoreSchema = SharedSubjectScoreSchema;

// Input for creating/updating (upserting) a subject score
const UpsertSubjectScoreInputSchema = z.object({
    exam_id: z.number().int(),
    exam_type: z.string().min(1),
    subject: z.string().min(1),
    score: z.number().nullable().optional(),
    max_score: z.number().nullable().optional(),
});

// Input for batch upserting subject scores
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


// Helper type for joined data (e.g., scores with exam details)
// Use the imported ExamScoreSchema
const ExamScoreWithExamDetailsSchema = ExamScoreSchema.extend({
  exam_name: z.string(),
  exam_date: z.string(), // Keep as string for simplicity, or use z.date() if needed
  is_mock: z.boolean(),
});


export const examRouter = router({
  // --- Exam Procedures ---

  // Renamed to getAll to potentially align with client expectations (like UniversitiesPage)
  // --- Exam Procedures ---

  getAll: publicProcedure
    .query(async () => {
      try {
        const examsData = await prisma.exams.findMany({ // Corrected: exam -> exams
          orderBy: {
            date: 'desc', // Assuming 'date' field exists and is sortable
          },
        });
        // Validate output using the imported Zod schema
        // Prisma returns Date objects, Zod expects strings based on schema
        // We might need to adjust the Zod schema or format dates before validation/return
        // For now, let's assume the client handles Date objects or schema is adjusted
        return z.array(ExamSchema).parse(examsData);
      } catch (error) {
          console.error("Failed to retrieve exams:", error);
          // Handle potential Zod validation errors specifically
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

  // Renamed to getById
  getById: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      try {
        const examData = await prisma.exams.findUnique({ // Corrected: exam -> exams
          where: { id: input.id },
        });
        if (!examData) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Exam not found' });
        }
        // Validate output (consider date formatting if needed)
        return ExamSchema.parse(examData);
      } catch (error) {
          console.error(`Failed to retrieve exam ${input.id}:`, error);
          if (error instanceof TRPCError) throw error; // Re-throw specific TRPC errors
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

  // Renamed to create
  create: publicProcedure
    .input(CreateExamInputSchema)
    .mutation(async ({ input }) => {
      const { name, date, is_mock, exam_type, university_id, notes } = input;
      try {
        // Prisma handles date string conversion if the column type is DateTime
        const newExam = await prisma.exams.create({ // Corrected: exam -> exams
          data: {
            name,
            // Ensure 'date' field in schema.prisma is DateTime or String compatible
            // If it's String as shown, new Date() might not be needed or correct
            date: date, // Keep as string if schema field is String
            is_mock,
            exam_type,
            university_id: university_id ?? null,
            notes: notes ?? null,
          },
        });
        // Validate the returned exam (consider date formatting if needed)
        // If schema date is String, Zod validation should work directly
        return ExamSchema.parse(newExam);
      } catch (error) {
        console.error('Error creating exam:', error);
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

  // Renamed to update
  update: publicProcedure
    .input(UpdateExamInputSchema)
    .mutation(async ({ input }) => {
      const { id, name, date, is_mock, exam_type, university_id, notes } = input;
      try {
        // Prisma's update throws an error if the record is not found by default
        const updatedExam = await prisma.exams.update({ // Corrected: exam -> exams
          where: { id },
          data: {
            name,
            // Ensure 'date' field handling matches schema type (String)
            date: date, // Keep as string if schema field is String
            is_mock,
            exam_type,
            university_id: university_id ?? null,
            notes: notes ?? null,
          },
        });
        // Validate the returned exam (consider date formatting if needed)
        return ExamSchema.parse(updatedExam);
      } catch (error) {
        console.error(`Error updating exam ${id}:`, error); // Corrected log message context
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { // Add P2025 check
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

  // Renamed to update (This is the duplicated block to remove)
  // update: publicProcedure
  //   .input(UpdateExamInputSchema)
  //   .mutation(async ({ input }) => {
  //     const { id, name, date, is_mock, exam_type, university_id, notes } = input;
  //     try {
  //       // Prisma's update throws an error if the record is not found by default
  //       const updatedExam = await prisma.exam.update({ // This should be exams
  //         where: { id },
  //         data: {
            // name,
            // date: new Date(date), // Convert string date to Date object - Schema uses String
            // is_mock,
            // exam_type,
            // university_id: university_id ?? null,
            // notes: notes ?? null,
            // // updated_at is handled automatically by Prisma if @updatedAt is in schema
          // },
        // });
        // // Validate the returned exam (consider date formatting if needed)
        // return ExamSchema.parse(updatedExam);
      // } catch (error) {
        // console.error(`Error updating exam ${id}:`, error);
        // if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            // throw new TRPCError({ code: 'NOT_FOUND', message: 'Exam not found' });
        // }
        // if (error instanceof z.ZodError) {
             // throw new TRPCError({
                 // code: 'INTERNAL_SERVER_ERROR',
                 // message: 'Failed to validate updated exam data.',
                 // cause: error,
             // });
         // }
        // throw new TRPCError({
            // code: 'INTERNAL_SERVER_ERROR',
            // message: 'Failed to update exam.',
            // cause: error,
        // });
      // }
    // }),

  // Renamed to delete (Keep this block)
  delete: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const { id } = input;
      try {
        // Prisma's delete throws an error if the record is not found by default
        await prisma.exams.delete({ // Corrected: exam -> exams
          where: { id },
        });
        return { success: true, message: 'Exam deleted successfully' };
      } catch (error) {
          console.error(`Error deleting exam ${id}:`, error);
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
              throw new TRPCError({ code: 'NOT_FOUND', message: 'Exam not found' });
          }
          // Handle potential foreign key constraint errors if needed (e.g., P2003)
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to delete exam.',
              cause: error,
          });
      }
    }),

  // --- Exam Score Procedures ---

  getScoresByExamId: publicProcedure
    .input(z.object({ examId: z.number().int() }))
    .query(async ({ input }) => {
      try {
        const scoresData = await prisma.exam_scores.findMany({ // Corrected: examScore -> exam_scores
          where: { exam_id: input.examId },
        });
        return z.array(ExamScoreSchema).parse(scoresData); // Validate with Zod schema
      } catch (error) {
          console.error(`Failed to retrieve exam scores for exam ${input.examId}:`, error);
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

  // Upsert: Create or Update based on examId and noteId
  upsertExamScore: publicProcedure
    .input(UpsertExamScoreInputSchema)
    .mutation(async ({ input }) => {
      const { exam_id, note_id, descriptive_score, multiple_choice_score, total_score, max_score } = input;

      try {
        // Check if score exists since @@unique([exam_id, note_id]) is missing
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
                    // updated_at handled by Prisma
                },
            });
        } else {
            // Create new score
            // Need to ensure exam exists before creating
            savedScore = await prisma.exam_scores.create({
                data: {
                    exams: { connect: { id: exam_id } }, // Connect via relation
                    note_id: note_id,
                    descriptive_score: descriptive_score ?? null,
                    multiple_choice_score: multiple_choice_score ?? null,
                    total_score: total_score ?? null,
                    max_score: max_score ?? null,
                },
            });
        }
        return ExamScoreSchema.parse(savedScore); // Validate the returned score
      } catch (error) {
          console.error("Error during upsertExamScore:", error);
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
              // Handle potential foreign key constraint errors (e.g., exam_id doesn't exist)
              if (error.code === 'P2003' || error.code === 'P2025') { // P2025 for connect failure
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

  // Renamed to deleteScore
  deleteScore: publicProcedure
    .input(z.object({ scoreId: z.number().int() }))
    .mutation(async ({ input }) => {
      const { scoreId } = input;
      try {
        await prisma.exam_scores.delete({ // Corrected: examScore -> exam_scores
          where: { id: scoreId },
        });
        return { success: true, message: 'Score deleted successfully' };
      } catch (error) {
          console.error(`Error deleting exam score ${scoreId}:`, error);
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

  // --- Subject Score Procedures ---

  getSubjectScoresByExamId: publicProcedure
    .input(z.object({ examId: z.number().int() }))
    .query(async ({ input }) => {
      try {
        const scoresData = await prisma.subject_scores.findMany({ // Corrected: subjectScore -> subject_scores
          where: { exam_id: input.examId },
        });
        return z.array(SubjectScoreSchema).parse(scoresData); // Validate with Zod schema
      } catch (error) {
          console.error(`Failed to retrieve subject scores for exam ${input.examId}:`, error);
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

  // Upsert: Create or Update based on examId, exam_type, and subject
  upsertSubjectScore: publicProcedure
    .input(UpsertSubjectScoreInputSchema)
    .mutation(async ({ input }) => {
      const { exam_id, exam_type, subject, score, max_score } = input;
      try {
        const savedScore = await prisma.subject_scores.upsert({ // Corrected: subjectScore -> subject_scores
          where: {
            exam_id_exam_type_subject: { // Assumes @@unique([exam_id, exam_type, subject])
              exam_id: exam_id,
              exam_type: exam_type, // Removed note_id
              subject: subject,
            }
          },
          update: {
            score: score ?? null, // Corrected field names
            max_score: max_score ?? null, // Corrected field names
            // updated_at handled by Prisma
          },
          create: {
            // Need to connect to the related exam
            exams: { connect: { id: exam_id } }, // Connect via relation
            exam_type: exam_type,
            subject: subject,
            score: score ?? null, // Corrected field names
            max_score: max_score ?? null, // Corrected field names
          },
          // Removed duplicated update/create blocks and fixed syntax
        });
        return SubjectScoreSchema.parse(savedScore); // Validate the returned score
      } catch (error) {
          console.error("Error during upsertSubjectScore:", error);
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
              // Handle potential foreign key constraint errors (e.g., exam_id doesn't exist)
              if (error.code === 'P2003' || error.code === 'P2025') { // P2025 for connect failure
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

        // Check if exam exists first (outside transaction for efficiency if preferred)
        const examExists = await prisma.exams.findUnique({ where: { id: examId } }); // Corrected: exam -> exams
        if (!examExists) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Exam with ID ${examId} not found` });
        }

        try {
            // Use Prisma's interactive transactions
            // Add type: Prisma.TransactionClient
            const results = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                const upsertPromises = scores.map(item => {
                    const { exam_type, subject, score, max_score } = item;
                    return tx.subject_scores.upsert({ // Corrected: subjectScore -> subject_scores
                        where: {
                            exam_id_exam_type_subject: { // Assumes @@unique([exam_id, exam_type, subject])
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
                            // Need to connect to the related exam
                            exams: { connect: { id: examId } }, // Connect via relation
                            exam_type: exam_type,
                            subject: subject,
                            score: score ?? null,
                            max_score: max_score ?? null,
                        },
                    });
                });
                // Wait for all upserts within the transaction
                const savedScores = await Promise.all(upsertPromises);
                // Validate all results at once after the transaction completes successfully
                return z.array(SubjectScoreSchema).parse(savedScores);
            });
            return results; // Return the validated results
        } catch (error) {
            console.error('Error during batchUpsertSubjectScores transaction:', error);
            if (error instanceof z.ZodError) {
                // This might happen if validation fails after successful transaction
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Data validation failed after batch update: ${error.message}`, cause: error });
            }
            // Prisma transaction automatically rolls back on error
            // Handle specific Prisma errors like connect failures
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


  // Renamed to deleteSubjectScore
  deleteSubjectScore: publicProcedure
    .input(z.object({ scoreId: z.number().int() }))
    .mutation(async ({ input }) => {
      const { scoreId } = input;
      try {
        await prisma.subject_scores.delete({ // Corrected: subjectScore -> subject_scores
          where: { id: scoreId },
        });
        return { success: true, message: 'Subject score deleted successfully' };
      } catch (error) {
          console.error(`Error deleting subject score ${scoreId}:`, error);
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

  // --- Note-Related Procedures ---

  getScoresByNoteId: publicProcedure
    .input(z.object({ noteId: z.number().int() }))
    .query(async ({ input }) => {
      try {
        const scoresData = await prisma.exam_scores.findMany({ // Corrected: examScore -> exam_scores
          where: { note_id: input.noteId },
          include: {
            exams: { // Corrected: exam -> exams (relation name)
              select: {
                name: true,
                date: true,
                is_mock: true,
              }
            }
          },
          orderBy: {
            exams: { // Corrected: exam -> exams (relation name)
              date: 'desc',
            }
          }
        });

        // Define the type for the score object with included relation
        // Corrected: ExamScoreGetPayload -> exam_scoresGetPayload
        type ScoreWithExam = Prisma.exam_scoresGetPayload<{
            include: { exams: { select: { name: true, date: true, is_mock: true } } } // Corrected: exam -> exams
        }>;

        // Transform the data to match the expected ExamScoreWithExamDetailsSchema structure
        // Add type annotation for score parameter
        const transformedScores = scoresData.map((score: ScoreWithExam) => ({
          ...score,
          exam_name: score.exams.name, // Corrected: exam -> exams
          // Ensure date formatting matches Zod schema expectation (string)
          // Prisma returns string for 'date' field based on schema
          exam_date: score.exams.date, // Use string directly
          is_mock: score.exams.is_mock, // Corrected: exam -> exams
          // Remove the nested exam object if not part of the target schema
          // exams: undefined, // Or handle this transformation based on schema needs
        }));

        // Validate the transformed output
        return z.array(ExamScoreWithExamDetailsSchema).parse(transformedScores);
      } catch (error) {
          console.error(`Failed to retrieve scores for note ${input.noteId}:`, error);
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

// Export type definition of API
export type ExamRouter = typeof examRouter;
