import { z } from 'zod';
import { publicProcedure, router } from '../trpc.js';
import prisma from '../db/prisma.js';
import { Prisma } from '@prisma/client';
import {
  StudyScheduleInputSchema,
  StudyScheduleUpdateSchema,
  StudyScheduleSchema,
  StudyLogInputSchema,
  StudyLogUpdateSchema,
  StudyLogSchema,
  TimelineEventSchema,
  YearlyLogSchema,
} from '@answeranki/shared/schemas/schedule';

type ExamDetails = {
  id: number;
  name: string;
  date: Date;
  is_mock: boolean;
  exam_type: string;
  notes?: string | null;
  university_id?: number | null;
  university_name?: string | null;
  created_at?: Date | null;
  updated_at?: Date | null;
  exam_scores: any[];
  subject_scores: any[];
};


export const scheduleRouter = router({
  listSchedules: publicProcedure
    .output(z.array(StudyScheduleSchema))
    .query(async () => {
      const schedulesData = await prisma.study_schedules.findMany({
        include: { textbooks: { select: { title: true, subject: true } } },
        orderBy: { start_date: 'asc' }
      });
      return StudyScheduleSchema.array().parse(schedulesData);
    }),

  createSchedule: publicProcedure
    .input(StudyScheduleInputSchema)
    .output(StudyScheduleSchema)
    .mutation(async ({ input }) => {
      // Input dates are now Date objects from z.coerce.date()
      const dataToCreate: Prisma.study_schedulesCreateInput = {
        textbooks: { connect: { id: input.textbook_id } },
          start_date: input.start_date, // Pass Date object
          end_date: input.end_date,     // Pass Date object
          daily_goal: input.daily_goal,
          buffer_days: input.buffer_days,
          weekday_goals: input.weekday_goals,
          total_problems: input.total_problems,
        };
        const newScheduleData = await prisma.study_schedules.create({
          data: dataToCreate,
          include: { textbooks: { select: { title: true, subject: true } } }
      });
      return StudyScheduleSchema.parse(newScheduleData);
    }),

  updateSchedule: publicProcedure
    .input(StudyScheduleUpdateSchema)
    .output(StudyScheduleSchema)
    .mutation(async ({ input }) => {
      const { id, textbook_id, ...updateData } = input; // updateData contains Date objects
      const dataToUpdate: Prisma.study_schedulesUpdateInput = {
          ...updateData, // Spread Date objects directly
            ...(textbook_id && { textbooks: { connect: { id: textbook_id } } }),
         };

        const updatedScheduleData = await prisma.study_schedules.update({
          where: { id },
          data: dataToUpdate,
           include: { textbooks: { select: { title: true, subject: true } } }
      });
      return StudyScheduleSchema.parse(updatedScheduleData);
    }),

  deleteSchedule: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await prisma.study_schedules.delete({
        where: { id: input.id },
      });
      return { success: true, message: 'Schedule deleted successfully' };
    }),

  // --- Study Log Procedures ---
  listLogs: publicProcedure
    .input(z.object({
        start_date: z.coerce.date().optional(), // Use coerce.date
        end_date: z.coerce.date().optional(),   // Use coerce.date
        textbook_id: z.number().int().positive().optional(),
    }).optional())
    .output(z.array(StudyLogSchema))
    .query(async ({ input }) => {
      // Use Date objects in where clause
      const where: Prisma.study_logsWhereInput = {};
      if (input?.start_date || input?.end_date) {
                where.date = {};
                if (input.start_date) where.date.gte = input.start_date; // Pass Date object
                if (input.end_date) where.date.lte = input.end_date;   // Pass Date object
            }
            if (input?.textbook_id) where.textbook_id = input.textbook_id;

            const logsData = await prisma.study_logs.findMany({
                where: where,
                include: { textbooks: { select: { title: true, subject: true } } },
                orderBy: { date: 'desc' } // Order by Date field
      });
      // Zod should parse Prisma's output directly.
      return StudyLogSchema.array().parse(logsData);
    }),

  createLog: publicProcedure
    .input(StudyLogInputSchema)
    .output(StudyLogSchema)
    .mutation(async ({ input }) => {
      // Input date is now a Date object
      const dataToCreate: Prisma.study_logsCreateInput = {
          date: input.date, // Pass Date object
                textbooks: { connect: { id: input.textbook_id } },
                planned_amount: input.planned_amount,
                actual_amount: input.actual_amount,
                notes: input.notes,
            };
            const newLogData = await prisma.study_logs.create({
                data: dataToCreate,
                 include: { textbooks: { select: { title: true, subject: true } } }
      });
      return StudyLogSchema.parse(newLogData);
    }),

  updateLog: publicProcedure
    .input(StudyLogUpdateSchema)
    .output(StudyLogSchema)
    .mutation(async ({ input }) => {
      const { id, textbook_id, ...updateData } = input; // updateData contains Date object if date is updated
      const dataToUpdate: Prisma.study_logsUpdateInput = {
          ...updateData, // Spread Date object directly if present
                ...(textbook_id && { textbooks: { connect: { id: textbook_id } } }),
            };

            const updatedLogData = await prisma.study_logs.update({
                where: { id },
                data: dataToUpdate,
                 include: { textbooks: { select: { title: true, subject: true } } }
      });
      return StudyLogSchema.parse(updatedLogData);
    }),

  deleteLog: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await prisma.study_logs.delete({
          where: { id: input.id },
      });
      return { success: true, message: 'Log deleted successfully' };
    }),

  // --- Timeline Events Procedure ---
  getTimelineEvents: publicProcedure
    .input(z.object({
        startDate: z.coerce.date().optional(), // Use coerce.date
        endDate: z.coerce.date().optional(),   // Use coerce.date
    }).optional())
    .output(z.array(TimelineEventSchema))
    .query(async ({ input }) => {
      // Array will hold fully parsed events
      const events: z.infer<typeof TimelineEventSchema>[] = [];
      const startDate = input?.startDate; // Date object or undefined
      const endDate = input?.endDate;     // Date object or undefined

      // Fetch schedules using Date objects in where clause
      const scheduleWhere: Prisma.study_schedulesWhereInput = {};
            if (startDate) scheduleWhere.end_date = { gte: startDate }; // Pass Date object
            if (endDate) scheduleWhere.start_date = { lte: endDate };   // Pass Date object
            const schedulesData = await prisma.study_schedules.findMany({
                where: scheduleWhere,
                include: { textbooks: { select: { title: true, subject: true } } },
                orderBy: { start_date: 'asc' }, // Order by Date field
            });
            schedulesData.forEach(s => {
                const parsedSchedule = StudyScheduleSchema.parse(s);
                const subject = s.textbooks?.subject ?? 'N/A';
                const title = s.textbooks?.title ?? 'N/A';

                const rawEventData = {
                    id: `schedule-${s.id}`,
                    type: 'schedule' as const,
                    title: `${subject}: ${title}`,
                    startDate: parsedSchedule.start_date,
                    endDate: parsedSchedule.end_date,
                    details: parsedSchedule
                };
                events.push(TimelineEventSchema.parse(rawEventData));
            });

            const examWhere: Prisma.examsWhereInput = {};
            if (startDate || endDate) {
                examWhere.date = {};
                if (startDate) examWhere.date.gte = startDate;
                if (endDate) examWhere.date.lte = endDate;
            }
            const examsData = await prisma.exams.findMany({
                where: examWhere,
                include: {
                    universities: { select: { name: true } },
                    exam_scores: true,
                    subject_scores: true
                 },
                orderBy: { date: 'asc' }, // Order by Date field
            });
            examsData.forEach(e => {
                const examDetails: ExamDetails = {
                    id: e.id,
                        name: e.name,
                        date: e.date, // Date object from Prisma
                    is_mock: e.is_mock,
                    exam_type: e.exam_type,
                    notes: e.notes,
                    university_id: e.university_id,
                    university_name: e.universities?.name,
                    created_at: e.created_at,
                    updated_at: e.updated_at,
                    exam_scores: e.exam_scores.map(es => ({
                        ...es,
                        created_at: es.created_at,
                        updated_at: es.updated_at,
                    })),
                    subject_scores: e.subject_scores.map(ss => ({
                        ...ss,
                        created_at: ss.created_at,
                        updated_at: ss.updated_at,
                    })),
                };
                // Create raw event data matching the schema structure
                    const rawEventData = {
                        id: `exam-${e.id}`,
                        type: (e.is_mock ? 'mock_exam' : 'exam') as 'mock_exam' | 'exam', // Use literal type
                        title: e.is_mock ? e.name : (e.universities?.name ? `${e.universities.name} ${e.name}` : e.name),
                        startDate: e.date, // Date object from Prisma
                        endDate: e.date,   // Date object from Prisma
                        details: examDetails
                    };
                    events.push(TimelineEventSchema.parse(rawEventData));
            });

            // Sort the array of fully parsed events
            events.sort((a, b) => {
                // Now a and b are z.infer<typeof TimelineEventSchema>, so dates are guaranteed
                const startDiff = a.startDate.getTime() - b.startDate.getTime();
                if (startDiff !== 0) return startDiff;
                // Handle optional endDate
                const endDateA = a.endDate?.getTime() ?? a.startDate.getTime();
                const endDateB = b.endDate?.getTime() ?? b.startDate.getTime();
                return endDateA - endDateB;
            });

      // Return the already parsed and sorted array
      return events;
    }),

  getYearlyLogs: publicProcedure
    .input(z.object({ year: z.number().int() }))
    .output(z.array(YearlyLogSchema)) // Updated output schema
    .query(async ({ input }) => {
      const { year } = input;
      const yearStartDate = new Date(Date.UTC(year, 0, 1));
      const yearEndDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

      const dailyLogs = await prisma.study_logs.groupBy({
        by: ['date'],
        where: {
            date: {
                gte: yearStartDate,
                lte: yearEndDate
            },
          },
          _sum: { actual_amount: true },
          orderBy: { date: 'asc' },
        });

        const yearlyData = dailyLogs.map(dayLog => ({
          date: dayLog.date,
          count: dayLog._sum?.actual_amount ?? 0,
        }));

        return YearlyLogSchema.array().parse(yearlyData);
    }),
});

export type ScheduleRouter = typeof scheduleRouter;
