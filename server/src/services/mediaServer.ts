import express from 'express';
import { Express } from 'express';

export let mediaCache: Record<string, string> = {};

export const clearMediaCache = (): void => {
  mediaCache = {};
};

/**
 * Get content type based on file extension
 */
const getContentTypeFromFilename = (filename: string): string => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
};

/**
 * Set up media routes on the main Express app
 */
export const setupMediaRoutes = (app: Express): void => {
  app.get('/media/:filename', async (req, res) => {
    const filename = req.params.filename;
    
    if (!filename) {
      res.status(400).send('Bad Request: No filename specified');
      return;
    }
    
    try {
      if (mediaCache[filename]) {
        const buffer = Buffer.from(mediaCache[filename], 'base64');
        
        const contentType = getContentTypeFromFilename(filename);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.status(200).send(buffer);
        return;
      }
      
      const response = await fetch('http://localhost:8765', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'retrieveMediaFile',
          version: 6,
          params: {
            filename
          }
        })
      });
      
      const data = await response.json() as { result: string, error: string | null };
      
      if (data.error) {
        console.error('AnkiConnect error:', data.error);
        res.status(404).send(`File not found: ${filename}`);
        return;
      }
      
      const base64Data = data.result;
      const buffer = Buffer.from(base64Data, 'base64');
      
      mediaCache[filename] = base64Data;
      
      const contentType = getContentTypeFromFilename(filename);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(buffer);
    } catch (error) {
      console.error('Error retrieving media file:', error);
      res.status(500).send('Internal Server Error');
    }
  });

};
