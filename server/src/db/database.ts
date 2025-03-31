import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

// ES modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path
const DB_PATH = path.join(__dirname, '../../study_data.sqlite');

// Initialize database connection
let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

/**
 * Initialize the database connection and create tables if they don't exist
 */
export const initDatabase = async (): Promise<void> => {
  try {
    // Open database connection
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });
    
    console.log('Connected to SQLite database');
    
    // Enable foreign keys
    await db.exec('PRAGMA foreign_keys = ON');
    
    // Create tables if they don't exist
    await createTables();
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

/**
 * Create database tables if they don't exist
 */
const createTables = async (): Promise<void> => {
  if (!db) throw new Error('Database not initialized');
  
  // Create universities table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS universities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rank INTEGER,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create textbooks table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS textbooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      total_problems INTEGER NOT NULL DEFAULT 0,
      anki_deck_name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create study_schedules table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS study_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      textbook_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      daily_goal INTEGER,
      buffer_days INTEGER DEFAULT 0,
      weekday_goals TEXT,
      total_problems INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (textbook_id) REFERENCES textbooks (id) ON DELETE CASCADE
    )
  `);
  
  // Create exam_dates table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS exam_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      university_id INTEGER NOT NULL,
      exam_date TEXT NOT NULL,
      exam_type TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (university_id) REFERENCES universities (id) ON DELETE CASCADE
    )
  `);
  
  // Create mock_exams table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS mock_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      exam_type TEXT NOT NULL DEFAULT 'descriptive',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create mock_exam_scores table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS mock_exam_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mock_exam_id INTEGER NOT NULL,
      note_id INTEGER NOT NULL,
      descriptive_score REAL,
      multiple_choice_score REAL,
      total_score REAL,
      max_score REAL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mock_exam_id) REFERENCES mock_exams (id) ON DELETE CASCADE
    )
  `);
  
  // Create study_logs table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS study_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      textbook_id INTEGER NOT NULL,
      planned_amount INTEGER DEFAULT 0,
      actual_amount INTEGER DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (textbook_id) REFERENCES textbooks (id) ON DELETE CASCADE
    )
  `);
  
  console.log('Database tables created successfully');
};

/**
 * Get the database instance
 */
export const getDb = (): Database<sqlite3.Database, sqlite3.Statement> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

/**
 * Close the database connection
 */
export const closeDatabase = async (): Promise<void> => {
  if (db) {
    await db.close();
    db = null;
    console.log('Database connection closed');
  }
};
