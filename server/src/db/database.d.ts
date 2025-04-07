import sqlite3 from 'sqlite3';
import { Database } from 'sqlite';
/**
 * Initialize the database connection and create tables if they don't exist
 */
export declare const initDatabase: () => Promise<void>;
/**
 * Get the database instance
 */
export declare const getDb: () => Database<sqlite3.Database, sqlite3.Statement>;
/**
 * Close the database connection
 */
export declare const closeDatabase: () => Promise<void>;
//# sourceMappingURL=database.d.ts.map