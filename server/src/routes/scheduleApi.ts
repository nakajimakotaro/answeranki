import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// Types
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
}

interface ExamDate {
  id?: number;
  university_id: number;
  exam_date: string;
  exam_type: string;
}

interface StudyLog {
  id?: number;
  date: string;
  textbook_id: number;
  planned_amount?: number;
  actual_amount?: number;
  notes?: string;
}

// University routes
router.get('/universities', async (req, res) => {
  try {
    const db = getDb();
    const universities = await db.all('SELECT * FROM universities ORDER BY rank, name');
    res.json(universities);
  } catch (error) {
    console.error('Error fetching universities:', error);
    res.status(500).json({ error: 'Failed to fetch universities' });
  }
});

router.post('/universities', async (req, res) => {
  try {
    const { name, rank, notes } = req.body as University;
    
    if (!name) {
      return res.status(400).json({ error: 'University name is required' });
    }
    
    const db = getDb();
    const result = await db.run(
      'INSERT INTO universities (name, rank, notes) VALUES (?, ?, ?)',
      [name, rank || null, notes || null]
    );
    
    const newUniversity = await db.get('SELECT * FROM universities WHERE id = ?', result.lastID);
    res.status(201).json(newUniversity);
  } catch (error) {
    console.error('Error creating university:', error);
    res.status(500).json({ error: 'Failed to create university' });
  }
});

router.put('/universities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, rank, notes } = req.body as University;
    
    if (!name) {
      return res.status(400).json({ error: 'University name is required' });
    }
    
    const db = getDb();
    await db.run(
      'UPDATE universities SET name = ?, rank = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, rank || null, notes || null, id]
    );
    
    const updatedUniversity = await db.get('SELECT * FROM universities WHERE id = ?', id);
    
    if (!updatedUniversity) {
      return res.status(404).json({ error: 'University not found' });
    }
    
    res.json(updatedUniversity);
  } catch (error) {
    console.error('Error updating university:', error);
    res.status(500).json({ error: 'Failed to update university' });
  }
});

router.delete('/universities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const result = await db.run('DELETE FROM universities WHERE id = ?', id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'University not found' });
    }
    
    res.json({ message: 'University deleted successfully' });
  } catch (error) {
    console.error('Error deleting university:', error);
    res.status(500).json({ error: 'Failed to delete university' });
  }
});

// Textbook routes
router.get('/textbooks', async (req, res) => {
  try {
    const db = getDb();
    const textbooks = await db.all('SELECT * FROM textbooks ORDER BY subject, title');
    res.json(textbooks);
  } catch (error) {
    console.error('Error fetching textbooks:', error);
    res.status(500).json({ error: 'Failed to fetch textbooks' });
  }
});

router.post('/textbooks', async (req, res) => {
  try {
    const { title, subject, total_problems, anki_deck_name } = req.body as Textbook;
    
    if (!title || !subject) {
      return res.status(400).json({ error: 'Title and subject are required' });
    }
    
    const db = getDb();
    const result = await db.run(
      'INSERT INTO textbooks (title, subject, total_problems, anki_deck_name) VALUES (?, ?, ?, ?)',
      [title, subject, total_problems || 0, anki_deck_name || null]
    );
    
    const newTextbook = await db.get('SELECT * FROM textbooks WHERE id = ?', result.lastID);
    res.status(201).json(newTextbook);
  } catch (error) {
    console.error('Error creating textbook:', error);
    res.status(500).json({ error: 'Failed to create textbook' });
  }
});

router.put('/textbooks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subject, total_problems, anki_deck_name } = req.body as Textbook;
    
    if (!title || !subject) {
      return res.status(400).json({ error: 'Title and subject are required' });
    }
    
    const db = getDb();
    await db.run(
      'UPDATE textbooks SET title = ?, subject = ?, total_problems = ?, anki_deck_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, subject, total_problems || 0, anki_deck_name || null, id]
    );
    
    const updatedTextbook = await db.get('SELECT * FROM textbooks WHERE id = ?', id);
    
    if (!updatedTextbook) {
      return res.status(404).json({ error: 'Textbook not found' });
    }
    
    res.json(updatedTextbook);
  } catch (error) {
    console.error('Error updating textbook:', error);
    res.status(500).json({ error: 'Failed to update textbook' });
  }
});

router.delete('/textbooks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const result = await db.run('DELETE FROM textbooks WHERE id = ?', id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Textbook not found' });
    }
    
    res.json({ message: 'Textbook deleted successfully' });
  } catch (error) {
    console.error('Error deleting textbook:', error);
    res.status(500).json({ error: 'Failed to delete textbook' });
  }
});

// Study Schedule routes
router.get('/schedules', async (req, res) => {
  try {
    const db = getDb();
    const schedules = await db.all(`
      SELECT s.*, t.title as textbook_title, t.subject as textbook_subject
      FROM study_schedules s
      JOIN textbooks t ON s.textbook_id = t.id
      ORDER BY s.start_date
    `);
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

router.post('/schedules', async (req, res) => {
  try {
    const { textbook_id, start_date, end_date, daily_goal, buffer_days, weekday_goals, total_problems } = req.body as StudySchedule;
    
    if (!textbook_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'Textbook ID, start date, and end date are required' });
    }
    
    const db = getDb();
    
    // Check if textbook exists
    const textbook = await db.get('SELECT * FROM textbooks WHERE id = ?', textbook_id);
    if (!textbook) {
      return res.status(404).json({ error: 'Textbook not found' });
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
    
    res.status(201).json(newSchedule);
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

router.put('/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { textbook_id, start_date, end_date, daily_goal, buffer_days, weekday_goals, total_problems } = req.body as StudySchedule;
    
    if (!textbook_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'Textbook ID, start date, and end date are required' });
    }
    
    const db = getDb();
    
    // Check if textbook exists
    const textbook = await db.get('SELECT * FROM textbooks WHERE id = ?', textbook_id);
    if (!textbook) {
      return res.status(404).json({ error: 'Textbook not found' });
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
    
    if (!updatedSchedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    res.json(updatedSchedule);
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

router.delete('/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const result = await db.run('DELETE FROM study_schedules WHERE id = ?', id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// Exam Date routes
router.get('/exams', async (req, res) => {
  try {
    const db = getDb();
    const exams = await db.all(`
      SELECT 
        e.*,
        CASE 
          WHEN e.university_id IS NULL THEN NULL
          ELSE u.name
        END as university_name
      FROM exam_dates e
      LEFT JOIN universities u ON e.university_id = u.id
      ORDER BY e.exam_date
    `);
    res.json(exams);
  } catch (error) {
    console.error('Error fetching exams:', error);
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
});

router.post('/exams', async (req, res) => {
  try {
    const { university_id, exam_date, exam_type } = req.body as ExamDate;
    
    if (!exam_date || !exam_type) {
      return res.status(400).json({ error: 'Exam date and exam type are required' });
    }
    
    const db = getDb();
    
    // Check if university exists if university_id is provided
    if (university_id) {
      const university = await db.get('SELECT * FROM universities WHERE id = ?', university_id);
      if (!university) {
        return res.status(404).json({ error: 'University not found' });
      }
    }
    
    const result = await db.run(
      'INSERT INTO exam_dates (university_id, exam_date, exam_type) VALUES (?, ?, ?)',
      [university_id || null, exam_date, exam_type]
    );
    
    const newExam = await db.get(`
      SELECT 
        e.*,
        CASE 
          WHEN e.university_id IS NULL THEN NULL
          ELSE u.name
        END as university_name
      FROM exam_dates e
      LEFT JOIN universities u ON e.university_id = u.id
      WHERE e.id = ?
    `, result.lastID);
    
    res.status(201).json(newExam);
  } catch (error) {
    console.error('Error creating exam:', error);
    res.status(500).json({ error: 'Failed to create exam' });
  }
});

router.put('/exams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { university_id, exam_date, exam_type } = req.body as ExamDate;
    
    if (!exam_date || !exam_type) {
      return res.status(400).json({ error: 'Exam date and exam type are required' });
    }
    
    const db = getDb();
    
    // Check if university exists if university_id is provided
    if (university_id) {
      const university = await db.get('SELECT * FROM universities WHERE id = ?', university_id);
      if (!university) {
        return res.status(404).json({ error: 'University not found' });
      }
    }
    
    await db.run(
      'UPDATE exam_dates SET university_id = ?, exam_date = ?, exam_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [university_id || null, exam_date, exam_type, id]
    );
    
    const updatedExam = await db.get(`
      SELECT 
        e.*,
        CASE 
          WHEN e.university_id IS NULL THEN NULL
          ELSE u.name
        END as university_name
      FROM exam_dates e
      LEFT JOIN universities u ON e.university_id = u.id
      WHERE e.id = ?
    `, id);
    
    if (!updatedExam) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    
    res.json(updatedExam);
  } catch (error) {
    console.error('Error updating exam:', error);
    res.status(500).json({ error: 'Failed to update exam' });
  }
});

router.delete('/exams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const result = await db.run('DELETE FROM exam_dates WHERE id = ?', id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    
    res.json({ message: 'Exam deleted successfully' });
  } catch (error) {
    console.error('Error deleting exam:', error);
    res.status(500).json({ error: 'Failed to delete exam' });
  }
});

// Study Log routes
router.get('/logs', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

router.post('/logs', async (req, res) => {
  try {
    const { date, textbook_id, planned_amount, actual_amount, notes } = req.body as StudyLog;
    
    if (!date || !textbook_id) {
      return res.status(400).json({ error: 'Date and textbook ID are required' });
    }
    
    const db = getDb();
    
    // Check if textbook exists
    const textbook = await db.get('SELECT * FROM textbooks WHERE id = ?', textbook_id);
    if (!textbook) {
      return res.status(404).json({ error: 'Textbook not found' });
    }
    
    // Check if log already exists for this date and textbook
    const existingLog = await db.get(
      'SELECT * FROM study_logs WHERE date = ? AND textbook_id = ?',
      [date, textbook_id]
    );
    
    if (existingLog) {
      return res.status(409).json({ 
        error: 'A log already exists for this date and textbook',
        existingLog
      });
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
    
    res.status(201).json(newLog);
  } catch (error) {
    console.error('Error creating log:', error);
    res.status(500).json({ error: 'Failed to create log' });
  }
});

router.put('/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, textbook_id, planned_amount, actual_amount, notes } = req.body as StudyLog;
    
    if (!date || !textbook_id) {
      return res.status(400).json({ error: 'Date and textbook ID are required' });
    }
    
    const db = getDb();
    
    // Check if textbook exists
    const textbook = await db.get('SELECT * FROM textbooks WHERE id = ?', textbook_id);
    if (!textbook) {
      return res.status(404).json({ error: 'Textbook not found' });
    }
    
    // Check if log already exists for this date and textbook (excluding this log)
    const existingLog = await db.get(
      'SELECT * FROM study_logs WHERE date = ? AND textbook_id = ? AND id != ?',
      [date, textbook_id, id]
    );
    
    if (existingLog) {
      return res.status(409).json({ 
        error: 'Another log already exists for this date and textbook',
        existingLog
      });
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
    
    if (!updatedLog) {
      return res.status(404).json({ error: 'Log not found' });
    }
    
    res.json(updatedLog);
  } catch (error) {
    console.error('Error updating log:', error);
    res.status(500).json({ error: 'Failed to update log' });
  }
});

router.delete('/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const result = await db.run('DELETE FROM study_logs WHERE id = ?', id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }
    
    res.json({ message: 'Log deleted successfully' });
  } catch (error) {
    console.error('Error deleting log:', error);
    res.status(500).json({ error: 'Failed to delete log' });
  }
});

// Calculate study progress
router.get('/progress/:textbookId', async (req, res) => {
  try {
    const { textbookId } = req.params;
    const db = getDb();
    
    // Get textbook details
    const textbook = await db.get('SELECT * FROM textbooks WHERE id = ?', textbookId);
    
    if (!textbook) {
      return res.status(404).json({ error: 'Textbook not found' });
    }
    
    // Get schedule for this textbook
    const schedule = await db.get('SELECT * FROM study_schedules WHERE textbook_id = ?', textbookId);
    
    // Get total actual problems solved
    const totalResult = await db.get(
      'SELECT SUM(actual_amount) as total FROM study_logs WHERE textbook_id = ?',
      textbookId
    );
    
    const totalSolved = totalResult?.total || 0;
    
    // Calculate progress percentage
    const progressPercentage = textbook.total_problems > 0 
      ? Math.round((totalSolved / textbook.total_problems) * 100) 
      : 0;
    
    // Get daily logs
    const logs = await db.all(
      'SELECT * FROM study_logs WHERE textbook_id = ? ORDER BY date',
      textbookId
    );
    
    // Calculate remaining problems and days
    const remainingProblems = Math.max(0, textbook.total_problems - totalSolved);
    
    let daysRemaining = 0;
    let dailyTarget = 0;
    
    if (schedule) {
      const today = new Date();
      const endDate = new Date(schedule.end_date);
      
      // Calculate days remaining (including buffer)
      const diffTime = endDate.getTime() - today.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + (schedule.buffer_days || 0);
      
      // Calculate daily target
      dailyTarget = daysRemaining > 0 ? Math.ceil(remainingProblems / daysRemaining) : remainingProblems;
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
  } catch (error) {
    console.error('Error calculating progress:', error);
    res.status(500).json({ error: 'Failed to calculate progress' });
  }
});

// Yearly logs for activity calendar
router.get('/logs/yearly', async (req, res) => {
  try {
    const { year, textbook_id, subject } = req.query;
    const db = getDb();
    
    // Default to current year if not specified
    const targetYear = year || new Date().getFullYear().toString();
    
    // Base query for all logs in the year
    let query = `
      SELECT 
        date, 
        SUM(actual_amount) as total_amount
      FROM study_logs
      WHERE strftime('%Y', date) = ?
    `;
    
    const params: any[] = [targetYear];
    
    // Add filters if provided
    if (textbook_id) {
      query += ' AND textbook_id = ?';
      params.push(textbook_id);
    } else if (subject) {
      query += ' AND textbook_id IN (SELECT id FROM textbooks WHERE subject = ?)';
      params.push(subject);
    }
    
    // Group by date and order chronologically
    query += ' GROUP BY date ORDER BY date';
    
    const logs = await db.all(query, params);
    
    // Get list of all subjects for filtering
    const subjects = await db.all('SELECT DISTINCT subject FROM textbooks ORDER BY subject');
    
    // Get list of all textbooks for filtering
    const textbooks = await db.all('SELECT id, title, subject FROM textbooks ORDER BY subject, title');
    
    // Calculate statistics
    const totalAmount = logs.reduce((sum, log) => sum + log.total_amount, 0);
    const studyDays = logs.length;
    const maxDay = logs.reduce((max, log) => Math.max(max, log.total_amount), 0);
    const avgPerDay = studyDays > 0 ? Math.round(totalAmount / studyDays) : 0;
    
    res.json({
      logs,
      statistics: {
        totalAmount,
        studyDays,
        maxDay,
        avgPerDay
      },
      filters: {
        subjects: subjects.map(s => s.subject),
        textbooks: textbooks
      }
    });
  } catch (error) {
    console.error('Error fetching yearly logs:', error);
    res.status(500).json({ error: 'Failed to fetch yearly logs' });
  }
});

// Anki integration routes
router.get('/anki/textbooks', async (req, res) => {
  try {
    const db = getDb();
    const textbooks = await db.all('SELECT id, title, anki_deck_name FROM textbooks WHERE anki_deck_name IS NOT NULL');
    res.json(textbooks);
  } catch (error) {
    console.error('Error fetching Anki-linked textbooks:', error);
    res.status(500).json({ error: 'Failed to fetch Anki-linked textbooks' });
  }
});

router.put('/anki/link/:textbookId', async (req, res) => {
  try {
    const { textbookId } = req.params;
    const { deckName } = req.body;
    
    if (!deckName) {
      return res.status(400).json({ error: 'Deck name is required' });
    }
    
    const db = getDb();
    
    // Update textbook with Anki deck name
    await db.run(
      'UPDATE textbooks SET anki_deck_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [deckName, textbookId]
    );
    
    const updatedTextbook = await db.get('SELECT * FROM textbooks WHERE id = ?', textbookId);
    
    if (!updatedTextbook) {
      return res.status(404).json({ error: 'Textbook not found' });
    }
    
    res.json(updatedTextbook);
  } catch (error) {
    console.error('Error linking textbook to Anki deck:', error);
    res.status(500).json({ error: 'Failed to link textbook to Anki deck' });
  }
});

export default router;
