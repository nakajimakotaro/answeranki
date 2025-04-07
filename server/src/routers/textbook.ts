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
  total_problems: z.number().int().min(0),
  anki_deck_name: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
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
    anki_deck_name: z.string(),
});

export const textbookRouter = router({
  // Get all textbooks
  getTextbooks: publicProcedure
    .query(async () => {
      const textbooks = await prisma.textbooks.findMany({
        orderBy: [
          { subject: 'asc' },
            { title: 'asc' },
          ],
        });
      return textbooks;
    }),

  // Create a new textbook
  createTextbook: publicProcedure
    .input(CreateTextbookInputSchema)
    .mutation(async ({ input }) => {
      const newTextbook = await prisma.textbooks.create({
        data: {
          ...input,
            anki_deck_name: input.anki_deck_name || null,
        },
      });
      return TextbookSchema.parse(newTextbook);
    }),

  // Update an existing textbook
  updateTextbook: publicProcedure
    .input(UpdateTextbookInputSchema)
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;
      const updatedTextbook = await prisma.textbooks.update({
        where: { id: id },
        data: {
            ...updateData,
            ...(updateData.anki_deck_name !== undefined && { anki_deck_name: updateData.anki_deck_name || null }),
        },
      });
      return TextbookSchema.parse(updatedTextbook);
    }),

  // Delete a textbook
  deleteTextbook: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const { id } = input;
      await prisma.textbooks.delete({
        where: { id: id },
      });
      return { success: true, message: 'Textbook deleted successfully' };
    }),

  linkAnkiDeck: publicProcedure
    .input(z.object({
      textbookId: z.number().int(),
      deckName: z.string().min(1, 'Deck name is required'),
    }))
    .mutation(async ({ input }) => {
      const { textbookId, deckName } = input;
      const updatedTextbook = await prisma.textbooks.update({
        where: { id: textbookId },
        data: { anki_deck_name: deckName },
      });
      return TextbookSchema.parse(updatedTextbook);
    }),

  // Get textbooks linked to Anki
  getAnkiLinkedTextbooks: publicProcedure
    .query(async () => {
      const linkedTextbooks = await prisma.textbooks.findMany({
        where: {
          anki_deck_name: {
              not: null,
            },
          },
          select: {
            id: true,
            title: true,
            anki_deck_name: true,
          },
        });
        const validatedData = linkedTextbooks.map(tb => ({
            ...tb,
            anki_deck_name: tb.anki_deck_name!,
        }));
      return z.array(AnkiLinkSchema).parse(validatedData);
    }),
});

export type TextbookRouter = typeof textbookRouter;
