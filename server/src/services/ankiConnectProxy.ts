import { Express } from 'express';
import fetch from 'node-fetch';

// AnkiConnect configuration
const ANKI_CONNECT_URL = 'http://localhost:8765';
const ANKI_CONNECT_VERSION = 6;

/**
 * Set up AnkiConnect proxy routes
 */
export const setupAnkiConnectProxy = (app: Express): void => {
  // Proxy all AnkiConnect requests
  app.post('/api/anki', async (req, res) => {
    try {
      const { action, params } = req.body;
      
      if (!action) {
        return res.status(400).json({
          error: 'Missing required parameter: action'
        });
      }
      
      // Construct AnkiConnect request
      const ankiRequest = {
        action,
        version: ANKI_CONNECT_VERSION,
        params: params || {}
      };
      
      // Forward request to AnkiConnect
      const response = await fetch(ANKI_CONNECT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ankiRequest)
      });
      
      // Get response data
      const data = await response.json();
      
      // Return response to client
      res.json(data);
    } catch (error) {
      console.error('AnkiConnect proxy error:', error);
      res.status(500).json({
        error: 'Failed to communicate with AnkiConnect',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Test connection endpoint
  app.get('/api/anki/test', async (req, res) => {
    try {
      const response = await fetch(ANKI_CONNECT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'version',
          version: ANKI_CONNECT_VERSION
        })
      });
      
      const data = await response.json() as { result?: number, error?: string };
      
      if (data.error) {
        return res.status(500).json({
          connected: false,
          error: data.error
        });
      }
      
      res.json({
        connected: data.result === ANKI_CONNECT_VERSION,
        version: data.result
      });
    } catch (error) {
      console.error('AnkiConnect connection test error:', error);
      res.status(500).json({
        connected: false,
        error: 'Failed to connect to AnkiConnect',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
};
