import { Express } from 'express';
import sharp from 'sharp';
import { nanoid } from 'nanoid';
import fetch from 'node-fetch';

// Default AVIF conversion quality
const DEFAULT_AVIF_QUALITY = 80;

/**
 * Set up image processing routes
 */
export const setupImageProcessing = (app: Express): void => {
  // Convert image to AVIF format
  app.post('/api/image/convert-to-avif', async (req, res) => {
    try {
      const { base64Data, quality = DEFAULT_AVIF_QUALITY } = req.body;
      
      if (!base64Data) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: base64Data'
        });
      }
      
      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Convert to AVIF using sharp
      const avifBuffer = await sharp(buffer)
        .avif({
          quality: Math.min(Math.max(quality, 1), 100) // Ensure quality is between 1-100
        })
        .toBuffer();
      
      // Convert back to base64
      const avifBase64 = avifBuffer.toString('base64');
      
      res.json({
        success: true,
        data: avifBase64
      });
    } catch (error) {
      console.error('AVIF conversion error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Upload image to Anki media folder
  app.post('/api/image/upload', async (req, res) => {
    try {
      const { base64Data, filename, convertToAvif = true } = req.body;
      
      if (!base64Data) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: base64Data'
        });
      }
      
      // Generate unique filename if not provided
      const uniqueId = nanoid(10);
      let finalFilename = filename || `answer_${uniqueId}.jpg`;
      let uploadData = base64Data;
      
      // Convert to AVIF if requested
      if (convertToAvif) {
        try {
          // Convert to AVIF using sharp
          const buffer = Buffer.from(base64Data, 'base64');
          const avifBuffer = await sharp(buffer)
            .avif({ quality: DEFAULT_AVIF_QUALITY })
            .toBuffer();
          
          uploadData = avifBuffer.toString('base64');
          finalFilename = finalFilename.replace(/\.[^.]+$/, '.avif');
        } catch (conversionError) {
          console.error('AVIF conversion failed, using original format:', conversionError);
        }
      }
      
      // Upload to AnkiConnect
      const response = await fetch('http://localhost:8765', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'storeMediaFile',
          version: 6,
          params: {
            filename: finalFilename,
            data: uploadData
          }
        })
      });
      
      const data = await response.json() as { result?: null, error?: string };
      
      if (data.error) {
        return res.status(500).json({
          success: false,
          error: data.error
        });
      }
      
      res.json({
        success: true,
        filename: finalFilename
      });
    } catch (error) {
      console.error('Image upload error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
};
