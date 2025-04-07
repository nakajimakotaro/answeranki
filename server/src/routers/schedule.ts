import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, router } from '../trpc.js';
import prisma from '../db/prisma.js'; // Import Prisma Client
import { Prisma } from '@prisma/client'; // Import Prisma types
import {
  StudyScheduleInputSchema,
  StudyScheduleUpdateSchema,
  StudyScheduleSchema, // Expects string dates
  StudyLogInputSchema,
  StudyLogUpdateSchema,
  StudyLogSchema, // Expects string dates
  TimelineEventSchema, // Expects string dates
} from '@answeranki/shared/schemas/schedule';
// date-fns is only needed for getYearlyLogs now
import { startOfYear, endOfYear, format } from 'date-fns';

// Helper function to format Prisma schedule result to match StudyScheduleSchema input structure
// Prisma returns strings for date fields as defined in schema.prisma
const formatPrismaScheduleForZod = (
    schedule: Prisma.study_schedulesGetPayload<{ include: { textbooks: { select: { title: true, subject: true } } } }>
): z.input<typeof StudyScheduleSchema> => {
  const formatted = {
    id: schedule.id,
    textbook_id: schedule.textbook_id,
    start_date: schedule.start_date,
    end_date: schedule.end_date,
    daily_goal: schedule.daily_goal ?? undefined,
    buffer_days: schedule.buffer_days ?? StudyScheduleSchema.shape.buffer_days._def.defaultValue(),
    weekday_goals: schedule.weekday_goals ?? undefined,
    total_problems: schedule.total_problems ?? undefined,
    textbook_title: schedule.textbooks?.title ?? undefined, // Match optional Zod field
    textbook_subject: schedule.textbooks?.subject ?? undefined, // Match optional Zod field
    created_at: schedule.created_at?.toISOString(),
    updated_at: schedule.updated_at?.toISOString(),
  };
  // Remove undefined fields explicitly if Zod schema doesn't expect them
  Object.keys(formatted).forEach(key => (formatted as any)[key] === undefined && delete (formatted as any)[key]);
  return formatted;
};

// Helper function to format Prisma log result to match StudyLogSchema input structure
// Prisma returns strings for date fields as defined in schema.prisma
const formatPrismaLogForZod = (
    log: Prisma.study_logsGetPayload<{ include: { textbooks: { select: { title: true, subject: true } } } }>
): z.input<typeof StudyLogSchema> => {
   const formatted = {
    id: log.id,
    textbook_id: log.textbook_id,
    date: log.date, // Already a string
    planned_amount: log.planned_amount ?? StudyLogSchema.shape.planned_amount._def.defaultValue(),
    actual_amount: log.actual_amount ?? StudyLogSchema.shape.actual_amount._def.defaultValue(),
    notes: log.notes ?? undefined,
    textbook_title: log.textbooks?.title ?? undefined, // Match optional Zod field
    textbook_subject: log.textbooks?.subject ?? undefined, // Match optional Zod field
    created_at: log.created_at?.toISOString(),
    updated_at: log.updated_at?.toISOString(),
  };
  // Remove undefined fields explicitly
  Object.keys(formatted).forEach(key => (formatted as any)[key] === undefined && delete (formatted as any)[key]);
  return formatted;
};


export const scheduleRouter = router({
  // --- Study Schedule Procedures ---
  listSchedules: publicProcedure
    .output(z.array(StudyScheduleSchema))
    .query(async () => {
      try {
        const schedulesData = await prisma.study_schedules.findMany({
          include: { textbooks: { select: { title: true, subject: true } } },
          orderBy: { start_date: 'asc' }
        });
        const formattedSchedules = schedulesData.map(formatPrismaScheduleForZod);
        return StudyScheduleSchema.array().parse(formattedSchedules);
      } catch (error) {
        console.error("Error listing schedules:", error);
        if (error instanceof z.ZodError) console.error("Zod validation error (listSchedules):", error.errors);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to list schedules' });
      }
    }),

  createSchedule: publicProcedure
    .input(StudyScheduleInputSchema)
    .output(StudyScheduleSchema)
    .mutation(async ({ input }) => {
      try {
        // Prepare data for Prisma, dates are already strings
        const dataToCreate: Prisma.study_schedulesCreateInput = {
          textbooks: { connect: { id: input.textbook_id } },
          start_date: input.start_date, // Pass string directly
          end_date: input.end_date,     // Pass string directly
          daily_goal: input.daily_goal,
          buffer_days: input.buffer_days,
          weekday_goals: input.weekday_goals,
          total_problems: input.total_problems,
        };
        const newScheduleData = await prisma.study_schedules.create({
          data: dataToCreate,
          include: { textbooks: { select: { title: true, subject: true } } }
        });
        const formattedSchedule = formatPrismaScheduleForZod(newScheduleData);
        return StudyScheduleSchema.parse(formattedSchedule);
      } catch (error: any) {
        console.error("Error creating schedule:", error);
         if (error instanceof z.ZodError) {
             console.error("Zod validation error (createSchedule):", error.errors);
             throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Data validation failed after creation.' });
         }
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
             // Error details might indicate which foreign key failed
             throw new TRPCError({ code: 'NOT_FOUND', message: `Textbook with ID ${input.textbook_id} not found.` });
         }
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
             // Should not happen on create, but handle defensively
             throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Record creation failed unexpectedly.' });
         }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create schedule' });
      }
    }),

  updateSchedule: publicProcedure
    .input(StudyScheduleUpdateSchema)
    .output(StudyScheduleSchema)
    .mutation(async ({ input }) => {
      const { id, textbook_id, ...updateData } = input; // Separate textbook_id
      try {
         // Prepare data for Prisma update, dates are already strings
         const dataToUpdate: Prisma.study_schedulesUpdateInput = {
            ...updateData, // Includes start_date, end_date as strings if present
            // If textbook_id is provided in the input, use connect
            ...(textbook_id && { textbooks: { connect: { id: textbook_id } } }),
         };
         // textbook_id is already excluded from updateData due to destructuring

        const updatedScheduleData = await prisma.study_schedules.update({
          where: { id },
          data: dataToUpdate,
           include: { textbooks: { select: { title: true, subject: true } } }
        });
        const formattedSchedule = formatPrismaScheduleForZod(updatedScheduleData);
        return StudyScheduleSchema.parse(formattedSchedule);
      } catch (error: any) {
        console.error("Error updating schedule:", error);
         if (error instanceof z.ZodError) {
             console.error("Zod validation error (updateSchedule):", error.errors);
             throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Data validation failed after update.' });
         }
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
                throw new TRPCError({ code: 'NOT_FOUND', message: `Schedule with ID ${id} not found.` });
            }
             const textbookId = 'textbook_id' in updateData ? updateData.textbook_id : undefined;
             if (error.code === 'P2003' && textbookId !== undefined) {
                 throw new TRPCError({ code: 'NOT_FOUND', message: `Textbook with ID ${textbookId} not found.` });
            }
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update schedule' });
      }
    }),

  deleteSchedule: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
       try {
        await prisma.study_schedules.delete({
          where: { id: input.id },
        });
        return { success: true, message: 'Schedule deleted successfully' };
      } catch (error: any) {
         console.error("Error deleting schedule:", error);
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Schedule with ID ${input.id} not found.` });
         }
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
             throw new TRPCError({ code: 'CONFLICT', message: `Cannot delete schedule ${input.id} as it has related records (e.g., logs).` });
          }
         throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete schedule' });
      }
    }),

  // --- Study Log Procedures ---
  listLogs: publicProcedure
    .input(z.object({
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        textbook_id: z.number().int().positive().optional(),
    }).optional())
    .output(z.array(StudyLogSchema))
    .query(async ({ input }) => {
        try {
            const where: Prisma.study_logsWhereInput = {};
            // Prisma handles string date comparisons correctly
            if (input?.start_date || input?.end_date) {
                where.date = {};
                if (input.start_date) where.date.gte = input.start_date;
                if (input.end_date) where.date.lte = input.end_date;
            }
            if (input?.textbook_id) where.textbook_id = input.textbook_id;

            const logsData = await prisma.study_logs.findMany({
                where: where,
                include: { textbooks: { select: { title: true, subject: true } } },
                orderBy: { date: 'desc' }
            });
            const formattedLogs = logsData.map(formatPrismaLogForZod);
            return StudyLogSchema.array().parse(formattedLogs);
        } catch (error) {
             console.error("Error listing logs:", error);
             if (error instanceof z.ZodError) console.error("Zod validation error (listLogs):", error.errors);
             throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to list logs' });
        }
    }),

  createLog: publicProcedure
    .input(StudyLogInputSchema)
    .output(StudyLogSchema)
    .mutation(async ({ input }) => {
        try {
             // Prepare data for Prisma, date is already a string
             const dataToCreate: Prisma.study_logsCreateInput = {
                date: input.date, // Pass string directly
                textbooks: { connect: { id: input.textbook_id } },
                planned_amount: input.planned_amount,
                actual_amount: input.actual_amount,
                notes: input.notes,
            };
            const newLogData = await prisma.study_logs.create({
                data: dataToCreate,
                 include: { textbooks: { select: { title: true, subject: true } } }
            });
            const formattedLog = formatPrismaLogForZod(newLogData);
            return StudyLogSchema.parse(formattedLog);
        } catch (error: any) {
            console.error("Error creating log:", error);
             if (error instanceof z.ZodError) {
                 console.error("Zod validation error (createLog):", error.errors);
                 throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Data validation failed after creation.' });
             }
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                 if (error.code === 'P2002') { // Unique constraint (likely date+textbook_id if defined)
                     throw new TRPCError({ code: 'CONFLICT', message: 'A log already exists for this date and textbook' });
                 }
                 if (error.code === 'P2003') {
                     throw new TRPCError({ code: 'NOT_FOUND', message: `Textbook with ID ${input.textbook_id} not found.` });
                 }
            }
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create log' });
        }
    }),

  updateLog: publicProcedure
    .input(StudyLogUpdateSchema)
    .output(StudyLogSchema)
    .mutation(async ({ input }) => {
        const { id, textbook_id, ...updateData } = input; // Separate textbook_id
        try {
            // Prepare data for Prisma update, date is already a string
            const dataToUpdate: Prisma.study_logsUpdateInput = {
                ...updateData, // Includes date as string if present
                 // If textbook_id is provided in the input, use connect
                ...(textbook_id && { textbooks: { connect: { id: textbook_id } } }),
            };
            // textbook_id is already excluded from updateData

            const updatedLogData = await prisma.study_logs.update({
                where: { id },
                data: dataToUpdate,
                 include: { textbooks: { select: { title: true, subject: true } } }
            });
            const formattedLog = formatPrismaLogForZod(updatedLogData);
            return StudyLogSchema.parse(formattedLog);
        } catch (error: any) {
            console.error("Error updating log:", error);
             if (error instanceof z.ZodError) {
                 console.error("Zod validation error (updateLog):", error.errors);
                 throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Data validation failed after update.' });
             }
             if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    throw new TRPCError({ code: 'NOT_FOUND', message: `Log with ID ${id} not found.` });
                }
                 if (error.code === 'P2002') { // Unique constraint (date+textbook_id)
                     throw new TRPCError({ code: 'CONFLICT', message: 'Another log already exists for this date and textbook' });
                 }
                 const textbookId = 'textbook_id' in updateData ? updateData.textbook_id : undefined;
                 if (error.code === 'P2003' && textbookId !== undefined) {
                     throw new TRPCError({ code: 'NOT_FOUND', message: `Textbook with ID ${textbookId} not found.` });
                 }
            }
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update log' });
        }
    }),

  deleteLog: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
        try {
            await prisma.study_logs.delete({
                where: { id: input.id },
            });
            return { success: true, message: 'Log deleted successfully' };
        } catch (error: any) {
            console.error("Error deleting log:", error);
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new TRPCError({ code: 'NOT_FOUND', message: `Log with ID ${input.id} not found.` });
            }
            // Handle P2003 if needed
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete log' });
        }
    }),

  // --- Timeline Events Procedure ---
  getTimelineEvents: publicProcedure
    .input(z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).optional())
    .output(z.array(TimelineEventSchema))
    .query(async ({ input }) => {
        const events: z.input<typeof TimelineEventSchema>[] = [];
        // Use strings directly for Prisma comparison
        const startDate = input?.startDate;
        const endDate = input?.endDate;

        try {
            // Fetch schedules
            const scheduleWhere: Prisma.study_schedulesWhereInput = {};
            // Prisma handles string date comparisons
            if (startDate) scheduleWhere.end_date = { gte: startDate };
            if (endDate) scheduleWhere.start_date = { lte: endDate };
            const schedulesData = await prisma.study_schedules.findMany({
                where: scheduleWhere,
                include: { textbooks: { select: { title: true, subject: true } } },
                orderBy: { start_date: 'asc' },
            });
            schedulesData.forEach(s => {
                const formattedSchedule = formatPrismaScheduleForZod(s);
                events.push({
                    id: `schedule-${s.id}`,
                    type: 'schedule',
                    title: `${formattedSchedule.textbook_subject || 'N/A'}: ${formattedSchedule.textbook_title || 'N/A'}`,
                    startDate: formattedSchedule.start_date,
                    endDate: formattedSchedule.end_date,
                    details: formattedSchedule // Pass the object formatted for the shared schema
                });
            });

            // Fetch exams
            const examWhere: Prisma.examsWhereInput = {};
            // Prisma handles string date comparisons
            if (startDate || endDate) {
                examWhere.date = {};
                if (startDate) examWhere.date.gte = startDate;
                if (endDate) examWhere.date.lte = endDate;
            }
            const examsData = await prisma.exams.findMany({
                where: examWhere,
                include: {
                    universities: { select: { name: true } },
                    // Include related scores if needed by TimelineEventSchema.details
                    exam_scores: true, // Example: include scores
                    subject_scores: true // Example: include subject scores
                 },
                orderBy: { date: 'asc' },
            });
            examsData.forEach(e => {
                const formattedDate = e.date; // Already a string
                // Explicitly construct the details object based on TimelineEventSchema expectations
                const examDetails: any = { // Use 'any' for flexibility or define a specific interface
                    id: e.id,
                    name: e.name,
                    date: formattedDate,
                    is_mock: e.is_mock,
                    exam_type: e.exam_type,
                    notes: e.notes ?? undefined,
                    university_id: e.university_id ?? undefined,
                    university_name: e.universities?.name ?? undefined,
                    created_at: e.created_at?.toISOString(),
                    updated_at: e.updated_at?.toISOString(),
                    // Add score details if expected by the schema
                    // Example: Map exam_scores and subject_scores if needed
                    exam_scores: e.exam_scores.map(es => ({
                        ...es,
                        created_at: es.created_at?.toISOString(),
                        updated_at: es.updated_at?.toISOString(),
                    })),
                    subject_scores: e.subject_scores.map(ss => ({
                         ...ss,
                        created_at: ss.created_at?.toISOString(),
                        updated_at: ss.updated_at?.toISOString(),
                    })),
                };
                 // Remove undefined fields from details
                Object.keys(examDetails).forEach(key => examDetails[key] === undefined && delete examDetails[key]);

                events.push({
                    id: `exam-${e.id}`,
                    type: e.is_mock ? 'mock_exam' : 'exam',
                    title: e.is_mock ? e.name : (e.universities?.name ? `${e.universities.name} ${e.name}` : e.name),
                    startDate: formattedDate,
                    endDate: formattedDate,
                    details: examDetails // Pass the constructed details object
                });
            });

            // Sort events by start date (string comparison)
            events.sort((a, b) => {
                if (a.startDate < b.startDate) return -1;
                if (a.startDate > b.startDate) return 1;
                // Optional: secondary sort if start dates are equal
                // Handle potential undefined endDate
                const endDateA = a.endDate ?? '';
                const endDateB = b.endDate ?? '';
                if (endDateA < endDateB) return -1;
                if (endDateA > endDateB) return 1;
                return 0;
            });

            // Validate the final events array against the TimelineEventSchema
            return TimelineEventSchema.array().parse(events);

        } catch (error) {
            console.error("Error fetching timeline events:", error);
             if (error instanceof z.ZodError) {
                 console.error("Zod validation error (getTimelineEvents):", error.errors);
             }
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch timeline events' });
        }
    }),

  // --- Yearly Logs Procedure ---
  getYearlyLogs: publicProcedure
    .input(z.object({ year: z.number().int() }))
    .output(z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.number()))
    .query(async ({ input }) => {
      const { year } = input;
      // Use string representation for Prisma query
      const yearStartDateStr = `${year}-01-01`;
      const yearEndDateStr = `${year}-12-31`;

      try {
        const dailyLogs = await prisma.study_logs.groupBy({
          by: ['date'],
          where: {
            // Prisma handles string date comparisons
            date: { gte: yearStartDateStr, lte: yearEndDateStr },
          },
          _sum: { actual_amount: true },
          orderBy: { date: 'asc' },
        });

        // date from groupBy is already a string 'yyyy-MM-dd'
        const yearlyData = dailyLogs.reduce((acc, dayLog) => {
          // No need to format dayLog.date, it's already the string key we need
          acc[dayLog.date] = dayLog._sum?.actual_amount ?? 0;
          return acc;
        }, {} as Record<string, number>);

        return yearlyData;

      } catch (error: any) {
        console.error(`Error fetching yearly logs for ${year}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch yearly logs: ${error.message || 'Unknown error'}`,
        });
      }
    }),
});

export type ScheduleRouter = typeof scheduleRouter;
