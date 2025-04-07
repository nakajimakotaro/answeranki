import { z } from 'zod';
import { publicProcedure, router } from '../trpc.js';
import { getDbPool } from '../db/database.js'; // Changed to getDbPool
import { NotFoundError, BadRequestError } from '../middleware/errorHandler.js';
import { TRPCError } from '@trpc/server';

// Zod schema for Textbook (matches the structure in scheduleApi.ts and database)
const TextbookSchema = z.object({
  id: z.number().int(), // ID is present when fetching from DB
  title: z.string().min(1, 'Title is required'),
  subject: z.string().min(1, 'Subject is required'),
  total_problems: z.number().int().min(0).default(0), // Default to 0 if not provided
  anki_deck_name: z.string().nullable().optional(),
  // created_at and updated_at are handled by the database, not usually needed in input/output schemas unless explicitly required
});

// Input schema for creation (id is omitted)
const CreateTextbookInputSchema = TextbookSchema.omit({ id: true });

// Input schema for update (id is required)
const UpdateTextbookInputSchema = TextbookSchema.required({ id: true });

// Schema for the response of getAnkiLinkedTextbooks
const AnkiLinkSchema = z.object({
    id: z.number().int(),
    title: z.string(),
    anki_deck_name: z.string(), // This query ensures it's not null
});

export const textbookRouter = router({
  // Get all textbooks
  getTextbooks: publicProcedure
    .query(async () => {
      const pool = getDbPool(); // Changed to getDbPool
      try {
        // Use pool.query for PostgreSQL
        const result = await pool.query('SELECT * FROM textbooks ORDER BY subject, title');
        const textbooksData = result.rows;
        // Validate output against schema
        return z.array(TextbookSchema).parse(textbooksData);
      } catch (error) {
          console.error("Failed to parse textbooks data:", error);
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve textbooks due to data validation error.',
              cause: error,
          });
      }
    }),

  // Create a new textbook
  createTextbook: publicProcedure
    .input(CreateTextbookInputSchema)
    .mutation(async ({ input }) => {
      const { title, subject, total_problems, anki_deck_name } = input;
      const pool = getDbPool(); // Changed to getDbPool
      try {
        // Use pool.query and RETURNING *
        const result = await pool.query(
          'INSERT INTO textbooks (title, subject, total_problems, anki_deck_name) VALUES ($1, $2, $3, $4) RETURNING *',
          [title, subject, total_problems, anki_deck_name ?? null]
        );
        const newTextbook = result.rows[0];
        if (!newTextbook) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve newly created textbook' });
        }
        return TextbookSchema.parse(newTextbook); // Validate the newly created object
      } catch (error) {
        console.error('Error creating textbook:', error);
        // Check for specific DB errors like unique constraints if applicable
        // Example: if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') { ... }
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to create textbook: ${error instanceof Error ? error.message : 'Unknown error'}`,
            cause: error,
        });
      }
    }),

  // Update an existing textbook
  updateTextbook: publicProcedure
    .input(UpdateTextbookInputSchema)
    .mutation(async ({ input }) => {
      const { id, title, subject, total_problems, anki_deck_name } = input;
      const pool = getDbPool(); // Changed to getDbPool
      try {
          // Check if textbook exists
          const existingResult = await pool.query('SELECT id FROM textbooks WHERE id = $1', [id]);
          if (existingResult.rowCount === 0) {
            throw new NotFoundError('Textbook not found'); // Use custom error or TRPCError
          }
        // Use pool.query and RETURNING *
        const result = await pool.query(
          'UPDATE textbooks SET title = $1, subject = $2, total_problems = $3, anki_deck_name = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
          [title, subject, total_problems, anki_deck_name ?? null, id]
        );
        const updatedTextbook = result.rows[0];
        if (!updatedTextbook) {
           throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve updated textbook' });
        }
        return TextbookSchema.parse(updatedTextbook); // Validate the updated object
      } catch (error) {
        console.error(`Error updating textbook ${id}:`, error);
         throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to update textbook: ${error instanceof Error ? error.message : 'Unknown error'}`,
            cause: error,
        });
      }
    }),

  // Delete a textbook
  deleteTextbook: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const { id } = input;
      const pool = getDbPool(); // Changed to getDbPool
       // Check if textbook exists
       const existingResult = await pool.query('SELECT id FROM textbooks WHERE id = $1', [id]);
       if (existingResult.rowCount === 0) {
         throw new NotFoundError('Textbook not found');
       }
      // Consider implications: deleting a textbook might require deleting related schedules/logs
      // Depending on DB schema (ON DELETE CASCADE) or application logic.
      // Add checks or related deletions here if necessary.
      // Use pool.query for DELETE
      const result = await pool.query('DELETE FROM textbooks WHERE id = $1', [id]);
      if (result.rowCount === 0) { // Check rowCount
         throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete textbook despite finding it.' });
      }
      return { success: true, message: 'Textbook deleted successfully' };
    }),

  // Link textbook to Anki deck
  linkAnkiDeck: publicProcedure
    .input(z.object({
      textbookId: z.number().int(),
      deckName: z.string().min(1, 'Deck name is required'),
    }))
    .mutation(async ({ input }) => {
      const { textbookId, deckName } = input;
      const pool = getDbPool(); // Changed to getDbPool
      try {
          // Check if textbook exists
          const existingResult = await pool.query('SELECT id FROM textbooks WHERE id = $1', [textbookId]);
          if (existingResult.rowCount === 0) {
            throw new NotFoundError('Textbook not found');
          }
        // Use pool.query and RETURNING *
        const result = await pool.query(
          'UPDATE textbooks SET anki_deck_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
          [deckName, textbookId]
        );
        const updatedTextbook = result.rows[0];
        if (!updatedTextbook) {
           throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve updated textbook after linking' });
        }
        return TextbookSchema.parse(updatedTextbook); // Validate the result
      } catch (error) {
        console.error(`Error linking Anki deck for textbook ${textbookId}:`, error);
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to link Anki deck: ${error instanceof Error ? error.message : 'Unknown error'}`,
            cause: error,
        });
      }
    }),

  // Get textbooks linked to Anki
  getAnkiLinkedTextbooks: publicProcedure
    .query(async () => {
      const pool = getDbPool(); // Changed to getDbPool
       try {
        // Use pool.query for PostgreSQL
        const result = await pool.query(
          'SELECT id, title, anki_deck_name FROM textbooks WHERE anki_deck_name IS NOT NULL'
        );
        const textbooksData = result.rows;
        // Use the specific schema defined for this response
        return z.array(AnkiLinkSchema).parse(textbooksData);
      } catch (error) {
          console.error("Failed to parse Anki linked textbooks data:", error);
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve Anki linked textbooks due to data validation error.',
              cause: error,
          });
      }
    }),
});

// Export type definition of API
export type TextbookRouter = typeof textbookRouter;
