import { z } from 'zod';

const BaseStudyScheduleSchema = z.object({
  textbook_id: z.string(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  daily_goal: z.number().int().positive().optional().nullable(),
  buffer_days: z.number().int().min(0).optional().default(0),
  weekday_goals: z.string().optional().nullable(),
  total_problems: z.number().int().positive().optional().nullable(),
});

export const StudyScheduleInputSchema = BaseStudyScheduleSchema.refine(data => data.start_date.getTime() <= data.end_date.getTime(), {
  message: "End date cannot be earlier than start date",
  path: ["end_date"],
});

export const StudyScheduleUpdateSchema = BaseStudyScheduleSchema.extend({
  id: z.string(),
});

export const StudyScheduleSchema = StudyScheduleUpdateSchema.extend({
  textbook_title: z.string(),
  textbook_subject: z.string(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
  anki_note_id: z.number().optional(),
});

export type StudyScheduleInput = z.infer<typeof StudyScheduleInputSchema>;
export type StudySchedule = z.infer<typeof StudyScheduleSchema>;


export const StudyLogInputSchema = z.object({
  date: z.coerce.date(),
  textbook_id: z.string(),
  planned_amount: z.number().int().min(0).optional().default(0),
  actual_amount: z.number().int().min(0).optional().default(0),
  notes: z.string().optional().nullable(),
});

export const StudyLogUpdateSchema = StudyLogInputSchema.extend({
  id: z.number().int().positive(),
});

export const StudyLogSchema = StudyLogUpdateSchema.extend({
  textbook_title: z.string(),
  textbook_subject: z.string().optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
});

export type StudyLogInput = z.infer<typeof StudyLogInputSchema>;
export type StudyLog = z.infer<typeof StudyLogSchema>;

// Updated TimelineEventSchema to use z.coerce.date()
export const TimelineEventSchema = z.object({
    id: z.string(),
    type: z.enum(['schedule', 'exam', 'mock_exam']),
    title: z.string(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    details: z.any(),
});

// Schema for the output of getYearlyLogs
export const YearlyLogSchema = z.object({
    date: z.coerce.date(),
    count: z.number(),
});
export type YearlyLog = z.infer<typeof YearlyLogSchema>;

export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
