import { Router, Request, Response, NextFunction } from 'express'; // Import NextFunction
import { getDb } from '../db/database.js';
// Import shared types
import { Exam } from '../../../shared/types/exam.js'; // Adjust path as needed
import { NotFoundError, BadRequestError, ConflictError } from '../middleware/errorHandler.js'; // Import custom errors
import {
  parseISO,
  differenceInDays,
  getYear,
  compareAsc,
  startOfToday,
  parse,
  isValid,
  format,
  addDays,
  isBefore,
  isAfter,
  isEqual
} from 'date-fns';

const router = Router();

// Helper function to wrap async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Types (Keep local types if they are not shared or differ significantly)
interface University {
  id?: number;
  name: string;
  rank?: number;
  notes?: string;
}

interface Textbook {
  id?: number;
  title: string;
  subject: string;
  total_problems: number;
  anki_deck_name?: string;
}

interface StudySchedule {
  id?: number;
  textbook_id: number;
  start_date: string;
  end_date: string;
  daily_goal?: number;
  buffer_days?: number;
  weekday_goals?: string;
  total_problems?: number;
  // Add properties that might be joined in API responses if needed
  textbook_title?: string;
  textbook_subject?: string;
}

interface StudyLog {
  id?: number;
  date: string;
  textbook_id: number;
  planned_amount?: number;
  actual_amount?: number;
  notes?: string;
  // Add properties that might be joined in API responses if needed
  textbook_title?: string;
  textbook_subject?: string;
}

// --- University Routes ---
router.get('/universities', asyncHandler(async (req, res, next) => {
  const db = getDb();
  const universities = await db.all('SELECT * FROM universities ORDER BY rank, name');
  res.json(universities);
}));

router.post('/universities', asyncHandler(async (req, res, next) => {
  const { name, rank, notes } = req.body as University;
  if (!name) {
    throw new BadRequestError('University name is required');
  }
  const db = getDb();
  const result = await db.run(
    'INSERT INTO universities (name, rank, notes) VALUES (?, ?, ?)',
    [name, rank || null, notes || null]
  );
  const newUniversity = await db.get('SELECT * FROM universities WHERE id = ?', result.lastID);
  if (!newUniversity) throw new Error('Failed to retrieve newly created university');
  res.status(201).json(newUniversity);
}));

router.put('/universities/:id', asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name, rank, notes } = req.body as University;
  if (!name) {
    throw new BadRequestError('University name is required');
  }
  const db = getDb();
  const existing = await db.get('SELECT id FROM universities WHERE id = ?', id);
  if (!existing) throw new NotFoundError('University not found');

  await db.run(
    'UPDATE universities SET name = ?, rank = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, rank || null, notes || null, id]
  );
  const updatedUniversity = await db.get('SELECT * FROM universities WHERE id = ?', id);
  if (!updatedUniversity) throw new Error('Failed to retrieve updated university');
  res.json(updatedUniversity);
}));

router.delete('/universities/:id', asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const db = getDb();
  const result = await db.run('DELETE FROM universities WHERE id = ?', id);
  if (result.changes === 0) {
    throw new NotFoundError('University not found');
  }
  res.json({ message: 'University deleted successfully' });
}));

// --- Textbook Routes ---
router.get('/textbooks', asyncHandler(async (req, res, next) => {
  const db = getDb();
  const textbooks = await db.all('SELECT * FROM textbooks ORDER BY subject, title');
  res.json(textbooks);
}));

router.post('/textbooks', asyncHandler(async (req, res, next) => {
  const { title, subject, total_problems, anki_deck_name } = req.body as Textbook;
  if (!title || !subject) {
    throw new BadRequestError('Title and subject are required');
  }
  const db = getDb();
  const result = await db.run(
    'INSERT INTO textbooks (title, subject, total_problems, anki_deck_name) VALUES (?, ?, ?, ?)',
    [title, subject, total_problems || 0, anki_deck_name || null]
  );
  const newTextbook = await db.get('SELECT * FROM textbooks WHERE id = ?', result.lastID);
  if (!newTextbook) throw new Error('Failed to retrieve newly created textbook');
  res.status(201).json(newTextbook);
}));

router.put('/textbooks/:id', asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { title, subject, total_problems, anki_deck_name } = req.body as Textbook;
  if (!title || !subject) {
    throw new BadRequestError('Title and subject are required');
  }
  const db = getDb();
  const existing = await db.get('SELECT id FROM textbooks WHERE id = ?', id);
  if (!existing) throw new NotFoundError('Textbook not found');

  await db.run(
    'UPDATE textbooks SET title = ?, subject = ?, total_problems = ?, anki_deck_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [title, subject, total_problems || 0, anki_deck_name || null, id]
  );
  const updatedTextbook = await db.get('SELECT * FROM textbooks WHERE id = ?', id);
  if (!updatedTextbook) throw new Error('Failed to retrieve updated textbook');
  res.json(updatedTextbook);
}));

router.delete('/textbooks/:id', asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const db = getDb();
  const result = await db.run('DELETE FROM textbooks WHERE id = ?', id);
  if (result.changes === 0) {
    throw new NotFoundError('Textbook not found');
  }
  res.json({ message: 'Textbook deleted successfully' });
}));

// --- Study Schedule Routes ---
router.get('/schedules', asyncHandler(async (req, res, next) => {
  const db = getDb();
  const schedules: StudySchedule[] = await db.all(`
    SELECT s.*, t.title as textbook_title, t.subject as textbook_subject
    FROM study_schedules s
    JOIN textbooks t ON s.textbook_id = t.id
    ORDER BY s.start_date
  `);
  res.json(schedules);
}));

router.post('/schedules', asyncHandler(async (req, res, next) => {
  const { textbook_id, start_date, end_date, daily_goal, buffer_days, weekday_goals, total_problems } = req.body as StudySchedule;
  if (!textbook_id || !start_date || !end_date) {
    throw new BadRequestError('Textbook ID, start date, and end date are required');
  }
  const db = getDb();
  const textbook = await db.get('SELECT id FROM textbooks WHERE id = ?', textbook_id);
  if (!textbook) {
    throw new NotFoundError('Textbook not found');
  }
  const result = await db.run(
    'INSERT INTO study_schedules (textbook_id, start_date, end_date, daily_goal, buffer_days, weekday_goals, total_problems) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [textbook_id, start_date, end_date, daily_goal || null, buffer_days || 0, weekday_goals || null, total_problems || null]
  );
  const newSchedule = await db.get(`
    SELECT s.*, t.title as textbook_title, t.subject as textbook_subject
    FROM study_schedules s
    JOIN textbooks t ON s.textbook_id = t.id
    WHERE s.id = ?
  `, result.lastID);
  if (!newSchedule) throw new Error('Failed to retrieve newly created schedule');
  res.status(201).json(newSchedule);
}));

router.put('/schedules/:id', asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { textbook_id, start_date, end_date, daily_goal, buffer_days, weekday_goals, total_problems } = req.body as StudySchedule;
  if (!textbook_id || !start_date || !end_date) {
    throw new BadRequestError('Textbook ID, start date, and end date are required');
  }
  const db = getDb();
  const existingSchedule = await db.get('SELECT id FROM study_schedules WHERE id = ?', id);
  if (!existingSchedule) throw new NotFoundError('Schedule not found');
  const textbook = await db.get('SELECT id FROM textbooks WHERE id = ?', textbook_id);
  if (!textbook) {
    throw new NotFoundError('Textbook not found');
  }
  await db.run(
    'UPDATE study_schedules SET textbook_id = ?, start_date = ?, end_date = ?, daily_goal = ?, buffer_days = ?, weekday_goals = ?, total_problems = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [textbook_id, start_date, end_date, daily_goal || null, buffer_days || 0, weekday_goals || null, total_problems || null, id]
  );
  const updatedSchedule = await db.get(`
    SELECT s.*, t.title as textbook_title, t.subject as textbook_subject
    FROM study_schedules s
    JOIN textbooks t ON s.textbook_id = t.id
    WHERE s.id = ?
  `, id);
  if (!updatedSchedule) throw new Error('Failed to retrieve updated schedule');
  res.json(updatedSchedule);
}));

router.delete('/schedules/:id', asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const db = getDb();
  const result = await db.run('DELETE FROM study_schedules WHERE id = ?', id);
  if (result.changes === 0) {
    throw new NotFoundError('Schedule not found');
  }
  res.json({ message: 'Schedule deleted successfully' });
}));

// --- Study Log Routes ---
router.get('/logs', asyncHandler(async (req, res, next) => {
  const { start_date, end_date, textbook_id } = req.query;
  const db = getDb();
  let query = `
    SELECT l.*, t.title as textbook_title, t.subject as textbook_subject
    FROM study_logs l
    JOIN textbooks t ON l.textbook_id = t.id
  `;
  const params: any[] = [];
  const conditions: string[] = [];
  if (start_date) {
    conditions.push('l.date >= ?');
    params.push(start_date);
  }
  if (end_date) {
    conditions.push('l.date <= ?');
    params.push(end_date);
  }
  if (textbook_id) {
    conditions.push('l.textbook_id = ?');
    params.push(textbook_id);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY l.date DESC';
  const logs = await db.all(query, params);
  res.json(logs);
}));

router.post('/logs', asyncHandler(async (req, res, next) => {
  const { date, textbook_id, planned_amount, actual_amount, notes } = req.body as StudyLog;
  if (!date || !textbook_id) {
    throw new BadRequestError('Date and textbook ID are required');
  }
  const db = getDb();
  const textbook = await db.get('SELECT id FROM textbooks WHERE id = ?', textbook_id);
  if (!textbook) {
    throw new NotFoundError('Textbook not found');
  }
  const existingLog = await db.get(
    'SELECT id FROM study_logs WHERE date = ? AND textbook_id = ?',
    [date, textbook_id]
  );
  if (existingLog) {
    // Return ConflictError with existing log data if needed by client
    throw new ConflictError('A log already exists for this date and textbook');
    // If you need to send the existing log:
    // const fullExistingLog = await db.get('SELECT * FROM study_logs WHERE id = ?', existingLog.id);
    // return res.status(409).json({ message: 'Conflict', existingLog: fullExistingLog });
  }
  const result = await db.run(
    'INSERT INTO study_logs (date, textbook_id, planned_amount, actual_amount, notes) VALUES (?, ?, ?, ?, ?)',
    [date, textbook_id, planned_amount || 0, actual_amount || 0, notes || null]
  );
  const newLog = await db.get(`
    SELECT l.*, t.title as textbook_title, t.subject as textbook_subject
    FROM study_logs l
    JOIN textbooks t ON l.textbook_id = t.id
    WHERE l.id = ?
  `, result.lastID);
  if (!newLog) throw new Error('Failed to retrieve newly created log');
  res.status(201).json(newLog);
}));

router.put('/logs/:id', asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { date, textbook_id, planned_amount, actual_amount, notes } = req.body as StudyLog;
  if (!date || !textbook_id) {
    throw new BadRequestError('Date and textbook ID are required');
  }
  const db = getDb();
  const logToUpdate = await db.get('SELECT id FROM study_logs WHERE id = ?', id);
  if (!logToUpdate) throw new NotFoundError('Log not found');
  const textbook = await db.get('SELECT id FROM textbooks WHERE id = ?', textbook_id);
  if (!textbook) {
    throw new NotFoundError('Textbook not found');
  }
  const conflictingLog = await db.get(
    'SELECT id FROM study_logs WHERE date = ? AND textbook_id = ? AND id != ?',
    [date, textbook_id, id]
  );
  if (conflictingLog) {
    throw new ConflictError('Another log already exists for this date and textbook');
  }
  await db.run(
    'UPDATE study_logs SET date = ?, textbook_id = ?, planned_amount = ?, actual_amount = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [date, textbook_id, planned_amount || 0, actual_amount || 0, notes || null, id]
  );
  const updatedLog = await db.get(`
    SELECT l.*, t.title as textbook_title, t.subject as textbook_subject
    FROM study_logs l
    JOIN textbooks t ON l.textbook_id = t.id
    WHERE l.id = ?
  `, id);
  if (!updatedLog) throw new Error('Failed to retrieve updated log');
  res.json(updatedLog);
}));

router.delete('/logs/:id', asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const db = getDb();
  const result = await db.run('DELETE FROM study_logs WHERE id = ?', id);
  if (result.changes === 0) {
    throw new NotFoundError('Log not found');
  }
  res.json({ message: 'Log deleted successfully' });
}));

// --- Calculate Study Progress ---
router.get('/progress/:textbookId', asyncHandler(async (req, res, next) => {
  const { textbookId } = req.params;
  const db = getDb();
  const textbook = await db.get('SELECT * FROM textbooks WHERE id = ?', textbookId);
  if (!textbook) {
    throw new NotFoundError('Textbook not found');
  }
  const schedule = await db.get('SELECT * FROM study_schedules WHERE textbook_id = ?', textbookId);
  const totalResult = await db.get(
    'SELECT SUM(actual_amount) as total FROM study_logs WHERE textbook_id = ?',
    textbookId
  );
  const totalSolved = totalResult?.total || 0;
  const progressPercentage = textbook.total_problems > 0
    ? Math.round((totalSolved / textbook.total_problems) * 100)
    : 0;
  const logs = await db.all(
    'SELECT * FROM study_logs WHERE textbook_id = ? ORDER BY date',
    textbookId
  );
  const remainingProblems = Math.max(0, textbook.total_problems - totalSolved);
  let daysRemaining = 0;
  let dailyTarget = 0;
  if (schedule) {
    const today = startOfToday();
    // Ensure schedule dates are valid before parsing
    const endDate = isValid(parseISO(schedule.end_date)) ? parseISO(schedule.end_date) : null;
    if (endDate && isAfter(endDate, today)) { // Only calculate if end date is valid and in the future
        daysRemaining = differenceInDays(endDate, today) + 1 + (schedule.buffer_days || 0);
        dailyTarget = daysRemaining > 0 ? Math.ceil(remainingProblems / daysRemaining) : remainingProblems; // Avoid division by zero
    } else if (endDate && (isBefore(endDate, today) || isEqual(endDate, today))) {
        daysRemaining = 0; // Past or today
        dailyTarget = remainingProblems; // Target is all remaining if past due
    } else {
        // Handle case where schedule end date might be invalid or missing
        console.warn(`Invalid or missing end date for schedule ID ${schedule.id}`);
        daysRemaining = -1; // Indicate invalid/unknown remaining days
        dailyTarget = remainingProblems;
    }
  }
  res.json({
    textbook,
    schedule,
    progress: {
      totalProblems: textbook.total_problems,
      solvedProblems: totalSolved,
      remainingProblems,
      progressPercentage,
      daysRemaining,
      dailyTarget
    },
    logs
  });
}));

// --- Yearly Logs for Activity Calendar ---
router.get('/logs/yearly', asyncHandler(async (req, res, next) => {
  const { year, textbook_id, subject } = req.query;
  const db = getDb();
  const targetYear = year || getYear(new Date()).toString();
  let query = `
    SELECT
      date,
      SUM(actual_amount) as total_amount
    FROM study_logs
    WHERE strftime('%Y', date) = ?
  `;
  const params: any[] = [targetYear];
  if (textbook_id) {
    query += ' AND textbook_id = ?';
    params.push(textbook_id);
  } else if (subject) {
    query += ' AND textbook_id IN (SELECT id FROM textbooks WHERE subject = ?)';
    params.push(subject);
  }
  query += ' GROUP BY date ORDER BY date';
  const logs = await db.all(query, params);
  const subjects = await db.all('SELECT DISTINCT subject FROM textbooks ORDER BY subject');
  const textbooks = await db.all('SELECT id, title, subject FROM textbooks ORDER BY subject, title');
  const totalAmount = logs.reduce((sum, log) => sum + log.total_amount, 0);
  const studyDays = logs.length;
  const maxDay = logs.reduce((max, log) => Math.max(max, log.total_amount), 0);
  const avgPerDay = studyDays > 0 ? Math.round(totalAmount / studyDays) : 0;
  res.json({
    logs,
    statistics: { totalAmount, studyDays, maxDay, avgPerDay },
    filters: { subjects: subjects.map(s => s.subject), textbooks: textbooks }
  });
}));

// --- Anki Integration Routes ---
router.get('/anki/textbooks', asyncHandler(async (req, res, next) => {
  const db = getDb();
  const textbooks = await db.all('SELECT id, title, anki_deck_name FROM textbooks WHERE anki_deck_name IS NOT NULL');
  res.json(textbooks);
}));

router.put('/anki/link/:textbookId', asyncHandler(async (req, res, next) => {
  const { textbookId } = req.params;
  const { deckName } = req.body;
  if (!deckName) {
    throw new BadRequestError('Deck name is required');
  }
  const db = getDb();
  const existing = await db.get('SELECT id FROM textbooks WHERE id = ?', textbookId);
  if (!existing) throw new NotFoundError('Textbook not found');

  await db.run(
    'UPDATE textbooks SET anki_deck_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [deckName, textbookId]
  );
  const updatedTextbook = await db.get('SELECT * FROM textbooks WHERE id = ?', textbookId);
  if (!updatedTextbook) throw new Error('Failed to retrieve updated textbook after linking');
  res.json(updatedTextbook);
}));

// --- Timeline Events Route ---
interface TimelineEventResponse {
  id: string;
  type: 'schedule' | 'exam' | 'mock_exam';
  title: string;
  startDate: string;
  endDate?: string;
  details: StudySchedule | Exam;
}

router.get('/timeline-events', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { startDate: rawStartDate, endDate: rawEndDate } = req.query;

  const parseAndValidateDate = (dateStr: string | undefined | unknown): Date | undefined => {
    if (typeof dateStr !== 'string') return undefined;
    let parsedDate: Date | undefined;
    parsedDate = parse(dateStr, 'yyyy-MM-dd', new Date());
    if (isValid(parsedDate)) return parsedDate;
    parsedDate = parse(dateStr, 'yyyy/MM/dd', new Date());
    if (isValid(parsedDate)) return parsedDate;
    console.warn("Invalid date format received for timeline:", dateStr);
    // Optionally throw BadRequestError if strict validation is needed
    // throw new BadRequestError(`Invalid date format: ${dateStr}. Use YYYY-MM-DD or YYYY/MM/DD.`);
    return undefined;
  };

  const startDate = parseAndValidateDate(rawStartDate);
  const endDate = parseAndValidateDate(rawEndDate);

  const db = getDb();
  const events: TimelineEventResponse[] = [];

  const buildDateQueryParts = (dateColumn: string, alias: string): { whereClause: string, queryParams: string[] } => {
    const conditions: string[] = [];
    const queryParams: string[] = [];
    if (startDate) {
      conditions.push(`${alias}.${dateColumn} >= ?`);
      queryParams.push(format(startDate, 'yyyy-MM-dd'));
    }
    if (endDate) {
      conditions.push(`${alias}.${dateColumn} <= ?`);
      queryParams.push(format(endDate, 'yyyy-MM-dd'));
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, queryParams };
  };

  // Fetch schedules (range overlap)
  const scheduleConditions: string[] = [];
  const scheduleParams: string[] = [];
  if (startDate) {
      scheduleConditions.push(`s.end_date >= ?`);
      scheduleParams.push(format(startDate, 'yyyy-MM-dd'));
  }
  if (endDate) {
      scheduleConditions.push(`s.start_date <= ?`);
      scheduleParams.push(format(endDate, 'yyyy-MM-dd'));
  }
  const scheduleWhereClause = scheduleConditions.length > 0 ? `WHERE ${scheduleConditions.join(' AND ')}` : '';

  const schedules: StudySchedule[] = await db.all(`
    SELECT s.*, t.title as textbook_title, t.subject as textbook_subject
    FROM study_schedules s
    JOIN textbooks t ON s.textbook_id = t.id
    ${scheduleWhereClause}
    ORDER BY s.start_date
  `, scheduleParams);

  schedules.forEach(s => events.push({
    id: `schedule-${s.id}`,
    type: 'schedule',
    title: `${s.textbook_subject}: ${s.textbook_title}`,
    startDate: s.start_date,
    endDate: s.end_date,
    details: s
  }));

  // Fetch exams (unified table)
  const examQueryParts = buildDateQueryParts('date', 'e');
  const allExams: Exam[] = await db.all(`
    SELECT
      e.*,
      u.name as university_name
    FROM exams e
    LEFT JOIN universities u ON e.university_id = u.id
    ${examQueryParts.whereClause}
    ORDER BY e.date
  `, examQueryParts.queryParams);

  allExams.forEach(e => events.push({
    id: `exam-${e.id}`,
    type: e.is_mock ? 'mock_exam' : 'exam',
    title: e.is_mock ? e.name : (e.university_name ? `${e.university_name} ${e.name}` : e.name),
    startDate: e.date,
    details: e
  }));

  // Sort all events by start date
  events.sort((a, b) => {
      // Basic string comparison works for YYYY-MM-DD format
      if (a.startDate < b.startDate) return -1;
      if (a.startDate > b.startDate) return 1;
      // Optional: secondary sort by type or title if dates are the same
      return 0;
  });

  res.json(events);
}));


export default router;
