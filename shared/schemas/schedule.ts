import { z } from 'zod';

// Base Study Schedule Schema (without refinement)
const BaseStudyScheduleSchema = z.object({
  textbook_id: z.number().int().positive(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, expected YYYY-MM-DD"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, expected YYYY-MM-DD"),
  daily_goal: z.number().int().positive().optional().nullable(),
  buffer_days: z.number().int().min(0).optional().default(0),
  weekday_goals: z.string().optional().nullable(), // JSON string for weekday goals
  total_problems: z.number().int().positive().optional().nullable(),
});

// Input Schema with refinement
export const StudyScheduleInputSchema = BaseStudyScheduleSchema.refine(data => data.start_date <= data.end_date, {
  message: "End date cannot be earlier than start date",
  path: ["end_date"], // Path of the error
});

// Update Schema extends the base schema
export const StudyScheduleUpdateSchema = BaseStudyScheduleSchema.extend({
  id: z.number().int().positive(),
});

// Full Schema extends the update schema
export const StudyScheduleSchema = StudyScheduleUpdateSchema.extend({
  textbook_title: z.string().optional(), // Joined data
  textbook_subject: z.string().optional(), // Joined data
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type StudyScheduleInput = z.infer<typeof StudyScheduleInputSchema>;
export type StudySchedule = z.infer<typeof StudyScheduleSchema>;


// Study Log Schema
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
  textbook_title: z.string().optional(), // Joined data
  textbook_subject: z.string().optional(), // Joined data
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type StudyLogInput = z.infer<typeof StudyLogInputSchema>;
export type StudyLog = z.infer<typeof StudyLogSchema>;

// Timeline Event Schema (Placeholder - refine as needed)
// Note: This needs careful definition based on how you structure the tRPC endpoint
export const TimelineEventSchema = z.object({
    id: z.string(),
    type: z.enum(['schedule', 'exam', 'mock_exam']),
    title: z.string(),
    startDate: z.string().datetime(), // Consider using z.date() if transforming
    endDate: z.string().datetime().optional(), // Consider using z.date() if transforming
    details: z.any(), // Needs refinement based on actual detail types (StudySchedule, Exam)
});

export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
