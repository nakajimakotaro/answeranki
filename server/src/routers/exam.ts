import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, router } from '../trpc.js';
import { getDbPool } from '../db/database.js'; // Changed to getDbPool
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
  getAll: publicProcedure
    .query(async () => {
      const pool = getDbPool(); // Changed to getDbPool
      try {
        // Use imported Exam type for DB query result
        // Use pool.query and $ placeholders for PostgreSQL
        const result = await pool.query<Exam>('SELECT * FROM exams ORDER BY date DESC');
        const examsData = result.rows;
        // Validate output using the imported Zod schema
        return z.array(ExamSchema).parse(examsData);
      } catch (error) {
          console.error("Failed to parse exams data:", error);
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve exams due to data validation error.',
              cause: error,
          });
      }
    }),

  // Renamed to getById
  getById: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const pool = getDbPool(); // Changed to getDbPool
      try {
        // Use imported Exam type
        const result = await pool.query<Exam>('SELECT * FROM exams WHERE id = $1', [input.id]);
        const examData = result.rows[0]; // Get the first row
        if (!examData) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Exam not found' }); // Use TRPCError
        }
        return ExamSchema.parse(examData); // Validate output
      } catch (error) {
          console.error("Failed to parse exam data:", error);
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve exam due to data validation error.',
              cause: error,
          });
      }
    }),

  // Renamed to create
  create: publicProcedure
    .input(CreateExamInputSchema) // Use specific input schema
    .mutation(async ({ input }) => {
      const { name, date, is_mock, exam_type, university_id, notes } = input;
      const pool = getDbPool(); // Changed to getDbPool
      try {
        // Use pool.query and RETURNING id for PostgreSQL
        const result = await pool.query(
          'INSERT INTO exams (name, date, is_mock, exam_type, university_id, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [name, date, is_mock, exam_type, university_id ?? null, notes ?? null]
        );
        const newExam = result.rows[0];
        if (!newExam) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve newly created exam.' });
        }
        return ExamSchema.parse(newExam); // Validate the returned exam
      } catch (error) {
        console.error('Error creating exam:', error);
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to create exam: ${error instanceof Error ? error.message : 'Unknown error'}`,
            cause: error,
        });
      }
    }),

  // Renamed to update
  update: publicProcedure
    .input(UpdateExamInputSchema) // Use specific input schema
    .mutation(async ({ input }) => {
      const { id, name, date, is_mock, exam_type, university_id, notes } = input;
      const pool = getDbPool(); // Changed to getDbPool
      try {
        // Check if exam exists first
        const existingResult = await pool.query('SELECT id FROM exams WHERE id = $1', [id]);
        if (existingResult.rowCount === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Exam not found' }); // Use TRPCError
        }

        // Use pool.query and RETURNING * for PostgreSQL
        const result = await pool.query(
          'UPDATE exams SET name = $1, date = $2, is_mock = $3, exam_type = $4, university_id = $5, notes = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
          [name, date, is_mock, exam_type, university_id ?? null, notes ?? null, id]
        );
        const updatedExam = result.rows[0];
        if (!updatedExam) {
           throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve updated exam.' });
        }
        return ExamSchema.parse(updatedExam); // Validate the returned exam
      } catch (error) {
        console.error(`Error updating exam ${id}:`, error);
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to update exam: ${error instanceof Error ? error.message : 'Unknown error'}`,
            cause: error,
        });
      }
    }),

  // Renamed to delete
  delete: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const { id } = input;
      const pool = getDbPool(); // Changed to getDbPool
      // Check if exam exists first (optional but good practice)
      const existingResult = await pool.query('SELECT id FROM exams WHERE id = $1', [id]);
      if (existingResult.rowCount === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Exam not found' }); // Use TRPCError
      }
      // Use pool.query for DELETE
      const result = await pool.query('DELETE FROM exams WHERE id = $1', [id]);
      if (result.rowCount === 0) { // Check rowCount for PostgreSQL
           throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete exam despite finding it.' });
      }
      return { success: true, message: 'Exam deleted successfully' };
    }),

  // --- Exam Score Procedures ---

  // Renamed to getScoresByExamId
  getScoresByExamId: publicProcedure
    .input(z.object({ examId: z.number().int() }))
    .query(async ({ input }) => {
      const pool = getDbPool(); // Changed to getDbPool
      try {
        // Use imported ExamScore type
        const result = await pool.query<ExamScore>('SELECT * FROM exam_scores WHERE exam_id = $1', [input.examId]);
        const scoresData = result.rows;
        return z.array(ExamScoreSchema).parse(scoresData); // Validate with Zod schema
      } catch (error) {
          console.error("Failed to parse exam scores data:", error);
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve exam scores due to data validation error.',
              cause: error,
          });
      }
    }),

  // Upsert: Create or Update based on examId and noteId
  upsertExamScore: publicProcedure
    .input(UpsertExamScoreInputSchema)
    .mutation(async ({ input }) => {
      const { exam_id, note_id, descriptive_score, multiple_choice_score, total_score, max_score } = input;
      const pool = getDbPool(); // Changed to getDbPool

      // Check if exam exists
      const examExistsResult = await pool.query('SELECT id FROM exams WHERE id = $1', [exam_id]);
      if (examExistsResult.rowCount === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Exam with ID ${exam_id} not found` }); // Use TRPCError
      }

      // Check if score exists
      const existingScoreResult = await pool.query<ExamScore>(
        'SELECT id FROM exam_scores WHERE exam_id = $1 AND note_id = $2',
        [exam_id, note_id]
      );
      const existingScore = existingScoreResult.rows[0];

      let savedScore;
      try {
          if (existingScore) {
            // Update existing score
            const updateResult = await pool.query(
              'UPDATE exam_scores SET descriptive_score = $1, multiple_choice_score = $2, total_score = $3, max_score = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
              [descriptive_score ?? null, multiple_choice_score ?? null, total_score ?? null, max_score ?? null, existingScore.id]
            );
            savedScore = updateResult.rows[0];
          } else {
            // Insert new score
            const insertResult = await pool.query(
              'INSERT INTO exam_scores (exam_id, note_id, descriptive_score, multiple_choice_score, total_score, max_score) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
              [exam_id, note_id, descriptive_score ?? null, multiple_choice_score ?? null, total_score ?? null, max_score ?? null]
            );
            savedScore = insertResult.rows[0];
          }

          if (!savedScore) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve the saved exam score.' });
          }
          return ExamScoreSchema.parse(savedScore); // Validate the returned score
      } catch (error) {
          console.error("Error during upsertExamScore:", error);
           if (error instanceof z.ZodError) {
               throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Data validation failed for the saved exam score.', cause: error });
           }
           throw new TRPCError({
               code: 'INTERNAL_SERVER_ERROR',
               message: `Failed to save exam score: ${error instanceof Error ? error.message : 'Unknown error'}`,
               cause: error,
           });
      }
    }),

  // Renamed to deleteScore
  deleteScore: publicProcedure
    .input(z.object({ scoreId: z.number().int() }))
    .mutation(async ({ input }) => {
      const { scoreId } = input;
      const pool = getDbPool(); // Changed to getDbPool
       // Check if score exists first (optional)
       const existingResult = await pool.query('SELECT id FROM exam_scores WHERE id = $1', [scoreId]);
       if (existingResult.rowCount === 0) {
         throw new TRPCError({ code: 'NOT_FOUND', message: 'Score not found' }); // Use TRPCError
       }
      // Use pool.query for DELETE
      const result = await pool.query('DELETE FROM exam_scores WHERE id = $1', [scoreId]);
      if (result.rowCount === 0) { // Check rowCount
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete score despite finding it.' });
      }
      return { success: true, message: 'Score deleted successfully' };
    }),

  // --- Subject Score Procedures ---

  // Renamed to getSubjectScoresByExamId
  getSubjectScoresByExamId: publicProcedure
    .input(z.object({ examId: z.number().int() }))
    .query(async ({ input }) => {
      const pool = getDbPool(); // Changed to getDbPool
      try {
        // Use imported SubjectScore type
        const result = await pool.query<SubjectScore>('SELECT * FROM subject_scores WHERE exam_id = $1', [input.examId]);
        const scoresData = result.rows;
        return z.array(SubjectScoreSchema).parse(scoresData); // Validate with Zod schema
      } catch (error) {
          console.error("Failed to parse subject scores data:", error);
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve subject scores due to data validation error.',
              cause: error,
          });
      }
    }),

  // Upsert: Create or Update based on examId, exam_type, and subject
  upsertSubjectScore: publicProcedure
    .input(UpsertSubjectScoreInputSchema)
    .mutation(async ({ input }) => {
      const { exam_id, exam_type, subject, score, max_score } = input;
      const pool = getDbPool(); // Changed to getDbPool

      // Check if exam exists
      const examExistsResult = await pool.query('SELECT id FROM exams WHERE id = $1', [exam_id]);
      if (examExistsResult.rowCount === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Exam with ID ${exam_id} not found` }); // Use TRPCError
      }

      // Check if subject score exists
      const existingScoreResult = await pool.query<SubjectScore>(
        'SELECT id FROM subject_scores WHERE exam_id = $1 AND exam_type = $2 AND subject = $3',
        [exam_id, exam_type, subject]
      );
      const existingScore = existingScoreResult.rows[0];

      let savedScore;
       try {
          if (existingScore) {
            // Update existing subject score
            const updateResult = await pool.query(
              'UPDATE subject_scores SET score = $1, max_score = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
              [score ?? null, max_score ?? null, existingScore.id]
            );
            savedScore = updateResult.rows[0];
          } else {
            // Insert new subject score
            const insertResult = await pool.query(
              'INSERT INTO subject_scores (exam_id, exam_type, subject, score, max_score) VALUES ($1, $2, $3, $4, $5) RETURNING *',
              [exam_id, exam_type, subject, score ?? null, max_score ?? null]
            );
            savedScore = insertResult.rows[0];
          }

          if (!savedScore) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve the saved subject score.' });
          }
          return SubjectScoreSchema.parse(savedScore); // Validate the returned score
       } catch (error) {
           console.error("Error during upsertSubjectScore:", error);
           if (error instanceof z.ZodError) {
               throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Data validation failed for the saved subject score.', cause: error });
           }
           throw new TRPCError({
               code: 'INTERNAL_SERVER_ERROR',
               message: `Failed to save subject score: ${error instanceof Error ? error.message : 'Unknown error'}`,
               cause: error,
           });
       }
    }),

  batchUpsertSubjectScores: publicProcedure
    .input(BatchUpsertSubjectScoresInputSchema)
    .mutation(async ({ input }) => {
        const { examId, scores } = input;
        const pool = getDbPool(); // Changed to getDbPool
        const client = await pool.connect(); // Get a client for transaction

        // Check if exam exists
        const examExistsResult = await client.query('SELECT id FROM exams WHERE id = $1', [examId]);
        if (examExistsResult.rowCount === 0) {
            client.release();
            throw new TRPCError({ code: 'NOT_FOUND', message: `Exam with ID ${examId} not found` }); // Use TRPCError
        }

        try {
            await client.query('BEGIN'); // Start transaction

            // Use imported SubjectScore type
            const results: SubjectScore[] = [];
            // Add type annotation for item
            for (const item of scores) {
                const { exam_type, subject, score, max_score } = item;

                // Check if subject score exists
                const existingScoreResult = await client.query<SubjectScore>(
                    'SELECT id FROM subject_scores WHERE exam_id = $1 AND exam_type = $2 AND subject = $3',
                    [examId, exam_type, subject]
                );
                const existingScore = existingScoreResult.rows[0];

                let savedScoreData;
                if (existingScore) {
                    // Update existing subject score
                    const updateResult = await client.query(
                        'UPDATE subject_scores SET score = $1, max_score = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
                        [score ?? null, max_score ?? null, existingScore.id]
                    );
                    savedScoreData = updateResult.rows[0];
                } else {
                    // Insert new subject score
                    const insertResult = await client.query(
                        'INSERT INTO subject_scores (exam_id, exam_type, subject, score, max_score) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                        [examId, exam_type, subject, score ?? null, max_score ?? null]
                    );
                    savedScoreData = insertResult.rows[0];
                }
                if (!savedScoreData) {
                    // This should ideally not happen if RETURNING * is used correctly
                    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to retrieve saved score for subject ${subject}` });
                }
                // Validate each saved score before adding to results
                results.push(SubjectScoreSchema.parse(savedScoreData)); // Parse with Zod schema
            }

            await client.query('COMMIT'); // Commit transaction
            return results;
        } catch(error) {
            console.error('Rolling back transaction due to error during batch update:', error);
            await client.query('ROLLBACK'); // Rollback transaction on error
             if (error instanceof z.ZodError) {
                 // This case might be hit if parse fails within the loop.
                 throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Data validation failed during batch update: ${error.message}`, cause: error });
             }
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Batch subject score update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                cause: error,
            });
        }
    }),


  // Renamed to deleteSubjectScore
  deleteSubjectScore: publicProcedure // Keep original name if preferred
    .input(z.object({ scoreId: z.number().int() }))
    .mutation(async ({ input }) => {
      const { scoreId } = input;
      const pool = getDbPool(); // Changed to getDbPool
       // Check if score exists first (optional)
       const existingResult = await pool.query('SELECT id FROM subject_scores WHERE id = $1', [scoreId]);
       if (existingResult.rowCount === 0) {
         throw new TRPCError({ code: 'NOT_FOUND', message: 'Subject score not found' }); // Use TRPCError
       }
      // Use pool.query for DELETE
      const result = await pool.query('DELETE FROM subject_scores WHERE id = $1', [scoreId]);
      if (result.rowCount === 0) { // Check rowCount
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete subject score despite finding it.' });
      }
      return { success: true, message: 'Subject score deleted successfully' };
    }),

  // --- Note-Related Procedures ---

  // Renamed to getScoresByNoteId
  getScoresByNoteId: publicProcedure
    .input(z.object({ noteId: z.number().int() }))
    .query(async ({ input }) => {
      const pool = getDbPool(); // Changed to getDbPool
      // Define the expected shape of the joined data for type safety
      // Use imported ExamScore as base
      interface ScoreWithExamDetails extends ExamScore {
          exam_name: string;
          exam_date: string;
          is_mock: boolean; // PostgreSQL BOOLEAN is directly usable
      }
      try {
        const result = await pool.query<ScoreWithExamDetails>(`
          SELECT es.*, e.name as exam_name, e.date as exam_date, e.is_mock
          FROM exam_scores es
          JOIN exams e ON es.exam_id = e.id
          WHERE es.note_id = $1
          ORDER BY e.date DESC
        `, [input.noteId]);
        const scoresData = result.rows;
        // Validate the output against the extended schema
        // No need for manual boolean conversion for PostgreSQL BOOLEAN type
        return z.array(ExamScoreWithExamDetailsSchema).parse(scoresData);
      } catch (error) {
          console.error("Failed to parse scores for note data:", error);
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve scores for note due to data validation error.',
              cause: error,
          });
      }
    }),

});

// Export type definition of API
export type ExamRouter = typeof examRouter;
