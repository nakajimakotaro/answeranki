import { getDb, initDatabase } from './database.js';

/**
 * Run database migrations
 */
export const runMigrations = async (): Promise<void> => {
  const db = getDb();
  
  try {
    // Check if mock_exam_subject_scores table exists
    const tableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='mock_exam_subject_scores'"
    );
    
    if (!tableExists) {
      console.log('Creating mock_exam_subject_scores table...');
      
      // Create mock_exam_subject_scores table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS mock_exam_subject_scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mock_exam_id INTEGER NOT NULL,
          exam_type TEXT NOT NULL,
          subject TEXT NOT NULL,
          score REAL,
          max_score REAL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (mock_exam_id) REFERENCES mock_exams (id) ON DELETE CASCADE
        )
      `);
      
      console.log('mock_exam_subject_scores table created successfully');
    } else {
      console.log('mock_exam_subject_scores table already exists');
    }
    
    // Check if exam_type column exists in mock_exams table
    const columnInfo = await db.get(
      "PRAGMA table_info(mock_exams)"
    );
    
    const columns = await db.all("PRAGMA table_info(mock_exams)");
    const hasExamTypeColumn = columns.some(col => col.name === 'exam_type');
    
    if (!hasExamTypeColumn) {
      console.log('Adding exam_type column to mock_exams table...');
      
      // Add exam_type column to mock_exams table
      await db.exec(`
        ALTER TABLE mock_exams
        ADD COLUMN exam_type TEXT NOT NULL DEFAULT 'descriptive'
      `);
      
      console.log('exam_type column added to mock_exams table successfully');
    } else {
      console.log('exam_type column already exists in mock_exams table');
    }
    
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
};

// Run migrations if this file is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  (async () => {
    try {
      // Initialize the database first
      await initDatabase();
      await runMigrations();
      console.log('Migrations completed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  })();
}
