import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupMediaRoutes } from './services/mediaServer.js';
import { setupAnkiConnectProxy } from './services/ankiConnectProxy.js';
import { setupImageProcessing } from './services/imageProcessing.js';

// ES modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3000;
const CLIENT_BUILD_PATH = path.join(__dirname, '../../dist');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from the React app
app.use(express.static(CLIENT_BUILD_PATH));

// Set up API routes
setupAnkiConnectProxy(app);
setupImageProcessing(app);
setupMediaRoutes(app); // Add media routes to the main server

// Catch-all route to serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(CLIENT_BUILD_PATH, 'index.html'));
});

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
