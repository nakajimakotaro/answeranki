import { z } from 'zod';
import { publicProcedure, router } from '../trpc.js';
import prisma from '../db/prisma.js'; // Import Prisma Client
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client'; // Import Prisma types

// Zod schema for Textbook (align with Prisma model)
const TextbookSchema = z.object({
  id: z.number().int(),
  title: z.string().min(1, 'Title is required'),
  subject: z.string().min(1, 'Subject is required'),
  total_problems: z.number().int().min(0), // Removed default, Prisma handles defaults
  anki_deck_name: z.string().nullable(), // Allow null
  created_at: z.date(), // Prisma uses Date
  updated_at: z.date(), // Prisma uses Date
});

// Input schema for creation (omit auto-generated fields)
const CreateTextbookInputSchema = TextbookSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Input schema for update (require id, make others optional)
const UpdateTextbookInputSchema = z.object({
  id: z.number().int(),
  title: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  total_problems: z.number().int().min(0).optional(),
  anki_deck_name: z.string().nullable().optional(),
});

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
      try {
        const textbooks = await prisma.textbooks.findMany({
          orderBy: [
            { subject: 'asc' },
            { title: 'asc' },
          ],
        });
        // Prisma returns typed data, Zod parse might be redundant unless transforming
        return textbooks;
      } catch (error) {
          console.error("Failed to retrieve textbooks:", error);
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve textbooks.',
              cause: error,
          });
      }
    }),

  // Create a new textbook
  createTextbook: publicProcedure
    .input(CreateTextbookInputSchema)
    .mutation(async ({ input }) => {
      try {
        const newTextbook = await prisma.textbooks.create({
          data: {
            ...input,
            // Ensure nullable fields are explicitly null if undefined/empty string
            anki_deck_name: input.anki_deck_name || null,
          },
        });
        return TextbookSchema.parse(newTextbook); // Validate output
      } catch (error: any) {
        console.error('Error creating textbook:', error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
           throw new TRPCError({
              code: 'CONFLICT',
              message: `A textbook with the title "${input.title}" might already exist.`,
            });
        }
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create textbook',
            cause: error,
        });
      }
    }),

  // Update an existing textbook
  updateTextbook: publicProcedure
    .input(UpdateTextbookInputSchema)
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;
      try {
        const updatedTextbook = await prisma.textbooks.update({
          where: { id: id },
          data: {
            ...updateData,
            // Handle explicit null setting for nullable fields if needed
            ...(updateData.anki_deck_name !== undefined && { anki_deck_name: updateData.anki_deck_name || null }),
          },
        });
        return TextbookSchema.parse(updatedTextbook); // Validate output
      } catch (error: any) {
        console.error(`Error updating textbook ${id}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2025') {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Textbook with ID ${id} not found.` });
          }
          if (error.code === 'P2002') {
             throw new TRPCError({ code: 'CONFLICT', message: `Cannot update textbook: title "${updateData.title}" might already exist.` });
          }
        }
         throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update textbook',
            cause: error,
        });
      }
    }),

  // Delete a textbook
  deleteTextbook: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const { id } = input;
      try {
        // Prisma automatically handles cascading deletes if configured in the schema (ON DELETE CASCADE)
        await prisma.textbooks.delete({
          where: { id: id },
        });
        return { success: true, message: 'Textbook deleted successfully' };
      } catch (error: any) {
        console.error(`Error deleting textbook ${id}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2025') {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Textbook with ID ${id} not found.` });
          }
          // P2003 indicates a foreign key constraint failure (e.g., related study_schedules exist)
          if (error.code === 'P2003') {
             throw new TRPCError({ code: 'CONFLICT', message: `Cannot delete textbook ${id} as it has related records (e.g., schedules, logs).` });
          }
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete textbook', cause: error });
      }
    }),

  // Link textbook to Anki deck
  linkAnkiDeck: publicProcedure
    .input(z.object({
      textbookId: z.number().int(),
      deckName: z.string().min(1, 'Deck name is required'),
    }))
    .mutation(async ({ input }) => {
      const { textbookId, deckName } = input;
      try {
        const updatedTextbook = await prisma.textbooks.update({
          where: { id: textbookId },
          data: { anki_deck_name: deckName },
        });
        return TextbookSchema.parse(updatedTextbook); // Validate output
      } catch (error: any) {
        console.error(`Error linking Anki deck for textbook ${textbookId}:`, error);
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Textbook with ID ${textbookId} not found.` });
          }
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to link Anki deck',
            cause: error,
        });
      }
    }),

  // Get textbooks linked to Anki
  getAnkiLinkedTextbooks: publicProcedure
    .query(async () => {
       try {
        const linkedTextbooks = await prisma.textbooks.findMany({
          where: {
            anki_deck_name: {
              not: null, // Filter for non-null deck names
            },
          },
          select: { // Select only necessary fields
            id: true,
            title: true,
            anki_deck_name: true,
          },
        });
        // Ensure anki_deck_name is not null for the return type
        const validatedData = linkedTextbooks.map(tb => ({
            ...tb,
            anki_deck_name: tb.anki_deck_name!, // Assert non-null based on query
        }));
        return z.array(AnkiLinkSchema).parse(validatedData);
      } catch (error) {
          console.error("Failed to retrieve Anki linked textbooks:", error);
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve Anki linked textbooks.',
              cause: error,
          });
      }
    }),
});

// Export type definition of API
export type TextbookRouter = typeof textbookRouter;
