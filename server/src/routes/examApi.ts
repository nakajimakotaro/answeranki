import express, { Request, Response, NextFunction } from 'express'; // Added NextFunction
import { getDb } from '../db/database.js'; // Added .js extension
// Import shared types
import { Exam, ExamInput, ExamScore, ExamScoreInput, SubjectScore, SubjectScoreInput, BatchSubjectScoreInput } from '../../../shared/types/exam.js'; // Adjust path as needed
import { NotFoundError, BadRequestError } from '../middleware/errorHandler.js'; // Import custom errors

const router = express.Router();

// Helper function to wrap async route handlers
// This ensures that any uncaught errors are passed to the error handling middleware
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// --- Exam Routes ---

// --- Exam Routes ---

// GET all exams
router.get('/', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const db = getDb();
  const exams: Exam[] = await db.all('SELECT * FROM exams ORDER BY date DESC');
  res.json(exams);
}));

// GET a single exam by ID
router.get('/:id', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const db = getDb();
  const { id } = req.params;
  const exam: Exam | undefined = await db.get('SELECT * FROM exams WHERE id = ?', id);
  if (exam) {
    res.json(exam);
  } else {
    throw new NotFoundError('Exam not found'); // Throw custom error
  }
}));

// POST a new exam
router.post('/', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const db = getDb();
  const { name, date, is_mock, exam_type, university_id, notes } = req.body as ExamInput;

  // Validate input
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new BadRequestError('Exam name is required and cannot be empty');
  }
  if (!date) {
    throw new BadRequestError('Exam date is required');
  }

  const isMockInt = is_mock ? 1 : 0;
  const result = await db.run(
    'INSERT INTO exams (name, date, is_mock, exam_type, university_id, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [name, date, isMockInt, exam_type, university_id ?? null, notes ?? null]
  );
  const newExamId = result.lastID;
  const newExam: Exam | undefined = await db.get('SELECT * FROM exams WHERE id = ?', newExamId);
  if (!newExam) {
      // This case should ideally not happen if insert succeeded, but good to handle
      throw new Error('Failed to retrieve the newly created exam.');
  }
  res.status(201).json(newExam);
}));

// PUT update an existing exam
router.put('/:id', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const db = getDb();
  const { id } = req.params;
  const { name, date, is_mock, exam_type, university_id, notes } = req.body as ExamInput;

  // Validate input
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new BadRequestError('Exam name is required and cannot be empty');
  }
  if (!date) {
    throw new BadRequestError('Exam date is required');
  }

  const existingExam = await db.get('SELECT id FROM exams WHERE id = ?', id); // Check existence first
  if (!existingExam) {
    throw new NotFoundError('Exam not found');
  }

  const isMockInt = is_mock ? 1 : 0;
  await db.run(
    'UPDATE exams SET name = ?, date = ?, is_mock = ?, exam_type = ?, university_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, date, isMockInt, exam_type, university_id ?? null, notes ?? null, id]
  );
  const updatedExam: Exam | undefined = await db.get('SELECT * FROM exams WHERE id = ?', id);
   if (!updatedExam) {
      // This case should ideally not happen if update succeeded on existing ID
      throw new Error('Failed to retrieve the updated exam.');
  }
  res.json(updatedExam);
}));

// DELETE an exam
router.delete('/:id', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const db = getDb();
  const { id } = req.params;

  const existingExam = await db.get('SELECT id FROM exams WHERE id = ?', id);
  if (!existingExam) {
    throw new NotFoundError('Exam not found');
  }

  // Note: Associated scores will be deleted automatically due to ON DELETE CASCADE
  await db.run('DELETE FROM exams WHERE id = ?', id);
  res.json({ message: 'Exam deleted successfully' });
}));


// --- Exam Score Routes ---

// GET scores for a specific exam
router.get('/:examId/scores', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const db = getDb();
  const { examId } = req.params;
  const scores: ExamScore[] = await db.all('SELECT * FROM exam_scores WHERE exam_id = ?', examId);
  res.json(scores);
}));

// POST add or update a score for an exam (based on note_id)
router.post('/:examId/scores', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const db = getDb();
  const { examId } = req.params;
  const { note_id, descriptive_score, multiple_choice_score, total_score, max_score } = req.body as ExamScoreInput;

  if (note_id === undefined) {
    throw new BadRequestError('note_id is required');
  }

  // Check if exam exists (optional, but good practice)
  const examExists = await db.get('SELECT id FROM exams WHERE id = ?', examId);
  if (!examExists) {
      throw new NotFoundError(`Exam with ID ${examId} not found`);
  }

  const existingScore = await db.get(
    'SELECT id FROM exam_scores WHERE exam_id = ? AND note_id = ?',
    [examId, note_id]
  );

  let savedScore;
  if (existingScore) {
    // Update existing score
    await db.run(
      'UPDATE exam_scores SET descriptive_score = ?, multiple_choice_score = ?, total_score = ?, max_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [descriptive_score ?? null, multiple_choice_score ?? null, total_score ?? null, max_score ?? null, existingScore.id]
    );
    savedScore = await db.get<ExamScore>('SELECT * FROM exam_scores WHERE id = ?', existingScore.id);
  } else {
    // Insert new score
    const result = await db.run(
      'INSERT INTO exam_scores (exam_id, note_id, descriptive_score, multiple_choice_score, total_score, max_score) VALUES (?, ?, ?, ?, ?, ?)',
      [examId, note_id, descriptive_score ?? null, multiple_choice_score ?? null, total_score ?? null, max_score ?? null]
    );
    savedScore = await db.get<ExamScore>('SELECT * FROM exam_scores WHERE id = ?', result.lastID);
  }

  if (!savedScore) {
      throw new Error('Failed to retrieve the saved exam score.');
  }
  res.status(existingScore ? 200 : 201).json(savedScore);
}));

// DELETE a specific score
router.delete('/:examId/scores/:scoreId', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const db = getDb();
  const { examId, scoreId } = req.params;

  const existingScore = await db.get('SELECT id FROM exam_scores WHERE id = ? AND exam_id = ?', [scoreId, examId]);
  if (!existingScore) {
    throw new NotFoundError('Score not found for this exam');
  }

  await db.run('DELETE FROM exam_scores WHERE id = ?', scoreId);
  res.json({ message: 'Score deleted successfully' });
}));


// --- Subject Score Routes ---

// GET subject scores for a specific exam
router.get('/:examId/subject-scores', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const db = getDb();
  const { examId } = req.params;
  const scores: SubjectScore[] = await db.all('SELECT * FROM subject_scores WHERE exam_id = ?', examId);
  res.json(scores);
}));

// POST add or update a subject score for an exam
router.post('/:examId/subject-scores', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const db = getDb();
  const { examId } = req.params;
  const { exam_type, subject, score, max_score } = req.body as SubjectScoreInput;

  if (!exam_type || !subject) {
    throw new BadRequestError('exam_type and subject are required');
  }

   // Check if exam exists (optional, but good practice)
  const examExists = await db.get('SELECT id FROM exams WHERE id = ?', examId);
  if (!examExists) {
      throw new NotFoundError(`Exam with ID ${examId} not found`);
  }

  const existingScore = await db.get(
    'SELECT id FROM subject_scores WHERE exam_id = ? AND exam_type = ? AND subject = ?',
    [examId, exam_type, subject]
  );

  let savedScore;
  if (existingScore) {
    // Update
    await db.run(
      'UPDATE subject_scores SET score = ?, max_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [score ?? null, max_score ?? null, existingScore.id]
    );
    savedScore = await db.get<SubjectScore>('SELECT * FROM subject_scores WHERE id = ?', existingScore.id);
  } else {
    // Insert
    const result = await db.run(
      'INSERT INTO subject_scores (exam_id, exam_type, subject, score, max_score) VALUES (?, ?, ?, ?, ?)',
      [examId, exam_type, subject, score ?? null, max_score ?? null]
    );
    savedScore = await db.get<SubjectScore>('SELECT * FROM subject_scores WHERE id = ?', result.lastID);
  }

  if (!savedScore) {
      throw new Error('Failed to retrieve the saved subject score.');
  }
  res.status(existingScore ? 200 : 201).json(savedScore);
}));

// POST batch add or update subject scores
router.post('/:examId/subject-scores/batch', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const db = getDb();
  const { examId } = req.params;
  const { scores } = req.body as BatchSubjectScoreInput;

  if (!Array.isArray(scores)) {
    throw new BadRequestError('Invalid input: scores must be an array');
  }

   // Check if exam exists (optional, but good practice)
  const examExists = await db.get('SELECT id FROM exams WHERE id = ?', examId);
  if (!examExists) {
      throw new NotFoundError(`Exam with ID ${examId} not found`);
  }

  // Use try...finally for transaction rollback
  let transactionStarted = false;
  try {
    await db.exec('BEGIN TRANSACTION');
    transactionStarted = true;

    const results: (SubjectScore | undefined)[] = [];
    for (const item of scores) {
      const { exam_type, subject, score, max_score } = item;

      // Basic validation within the loop
      if (!exam_type || !subject) {
          throw new BadRequestError('Each score item must include exam_type and subject');
      }

      const existingScore = await db.get(
        'SELECT id FROM subject_scores WHERE exam_id = ? AND exam_type = ? AND subject = ?',
        [examId, exam_type, subject]
      );

      let savedScore;
      if (existingScore) {
        await db.run(
          'UPDATE subject_scores SET score = ?, max_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [score, max_score, existingScore.id]
        );
        savedScore = await db.get('SELECT * FROM subject_scores WHERE id = ?', existingScore.id);
      } else {
        const result = await db.run(
          'INSERT INTO subject_scores (exam_id, exam_type, subject, score, max_score) VALUES (?, ?, ?, ?, ?)',
          [examId, exam_type, subject, score, max_score]
        );
        savedScore = await db.get('SELECT * FROM subject_scores WHERE id = ?', result.lastID);
      }
      if (!savedScore) {
          throw new Error(`Failed to retrieve saved score for subject ${subject}`);
      }
      results.push(savedScore);
    }

    await db.exec('COMMIT TRANSACTION');
    transactionStarted = false; // Mark as committed
    res.status(200).json(results);
  } finally {
      // Ensure rollback happens if an error occurred after BEGIN TRANSACTION
      if (transactionStarted) {
          console.error('Rolling back transaction due to error during batch update.');
          await db.exec('ROLLBACK TRANSACTION');
      }
  }
}));


// DELETE a specific subject score
router.delete('/:examId/subject-scores/:scoreId', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const db = getDb();
  const { examId, scoreId } = req.params;

  const existingScore = await db.get('SELECT id FROM subject_scores WHERE id = ? AND exam_id = ?', [scoreId, examId]);
  if (!existingScore) {
    throw new NotFoundError('Subject score not found for this exam');
  }

  await db.run('DELETE FROM subject_scores WHERE id = ?', scoreId);
  res.json({ message: 'Subject score deleted successfully' });
}));


// --- Routes related to Notes ---

// GET exam scores associated with a specific note
router.get('/notes/:noteId/exam-scores', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const db = getDb();
  const { noteId } = req.params;

  // Check if noteId is valid (basic check, adjust if needed)
  if (!noteId || isNaN(Number(noteId))) {
      throw new BadRequestError('Invalid note ID provided.');
  }

  const scores: ExamScore[] = await db.all(`
        SELECT es.*, e.name as exam_name, e.date as exam_date, e.is_mock
        FROM exam_scores es
        JOIN exams e ON es.exam_id = e.id
        WHERE es.note_id = ?
        ORDER BY e.date DESC
    `, noteId);

  // It's okay if scores is an empty array, so no NotFoundError here unless specifically required
  res.json(scores);
}));


export default router;
