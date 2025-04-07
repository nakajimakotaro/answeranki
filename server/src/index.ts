import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
console.log(__filename);
const envPath = path.resolve(path.dirname(__filename), '../../.env');
console.log('Loading environment variables from:', envPath);
dotenv.config({ path: envPath });

import express, { Request, Response } from 'express';
import { setupMediaRoutes } from './services/mediaServer.js';
import { initDatabase } from './db/database.js';
import { runMigrations } from './db/migrate.js';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './router.js';
import { errorHandler } from './middleware/errorHandler.js';

// Configuration
const PORT = process.env.PORT || 3000;

// Create Express app
const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize database and run migrations
initDatabase()
  .then(() => runMigrations())
  .catch((err: Error) => { // Added type annotation for err
    console.error('Failed to initialize database or run migrations:', err);
    process.exit(1);
  });

// Set up API routes
// setupAnkiConnectProxy(app); // Removed old proxy setup
// setupImageProcessing(app); // Removed old image processing setup
setupMediaRoutes(app); // Add media routes to the main server

// Add tRPC endpoint
app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    // createContext, // Optional: Define context if needed (e.g., for auth)
  }),
);

// --- Error Handling Middleware ---
// This MUST be the last piece of middleware added
app.use(errorHandler);

// Start the unified server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Media server running at http://localhost:${PORT}/media/`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  process.exit(0);
});
