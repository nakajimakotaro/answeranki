import { Express } from 'express';
import { getDb } from '../db/database.js';

// Subject score types
export interface SubjectScore {
  id: number;
  mock_exam_id: number;
  exam_type: string;
  subject: string;
  score: number | null;
  max_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSubjectScoreData {
  exam_type: string;
  subject: string;
  score: number | null;
  max_score: number | null;
}

/**
 * Set up mock exam API routes
 */
export const setupMockExamApi = (app: Express): void => {
  // Get all mock exams
  app.get('/api/mock-exams', async (req, res) => {
    try {
      const db = getDb();
      const mockExams = await db.all(`
        SELECT * FROM mock_exams
        ORDER BY date DESC
      `);
      
      res.json(mockExams);
    } catch (error) {
      console.error('Failed to get mock exams:', error);
      res.status(500).json({
        error: 'Failed to get mock exams',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get a specific mock exam by ID
  app.get('/api/mock-exams/:id', async (req, res) => {
    try {
      const db = getDb();
      const mockExam = await db.get(`
        SELECT * FROM mock_exams
        WHERE id = ?
      `, req.params.id);
      
      if (!mockExam) {
        return res.status(404).json({
          error: 'Mock exam not found'
        });
      }
      
      res.json(mockExam);
    } catch (error) {
      console.error('Failed to get mock exam:', error);
      res.status(500).json({
        error: 'Failed to get mock exam',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Create a new mock exam
  app.post('/api/mock-exams', async (req, res) => {
    try {
      const { name, date, exam_type, notes } = req.body;
      
      if (!name || !date) {
        return res.status(400).json({
          error: 'Missing required fields: name, date'
        });
      }
      
      const db = getDb();
      const result = await db.run(`
        INSERT INTO mock_exams (name, date, exam_type, notes)
        VALUES (?, ?, ?, ?)
      `, [name, date, exam_type || 'descriptive', notes || null]);
      
      const newMockExam = await db.get(`
        SELECT * FROM mock_exams
        WHERE id = ?
      `, result.lastID);
      
      res.status(201).json(newMockExam);
    } catch (error) {
      console.error('Failed to create mock exam:', error);
      res.status(500).json({
        error: 'Failed to create mock exam',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Update a mock exam
  app.put('/api/mock-exams/:id', async (req, res) => {
    try {
      const { name, date, exam_type, notes } = req.body;
      
      if (!name || !date) {
        return res.status(400).json({
          error: 'Missing required fields: name, date'
        });
      }
      
      const db = getDb();
      await db.run(`
        UPDATE mock_exams
        SET name = ?, date = ?, exam_type = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [name, date, exam_type || 'descriptive', notes || null, req.params.id]);
      
      const updatedMockExam = await db.get(`
        SELECT * FROM mock_exams
        WHERE id = ?
      `, req.params.id);
      
      if (!updatedMockExam) {
        return res.status(404).json({
          error: 'Mock exam not found'
        });
      }
      
      res.json(updatedMockExam);
    } catch (error) {
      console.error('Failed to update mock exam:', error);
      res.status(500).json({
        error: 'Failed to update mock exam',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Delete a mock exam
  app.delete('/api/mock-exams/:id', async (req, res) => {
    try {
      const db = getDb();
      const result = await db.run(`
        DELETE FROM mock_exams
        WHERE id = ?
      `, req.params.id);
      
      if (result.changes === 0) {
        return res.status(404).json({
          error: 'Mock exam not found'
        });
      }
      
      res.json({
        message: 'Mock exam deleted successfully'
      });
    } catch (error) {
      console.error('Failed to delete mock exam:', error);
      res.status(500).json({
        error: 'Failed to delete mock exam',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get scores for a specific mock exam
  app.get('/api/mock-exams/:id/scores', async (req, res) => {
    try {
      const db = getDb();
      const scores = await db.all(`
        SELECT * FROM mock_exam_scores
        WHERE mock_exam_id = ?
        ORDER BY id ASC
      `, req.params.id);
      
      res.json(scores);
    } catch (error) {
      console.error('Failed to get mock exam scores:', error);
      res.status(500).json({
        error: 'Failed to get mock exam scores',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get subject scores for a specific mock exam
  app.get('/api/mock-exams/:id/subject-scores', async (req, res) => {
    try {
      const db = getDb();
      const scores = await db.all(`
        SELECT * FROM mock_exam_subject_scores
        WHERE mock_exam_id = ?
        ORDER BY exam_type, subject ASC
      `, req.params.id);
      
      res.json(scores);
    } catch (error) {
      console.error('Failed to get mock exam subject scores:', error);
      res.status(500).json({
        error: 'Failed to get mock exam subject scores',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Add or update a score for a mock exam
  app.post('/api/mock-exams/:id/scores', async (req, res) => {
    try {
      const { note_id, descriptive_score, multiple_choice_score, total_score, max_score } = req.body;
      
      if (!note_id) {
        return res.status(400).json({
          error: 'Missing required field: note_id'
        });
      }
      
      const db = getDb();
      
      // Check if a score already exists for this note in this mock exam
      const existingScore = await db.get(`
        SELECT * FROM mock_exam_scores
        WHERE mock_exam_id = ? AND note_id = ?
      `, [req.params.id, note_id]);
      
      if (existingScore) {
        // Update existing score
        await db.run(`
          UPDATE mock_exam_scores
          SET descriptive_score = ?, multiple_choice_score = ?, total_score = ?, max_score = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          descriptive_score || null,
          multiple_choice_score || null,
          total_score || null,
          max_score || null,
          existingScore.id
        ]);
        
        const updatedScore = await db.get(`
          SELECT * FROM mock_exam_scores
          WHERE id = ?
        `, existingScore.id);
        
        res.json(updatedScore);
      } else {
        // Create new score
        const result = await db.run(`
          INSERT INTO mock_exam_scores (mock_exam_id, note_id, descriptive_score, multiple_choice_score, total_score, max_score)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          req.params.id,
          note_id,
          descriptive_score || null,
          multiple_choice_score || null,
          total_score || null,
          max_score || null
        ]);
        
        const newScore = await db.get(`
          SELECT * FROM mock_exam_scores
          WHERE id = ?
        `, result.lastID);
        
        res.status(201).json(newScore);
      }
    } catch (error) {
      console.error('Failed to add/update mock exam score:', error);
      res.status(500).json({
        error: 'Failed to add/update mock exam score',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Delete a score from a mock exam
  app.delete('/api/mock-exams/:examId/scores/:scoreId', async (req, res) => {
    try {
      const db = getDb();
      const result = await db.run(`
        DELETE FROM mock_exam_scores
        WHERE id = ? AND mock_exam_id = ?
      `, [req.params.scoreId, req.params.examId]);
      
      if (result.changes === 0) {
        return res.status(404).json({
          error: 'Score not found'
        });
      }
      
      res.json({
        message: 'Score deleted successfully'
      });
    } catch (error) {
      console.error('Failed to delete mock exam score:', error);
      res.status(500).json({
        error: 'Failed to delete mock exam score',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get scores for a specific note across all mock exams
  app.get('/api/notes/:noteId/mock-exam-scores', async (req, res) => {
    try {
      const db = getDb();
      const scores = await db.all(`
        SELECT mes.*, me.name as mock_exam_name, me.date as mock_exam_date
        FROM mock_exam_scores mes
        JOIN mock_exams me ON mes.mock_exam_id = me.id
        WHERE mes.note_id = ?
        ORDER BY me.date DESC
      `, req.params.noteId);
      
      res.json(scores);
    } catch (error) {
      console.error('Failed to get note mock exam scores:', error);
      res.status(500).json({
        error: 'Failed to get note mock exam scores',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Add or update a subject score for a mock exam
  app.post('/api/mock-exams/:id/subject-scores', async (req, res) => {
    try {
      const { exam_type, subject, score, max_score } = req.body;
      
      if (!exam_type || !subject) {
        return res.status(400).json({
          error: 'Missing required fields: exam_type, subject'
        });
      }
      
      const db = getDb();
      
      // Check if a score already exists for this subject in this mock exam
      const existingScore = await db.get(`
        SELECT * FROM mock_exam_subject_scores
        WHERE mock_exam_id = ? AND exam_type = ? AND subject = ?
      `, [req.params.id, exam_type, subject]);
      
      if (existingScore) {
        // Update existing score
        await db.run(`
          UPDATE mock_exam_subject_scores
          SET score = ?, max_score = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          score !== undefined ? score : null,
          max_score !== undefined ? max_score : null,
          existingScore.id
        ]);
        
        const updatedScore = await db.get(`
          SELECT * FROM mock_exam_subject_scores
          WHERE id = ?
        `, existingScore.id);
        
        res.json(updatedScore);
      } else {
        // Create new score
        const result = await db.run(`
          INSERT INTO mock_exam_subject_scores (mock_exam_id, exam_type, subject, score, max_score)
          VALUES (?, ?, ?, ?, ?)
        `, [
          req.params.id,
          exam_type,
          subject,
          score !== undefined ? score : null,
          max_score !== undefined ? max_score : null
        ]);
        
        const newScore = await db.get(`
          SELECT * FROM mock_exam_subject_scores
          WHERE id = ?
        `, result.lastID);
        
        res.status(201).json(newScore);
      }
    } catch (error) {
      console.error('Failed to add/update mock exam subject score:', error);
      res.status(500).json({
        error: 'Failed to add/update mock exam subject score',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Delete a subject score from a mock exam
  app.delete('/api/mock-exams/:examId/subject-scores/:scoreId', async (req, res) => {
    try {
      const db = getDb();
      const result = await db.run(`
        DELETE FROM mock_exam_subject_scores
        WHERE id = ? AND mock_exam_id = ?
      `, [req.params.scoreId, req.params.examId]);
      
      if (result.changes === 0) {
        return res.status(404).json({
          error: 'Subject score not found'
        });
      }
      
      res.json({
        message: 'Subject score deleted successfully'
      });
    } catch (error) {
      console.error('Failed to delete mock exam subject score:', error);
      res.status(500).json({
        error: 'Failed to delete mock exam subject score',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Batch add or update subject scores for a mock exam
  app.post('/api/mock-exams/:id/subject-scores/batch', async (req, res) => {
    try {
      const { scores } = req.body;
      
      if (!Array.isArray(scores) || scores.length === 0) {
        return res.status(400).json({
          error: 'Missing or invalid scores array'
        });
      }
      
      const db = getDb();
      const results = [];
      
      // Start a transaction
      await db.run('BEGIN TRANSACTION');
      
      try {
        for (const scoreData of scores) {
          const { exam_type, subject, score, max_score } = scoreData;
          
          if (!exam_type || !subject) {
            throw new Error('Missing required fields: exam_type, subject');
          }
          
          // Check if a score already exists
          const existingScore = await db.get(`
            SELECT * FROM mock_exam_subject_scores
            WHERE mock_exam_id = ? AND exam_type = ? AND subject = ?
          `, [req.params.id, exam_type, subject]);
          
          let resultId;
          
          if (existingScore) {
            // Update existing score
            await db.run(`
              UPDATE mock_exam_subject_scores
              SET score = ?, max_score = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [
              score !== undefined ? score : null,
              max_score !== undefined ? max_score : null,
              existingScore.id
            ]);
            
            resultId = existingScore.id;
          } else {
            // Create new score
            const result = await db.run(`
              INSERT INTO mock_exam_subject_scores (mock_exam_id, exam_type, subject, score, max_score)
              VALUES (?, ?, ?, ?, ?)
            `, [
              req.params.id,
              exam_type,
              subject,
              score !== undefined ? score : null,
              max_score !== undefined ? max_score : null
            ]);
            
            resultId = result.lastID;
          }
          
          const savedScore = await db.get(`
            SELECT * FROM mock_exam_subject_scores
            WHERE id = ?
          `, resultId);
          
          results.push(savedScore);
        }
        
        // Commit the transaction
        await db.run('COMMIT');
        
        res.status(201).json(results);
      } catch (error) {
        // Rollback the transaction on error
        await db.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Failed to batch add/update mock exam subject scores:', error);
      res.status(500).json({
        error: 'Failed to batch add/update mock exam subject scores',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
};
