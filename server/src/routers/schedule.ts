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
} from '@answeranki/shared/schemas/schedule';

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
  Object.keys(formatted).forEach(key => (formatted as any)[key] === undefined && delete (formatted as any)[key]);
  return formatted;
};

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
  Object.keys(formatted).forEach(key => (formatted as any)[key] === undefined && delete (formatted as any)[key]);
  return formatted;
};


export const scheduleRouter = router({
  listSchedules: publicProcedure
    .output(z.array(StudyScheduleSchema))
    .query(async () => {
      const schedulesData = await prisma.study_schedules.findMany({
        include: { textbooks: { select: { title: true, subject: true } } },
        orderBy: { start_date: 'asc' }
      });
      const formattedSchedules = schedulesData.map(formatPrismaScheduleForZod);
      return StudyScheduleSchema.array().parse(formattedSchedules);
    }),

  createSchedule: publicProcedure
    .input(StudyScheduleInputSchema)
    .output(StudyScheduleSchema)
    .mutation(async ({ input }) => {
      const dataToCreate: Prisma.study_schedulesCreateInput = {
        textbooks: { connect: { id: input.textbook_id } },
          start_date: input.start_date,
          end_date: input.end_date,
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
    }),

  updateSchedule: publicProcedure
    .input(StudyScheduleUpdateSchema)
    .output(StudyScheduleSchema)
    .mutation(async ({ input }) => {
      const { id, textbook_id, ...updateData } = input;
      const dataToUpdate: Prisma.study_schedulesUpdateInput = {
          ...updateData,
            ...(textbook_id && { textbooks: { connect: { id: textbook_id } } }),
         };

        const updatedScheduleData = await prisma.study_schedules.update({
          where: { id },
          data: dataToUpdate,
           include: { textbooks: { select: { title: true, subject: true } } }
      });
      const formattedSchedule = formatPrismaScheduleForZod(updatedScheduleData);
      return StudyScheduleSchema.parse(formattedSchedule);
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
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        textbook_id: z.number().int().positive().optional(),
    }).optional())
    .output(z.array(StudyLogSchema))
    .query(async ({ input }) => {
      const where: Prisma.study_logsWhereInput = {};
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
      // Zod parse errors will propagate.
      return StudyLogSchema.array().parse(formattedLogs);
    }),

  createLog: publicProcedure
    .input(StudyLogInputSchema)
    .output(StudyLogSchema)
    .mutation(async ({ input }) => {
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
    }),

  updateLog: publicProcedure
    .input(StudyLogUpdateSchema)
    .output(StudyLogSchema)
    .mutation(async ({ input }) => {
      const { id, textbook_id, ...updateData } = input;
      const dataToUpdate: Prisma.study_logsUpdateInput = {
          ...updateData,
                ...(textbook_id && { textbooks: { connect: { id: textbook_id } } }),
            };

            const updatedLogData = await prisma.study_logs.update({
                where: { id },
                data: dataToUpdate,
                 include: { textbooks: { select: { title: true, subject: true } } }
      });
      const formattedLog = formatPrismaLogForZod(updatedLogData);
      return StudyLogSchema.parse(formattedLog);
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
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).optional())
    .output(z.array(TimelineEventSchema))
    .query(async ({ input }) => {
      const events: z.input<typeof TimelineEventSchema>[] = [];
      const startDate = input?.startDate;
      const endDate = input?.endDate;

      // Fetch schedules
      const scheduleWhere: Prisma.study_schedulesWhereInput = {};
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
                    details: formattedSchedule
                });
            });

            // Fetch exams
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
                orderBy: { date: 'asc' },
            });
            examsData.forEach(e => {
                const formattedDate = e.date;
                const examDetails: any = {
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
                Object.keys(examDetails).forEach(key => examDetails[key] === undefined && delete examDetails[key]);

                events.push({
                    id: `exam-${e.id}`,
                    type: e.is_mock ? 'mock_exam' : 'exam',
                    title: e.is_mock ? e.name : (e.universities?.name ? `${e.universities.name} ${e.name}` : e.name),
                    startDate: formattedDate,
                    endDate: formattedDate,
                    details: examDetails
                });
            });

            events.sort((a, b) => {
                if (a.startDate < b.startDate) return -1;
                if (a.startDate > b.startDate) return 1;
                const endDateA = a.endDate ?? '';
                const endDateB = b.endDate ?? '';
                if (endDateA < endDateB) return -1;
                if (endDateA > endDateB) return 1;
                return 0;
            });

      return TimelineEventSchema.array().parse(events);
    }),

  // --- Yearly Logs Procedure ---
  getYearlyLogs: publicProcedure
    .input(z.object({ year: z.number().int() }))
    .output(z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.number()))
    .query(async ({ input }) => {
      const { year } = input;
      const yearStartDateStr = `${year}-01-01`;
      const yearEndDateStr = `${year}-12-31`;

      const dailyLogs = await prisma.study_logs.groupBy({
        by: ['date'],
        where: {
            date: { gte: yearStartDateStr, lte: yearEndDateStr },
          },
          _sum: { actual_amount: true },
          orderBy: { date: 'asc' },
        });

        const yearlyData = dailyLogs.reduce((acc, dayLog) => {
          acc[dayLog.date] = dayLog._sum?.actual_amount ?? 0;
          return acc;
        }, {} as Record<string, number>);

        return yearlyData;
    }),
});

export type ScheduleRouter = typeof scheduleRouter;
