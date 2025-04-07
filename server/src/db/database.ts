import pg from 'pg';

// Load environment variables from .env file in index.ts

const { Pool } = pg;

// Initialize database connection pool
let pool: pg.Pool | null = null;

/**
 * Initialize the database connection pool and create tables if they don't exist
 */
export const initDatabase = async (): Promise<void> => {
  if (pool) {
    console.log('Database pool already initialized.');
    return;
  }
  try {
    // Log the connection string being used
    console.log('Attempting to connect with DATABASE_URL:', process.env.DATABASE_URL);
    // Create a new pool instance using environment variables
    // pg automatically uses PGHOST, PGUSER, PGDATABASE, PGPASSWORD, PGPORT if DATABASE_URL is not set
    // Using DATABASE_URL is generally recommended for simplicity
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Optional: Add SSL configuration if needed for production
      // ssl: {
      //   rejectUnauthorized: false // Adjust as needed for your environment
      // }
    });

    // Test the connection
    await pool.query('SELECT NOW()');
    console.log('Connected to PostgreSQL database');

    // Create tables if they don't exist
    await createTables();

    console.log('Database pool initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

/**
 * Create database tables if they don't exist using PostgreSQL syntax
 */
const createTables = async (): Promise<void> => {
  if (!pool) throw new Error('Database pool not initialized');
  const client = await pool.connect();
  try {
    // Create universities table
    await client.query(`
      CREATE TABLE IF NOT EXISTS universities (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        rank INTEGER,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create textbooks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS textbooks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        total_problems INTEGER NOT NULL DEFAULT 0,
        anki_deck_name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create study_schedules table
    // Note: TEXT for dates might need adjustment depending on usage. Consider DATE type.
    // weekday_goals TEXT might be better as JSONB if structure is complex.
    await client.query(`
      CREATE TABLE IF NOT EXISTS study_schedules (
        id SERIAL PRIMARY KEY,
        textbook_id INTEGER NOT NULL REFERENCES textbooks(id) ON DELETE CASCADE,
        start_date TEXT NOT NULL, -- Consider DATE type
        end_date TEXT NOT NULL,   -- Consider DATE type
        daily_goal INTEGER,
        buffer_days INTEGER DEFAULT 0,
        weekday_goals TEXT, -- Consider JSONB type
        total_problems INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create exams table
    // Note: TEXT for date might need adjustment. Consider DATE type.
    await client.query(`
      CREATE TABLE IF NOT EXISTS exams (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT NOT NULL, -- Consider DATE type
        is_mock BOOLEAN NOT NULL DEFAULT FALSE,
        exam_type TEXT NOT NULL DEFAULT 'descriptive',
        university_id INTEGER REFERENCES universities(id) ON DELETE CASCADE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create exam_scores table
    // Note: REAL type is equivalent to FLOAT4 in PostgreSQL. Consider NUMERIC for precision.
    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_scores (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        note_id INTEGER NOT NULL, -- Assuming this relates to Anki notes, no FK here
        descriptive_score REAL,
        multiple_choice_score REAL,
        total_score REAL,
        max_score REAL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create study_logs table
    // Note: TEXT for date might need adjustment. Consider DATE type.
    await client.query(`
      CREATE TABLE IF NOT EXISTS study_logs (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL, -- Consider DATE type
        textbook_id INTEGER NOT NULL REFERENCES textbooks(id) ON DELETE CASCADE,
        planned_amount INTEGER DEFAULT 0,
        actual_amount INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create subject_scores table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subject_scores (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        exam_type TEXT NOT NULL,
        subject TEXT NOT NULL,
        score REAL,
        max_score REAL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (exam_id, exam_type, subject)
      )
    `);

    console.log('Database tables checked/created successfully');
  } finally {
    client.release(); // Release the client back to the pool
  }
};

/**
 * Get the database pool instance
 */
export const getDbPool = (): pg.Pool => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initDatabase first.');
  }
  return pool;
};

/**
 * Close the database connection pool
 */
export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database connection pool closed');
  }
};
