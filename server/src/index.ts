import 'source-map-support/register.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const envPath = path.resolve(path.dirname(__filename), '../../.env');
console.log('Loading environment variables from:', envPath);
dotenv.config({ path: envPath });

import express, { Request, Response } from 'express';
import compression from 'compression';
import { setupMediaRoutes } from './services/mediaServer.js';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './router.js';
import { errorHandler } from './middleware/errorHandler.js';

// Configuration
const PORT = process.env.PORT || 3000;

// Create Express app
const app = express();

// Middleware
app.use(compression()); // Add this line to enable compression
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Set up API routes
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
