import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, router } from '../trpc.js';
import { getDbPool } from '../db/database.js'; // Changed to getDbPool
import {
  StudyScheduleInputSchema,
  StudyScheduleUpdateSchema,
  StudyScheduleSchema,
  StudyLogInputSchema,
  StudyLogUpdateSchema,
  StudyLogSchema,
  TimelineEventSchema,
  type StudySchedule,
  type StudyLog,
  type TimelineEvent,
} from '@answeranki/shared/schemas/schedule';
// Import Exam type
import { type Exam } from '@answeranki/shared/types/exam';
import { format, isValid, parse } from 'date-fns';

export const scheduleRouter = router({
  // --- Study Schedule Procedures ---
  listSchedules: publicProcedure
    .output(z.array(StudyScheduleSchema))
    .query(async () => {
      const pool = getDbPool(); // Changed to getDbPool
      // Use pool.query for PostgreSQL
      const result = await pool.query(`
        SELECT s.*, t.title as textbook_title, t.subject as textbook_subject
        FROM study_schedules s
        JOIN textbooks t ON s.textbook_id = t.id
        ORDER BY s.start_date
      `);
      return result.rows; // Return rows from the result
    }),

  createSchedule: publicProcedure
    .input(StudyScheduleInputSchema)
    .output(StudyScheduleSchema)
    .mutation(async ({ input }) => {
      const pool = getDbPool(); // Changed to getDbPool
      // Ensure textbook exists
      const textbookResult = await pool.query('SELECT id FROM textbooks WHERE id = $1', [input.textbook_id]);
      if (textbookResult.rowCount === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Textbook not found' });
      }
      try {
        // Use pool.query and RETURNING *
        const result = await pool.query(
          'INSERT INTO study_schedules (textbook_id, start_date, end_date, daily_goal, buffer_days, weekday_goals, total_problems) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
          [input.textbook_id, input.start_date, input.end_date, input.daily_goal, input.buffer_days, input.weekday_goals, input.total_problems]
        );
        const newScheduleId = result.rows[0].id;
        // Fetch the newly created schedule with joined data
        const newScheduleResult = await pool.query(`
          SELECT s.*, t.title as textbook_title, t.subject as textbook_subject
          FROM study_schedules s
          JOIN textbooks t ON s.textbook_id = t.id
          WHERE s.id = $1
        `, [newScheduleId]);
        const newSchedule = newScheduleResult.rows[0];
        if (!newSchedule) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve newly created schedule' });
        }
        return StudyScheduleSchema.parse(newSchedule); // Validate output
      } catch (error: any) {
        console.error("Error creating schedule:", error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Failed to create schedule' });
      }
    }),

  updateSchedule: publicProcedure
    .input(StudyScheduleUpdateSchema)
    .output(StudyScheduleSchema)
    .mutation(async ({ input }) => {
      const pool = getDbPool(); // Changed to getDbPool
      // Ensure schedule exists
      const existingScheduleResult = await pool.query('SELECT id FROM study_schedules WHERE id = $1', [input.id]);
      if (existingScheduleResult.rowCount === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found' });
      }
      // Ensure textbook exists
      const textbookResult = await pool.query('SELECT id FROM textbooks WHERE id = $1', [input.textbook_id]);
      if (textbookResult.rowCount === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Textbook not found' });
      }
      // Validate start/end date logic (already handled by refine in input schema, but good practice)
      if (input.start_date > input.end_date) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'End date cannot be earlier than start date' });
      }
      try {
        // Use pool.query and RETURNING *
        const result = await pool.query(
          'UPDATE study_schedules SET textbook_id = $1, start_date = $2, end_date = $3, daily_goal = $4, buffer_days = $5, weekday_goals = $6, total_problems = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $8 RETURNING id',
          [input.textbook_id, input.start_date, input.end_date, input.daily_goal, input.buffer_days, input.weekday_goals, input.total_problems, input.id]
        );
        const updatedScheduleId = result.rows[0].id;
        // Fetch the updated schedule with joined data
        const updatedScheduleResult = await pool.query(`
          SELECT s.*, t.title as textbook_title, t.subject as textbook_subject
          FROM study_schedules s
          JOIN textbooks t ON s.textbook_id = t.id
          WHERE s.id = $1
        `, [updatedScheduleId]);
        const updatedSchedule = updatedScheduleResult.rows[0];
        if (!updatedSchedule) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve updated schedule' });
        }
        return StudyScheduleSchema.parse(updatedSchedule); // Validate output
      } catch (error: any) {
        console.error("Error updating schedule:", error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Failed to update schedule' });
      }
    }),

  deleteSchedule: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const pool = getDbPool(); // Changed to getDbPool
      // Use pool.query for DELETE
      const result = await pool.query('DELETE FROM study_schedules WHERE id = $1', [input.id]);
      if (result.rowCount === 0) { // Check rowCount
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found' });
      }
      return { success: true, message: 'Schedule deleted successfully' };
    }),

  // --- Study Log Procedures (To be added) ---
  listLogs: publicProcedure
    .input(z.object({
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        textbook_id: z.number().int().positive().optional(),
    }).optional())
    .output(z.array(StudyLogSchema))
    .query(async ({ input }) => {
        const pool = getDbPool(); // Changed to getDbPool
        let query = `
            SELECT l.*, t.title as textbook_title, t.subject as textbook_subject
            FROM study_logs l
            JOIN textbooks t ON l.textbook_id = t.id
        `;
        const params: any[] = [];
        const conditions: string[] = [];
        let paramIndex = 1;
        if (input?.start_date) {
            conditions.push(`l.date >= $${paramIndex++}`);
            params.push(input.start_date);
        }
        if (input?.end_date) {
            conditions.push(`l.date <= $${paramIndex++}`);
            params.push(input.end_date);
        }
        if (input?.textbook_id) {
            conditions.push(`l.textbook_id = $${paramIndex++}`);
            params.push(input.textbook_id);
        }
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY l.date DESC';
        // Use pool.query with $n placeholders
        const result = await pool.query(query, params);
        return StudyLogSchema.array().parse(result.rows); // Validate output
    }),

  createLog: publicProcedure
    .input(StudyLogInputSchema)
    .output(StudyLogSchema)
    .mutation(async ({ input }) => {
        const pool = getDbPool(); // Changed to getDbPool
        // Ensure textbook exists
        const textbookResult = await pool.query('SELECT id FROM textbooks WHERE id = $1', [input.textbook_id]);
        if (textbookResult.rowCount === 0) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Textbook not found' });
        }
        // Check for existing log on the same date/textbook
        const existingLogResult = await pool.query(
            'SELECT id FROM study_logs WHERE date = $1 AND textbook_id = $2',
            [input.date, input.textbook_id]
        );
        // Check rowCount explicitly against 0
        if (existingLogResult.rowCount !== null && existingLogResult.rowCount > 0) {
            throw new TRPCError({ code: 'CONFLICT', message: 'A log already exists for this date and textbook' });
        }
        try {
            // Use pool.query and RETURNING *
            const result = await pool.query(
                'INSERT INTO study_logs (date, textbook_id, planned_amount, actual_amount, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [input.date, input.textbook_id, input.planned_amount, input.actual_amount, input.notes]
            );
            const newLogId = result.rows[0].id;
            // Fetch the newly created log with joined data
            const newLogResult = await pool.query(`
                SELECT l.*, t.title as textbook_title, t.subject as textbook_subject
                FROM study_logs l
                JOIN textbooks t ON l.textbook_id = t.id
                WHERE l.id = $1
            `, [newLogId]);
            const newLog = newLogResult.rows[0];
            if (!newLog) {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve newly created log' });
            }
            return StudyLogSchema.parse(newLog); // Validate output
        } catch (error: any) {
            console.error("Error creating log:", error);
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Failed to create log' });
        }
    }),

  updateLog: publicProcedure
    .input(StudyLogUpdateSchema)
    .output(StudyLogSchema)
    .mutation(async ({ input }) => {
        const pool = getDbPool(); // Changed to getDbPool
        // Ensure log exists
        const logToUpdateResult = await pool.query('SELECT id FROM study_logs WHERE id = $1', [input.id]);
        if (logToUpdateResult.rowCount === 0) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Log not found' });
        }
        // Ensure textbook exists
        const textbookResult = await pool.query('SELECT id FROM textbooks WHERE id = $1', [input.textbook_id]);
        if (textbookResult.rowCount === 0) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Textbook not found' });
        }
        // Check for conflicting log
        const conflictingLogResult = await pool.query(
            'SELECT id FROM study_logs WHERE date = $1 AND textbook_id = $2 AND id != $3',
            [input.date, input.textbook_id, input.id]
        );
        // Check rowCount explicitly against 0
        if (conflictingLogResult.rowCount !== null && conflictingLogResult.rowCount > 0) {
            throw new TRPCError({ code: 'CONFLICT', message: 'Another log already exists for this date and textbook' });
        }
        try {
            // Use pool.query and RETURNING *
            const result = await pool.query(
                'UPDATE study_logs SET date = $1, textbook_id = $2, planned_amount = $3, actual_amount = $4, notes = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING id',
                [input.date, input.textbook_id, input.planned_amount, input.actual_amount, input.notes, input.id]
            );
             const updatedLogId = result.rows[0].id;
            // Fetch the updated log with joined data
            const updatedLogResult = await pool.query(`
                SELECT l.*, t.title as textbook_title, t.subject as textbook_subject
                FROM study_logs l
                JOIN textbooks t ON l.textbook_id = t.id
                WHERE l.id = $1
            `, [updatedLogId]);
            const updatedLog = updatedLogResult.rows[0];
            if (!updatedLog) {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve updated log' });
            }
            return StudyLogSchema.parse(updatedLog); // Validate output
        } catch (error: any) {
            console.error("Error updating log:", error);
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Failed to update log' });
        }
    }),

  deleteLog: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
        const pool = getDbPool(); // Changed to getDbPool
        // Use pool.query for DELETE
        const result = await pool.query('DELETE FROM study_logs WHERE id = $1', [input.id]);
        if (result.rowCount === 0) { // Check rowCount
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Log not found' });
        }
        return { success: true, message: 'Log deleted successfully' };
    }),

  // --- Timeline Events Procedure (To be added) ---
  getTimelineEvents: publicProcedure
    .input(z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).optional())
    // Output needs refinement based on how details are structured
    .output(z.array(TimelineEventSchema)) // Use refined schema
    .query(async ({ input }) => {
        const pool = getDbPool(); // Changed to getDbPool
        const events: TimelineEvent[] = []; // Use TimelineEvent type

        const parseAndValidateDate = (dateStr: string | undefined): Date | undefined => {
            if (!dateStr) return undefined;
            let parsedDate: Date | undefined;
            parsedDate = parse(dateStr, 'yyyy-MM-dd', new Date());
            if (isValid(parsedDate)) return parsedDate;
            parsedDate = parse(dateStr, 'yyyy/MM/dd', new Date());
            if (isValid(parsedDate)) return parsedDate;
            console.warn("Invalid date format received for timeline:", dateStr);
            return undefined;
        };

        const startDate = parseAndValidateDate(input?.startDate);
        const endDate = parseAndValidateDate(input?.endDate);

        // Fetch schedules (range overlap) using $n placeholders
        const scheduleConditions: string[] = [];
        const scheduleParams: string[] = [];
        let scheduleParamIndex = 1;
        if (startDate) {
            scheduleConditions.push(`s.end_date >= $${scheduleParamIndex++}`);
            scheduleParams.push(format(startDate, 'yyyy-MM-dd'));
        }
        if (endDate) {
            scheduleConditions.push(`s.start_date <= $${scheduleParamIndex++}`);
            scheduleParams.push(format(endDate, 'yyyy-MM-dd'));
        }
        const scheduleWhereClause = scheduleConditions.length > 0 ? `WHERE ${scheduleConditions.join(' AND ')}` : '';

        // Use pool.query
        const scheduleResult = await pool.query<StudySchedule>(`
            SELECT s.*, t.title as textbook_title, t.subject as textbook_subject
            FROM study_schedules s
            JOIN textbooks t ON s.textbook_id = t.id
            ${scheduleWhereClause}
            ORDER BY s.start_date
        `, scheduleParams);
        const schedules = scheduleResult.rows;

        schedules.forEach(s => events.push({
            id: `schedule-${s.id}`,
            type: 'schedule',
            title: `${s.textbook_subject}: ${s.textbook_title}`, // Assuming textbook_title and subject are fetched
            startDate: s.start_date, // Keep as string for now
            endDate: s.end_date,   // Keep as string for now
            details: s
        }));

        // Fetch exams (unified table) using $n placeholders
        const buildDateQueryParts = (dateColumn: string, alias: string, startIndex: number): { whereClause: string, queryParams: string[], nextIndex: number } => {
            const conditions: string[] = [];
            const queryParams: string[] = [];
            let currentIndex = startIndex;
            if (startDate) {
                conditions.push(`${alias}.${dateColumn} >= $${currentIndex++}`);
                queryParams.push(format(startDate, 'yyyy-MM-dd'));
            }
            if (endDate) {
                conditions.push(`${alias}.${dateColumn} <= $${currentIndex++}`);
                queryParams.push(format(endDate, 'yyyy-MM-dd'));
            }
            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            return { whereClause, queryParams, nextIndex: currentIndex };
        };

        const examQueryParts = buildDateQueryParts('date', 'e', 1);
        // Use pool.query and define expected type
        interface ExamWithUniName extends Exam { university_name?: string }
        const examResult = await pool.query<ExamWithUniName>(`
            SELECT
              e.*,
              u.name as university_name
            FROM exams e
            LEFT JOIN universities u ON e.university_id = u.id
            ${examQueryParts.whereClause}
            ORDER BY e.date
        `, examQueryParts.queryParams);
        const allExams = examResult.rows;

        allExams.forEach(e => events.push({
            id: `exam-${e.id}`,
            type: e.is_mock ? 'mock_exam' : 'exam',
            title: e.is_mock ? e.name : (e.university_name ? `${e.university_name} ${e.name}` : e.name), // Use optional chaining if needed
            startDate: e.date,
            endDate: e.date, // Exams are single-day events
            details: e
        }));

        // Sort all events by start date
        events.sort((a, b) => {
            if (a.startDate < b.startDate) return -1;
            if (a.startDate > b.startDate) return 1;
            return 0;
        });

        // Validate the final events array against the TimelineEventSchema
        return TimelineEventSchema.array().parse(events);
    }),
});

export type ScheduleRouter = typeof scheduleRouter;
