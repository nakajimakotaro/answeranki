import { z } from 'zod';

const BaseStudyScheduleSchema = z.object({
  textbook_id: z.number().int().positive(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, expected YYYY-MM-DD"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, expected YYYY-MM-DD"),
  daily_goal: z.number().int().positive().optional().nullable(),
  buffer_days: z.number().int().min(0).optional().default(0),
  weekday_goals: z.string().optional().nullable(),
  total_problems: z.number().int().positive().optional().nullable(),
});

export const StudyScheduleInputSchema = BaseStudyScheduleSchema.refine(data => data.start_date <= data.end_date, {
  message: "End date cannot be earlier than start date",
  path: ["end_date"],
});

export const StudyScheduleUpdateSchema = BaseStudyScheduleSchema.extend({
  id: z.number().int().positive(),
});

export const StudyScheduleSchema = StudyScheduleUpdateSchema.extend({
  textbook_title: z.string().optional(),
  textbook_subject: z.string().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type StudyScheduleInput = z.infer<typeof StudyScheduleInputSchema>;
export type StudySchedule = z.infer<typeof StudyScheduleSchema>;


export const StudyLogInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, expected YYYY-MM-DD"),
  textbook_id: z.number().int().positive(),
  planned_amount: z.number().int().min(0).optional().default(0),
  actual_amount: z.number().int().min(0).optional().default(0),
  notes: z.string().optional().nullable(),
});

export const StudyLogUpdateSchema = StudyLogInputSchema.extend({
  id: z.number().int().positive(),
});

export const StudyLogSchema = StudyLogUpdateSchema.extend({
  textbook_title: z.string().optional(),
  textbook_subject: z.string().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type StudyLogInput = z.infer<typeof StudyLogInputSchema>;
export type StudyLog = z.infer<typeof StudyLogSchema>;

export const TimelineEventSchema = z.object({
    id: z.string(),
    type: z.enum(['schedule', 'exam', 'mock_exam']),
    title: z.string(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime().optional(),
    details: z.any(),
});

export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
