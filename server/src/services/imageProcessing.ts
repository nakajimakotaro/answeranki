import { Express } from 'express';
import { nanoid } from 'nanoid';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Converts an image buffer to AVIF format using ImageMagick.
 * @param inputBuffer The input image buffer.
 * @returns A buffer containing the AVIF image data.
 */
const convertToAvifWithImageMagick = async (inputBuffer: Buffer): Promise<Buffer> => {
  const tempInputPath = path.join(os.tmpdir(), `input_${nanoid()}.tmp`);
  const tempOutputPath = path.join(os.tmpdir(), `output_${nanoid()}.avif`);

  try {
    await fs.writeFile(tempInputPath, inputBuffer);

    const command = `magick convert "${tempInputPath}" "${tempOutputPath}"`;

    await execAsync(command, { timeout: 15000 }); // 15 second timeout

    const avifBuffer = await fs.readFile(tempOutputPath);
    return avifBuffer;
  } catch (error) {
    console.error('ImageMagick conversion failed:', error);
    throw new Error(`ImageMagick conversion failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    // Clean up temporary files, ignoring errors
    await fs.unlink(tempInputPath).catch((e) => {
      if (e.code !== 'ENOENT') console.warn(`Failed to delete temporary input file: ${tempInputPath}`, e);
    });
    await fs.unlink(tempOutputPath).catch((e) => {
      if (e.code !== 'ENOENT') console.warn(`Failed to delete temporary output file: ${tempOutputPath}`, e);
    }); // Add missing closing parenthesis and semicolon
  }
};


/**
 * Set up image processing routes
 */
export const setupImageProcessing = (app: Express): void => {
  // Convert image to AVIF format using ImageMagick
  app.post('/api/image/convert-to-avif', async (req, res) => {
    try {
      const { base64Data } = req.body;

      if (!base64Data) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: base64Data'
        });
      }

      const buffer = Buffer.from(base64Data, 'base64');
      const avifBuffer = await convertToAvifWithImageMagick(buffer);
      const avifBase64 = avifBuffer.toString('base64');

      res.json({
        success: true,
        data: avifBase64
      });
    } catch (error) {
      console.error('AVIF conversion error:', error);
      res.status(500).json({
        success: false,
        // Provide a more specific error message if possible
        error: error instanceof Error ? error.message : 'Unknown error during AVIF conversion'
      });
    }
  });

  // Upload image to Anki media folder, converting to AVIF with ImageMagick if requested
  app.post('/api/image/upload', async (req, res) => {
    try {
      const { base64Data, filename, convertToAvif = true } = req.body;

      if (!base64Data || !filename) {
        const missingParams = [!base64Data && 'base64Data', !filename && 'filename'].filter(Boolean);
        return res.status(400).json({
          success: false,
          error: `Missing required parameter(s): ${missingParams.join(', ')}`
        });
      }

      let finalFilename = filename;
      let uploadData = base64Data;
      const inputBuffer = Buffer.from(base64Data, 'base64');

      if (convertToAvif) {
        try {
          const avifBuffer = await convertToAvifWithImageMagick(inputBuffer);
          uploadData = avifBuffer.toString('base64');
          // Ensure filename ends with .avif
          if (!finalFilename.toLowerCase().endsWith('.avif')) {
            finalFilename = finalFilename.replace(/\.[^/.]+$/, '') + '.avif'; // Use regex to handle potential paths
          }
        } catch (conversionError) {
          // If AVIF conversion fails, re-throw the error to be caught by the outer catch block.
          // This adheres to Principle 1: Avoid Naive Fallbacks.
          console.error(`AVIF conversion failed for ${filename}:`, conversionError);
          throw new Error(`AVIF conversion failed: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}`);
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AnkiConnect request failed with status ${response.status}: ${errorText}`);
        // Propagate a meaningful error status and message
        return res.status(response.status >= 500 ? 502 : response.status).json({ // 502 Bad Gateway for server errors
          success: false,
          error: `AnkiConnect request failed: ${response.statusText} - ${errorText}`
        });
      }

      const data = await response.json() as { result?: string | null, error?: string };

      if (data.error) {
        console.error(`AnkiConnect storeMediaFile error for ${finalFilename}: ${data.error}`);
        return res.status(500).json({ // Internal Server Error from AnkiConnect
          success: false,
          error: `AnkiConnect error: ${data.error}`
        });
      }

      // If no error, assume success. AnkiConnect's result for storeMediaFile can be filename or null.
      // No need for complex result checking if data.error is not present.

      res.json({
        success: true,
        filename: finalFilename // Return the actual filename used for upload
      });
    } catch (error) {
      // Catch errors from AVIF conversion, fetch, JSON parsing, etc.
      console.error('Image upload process error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during image upload process'
      });
    }
  });
};
