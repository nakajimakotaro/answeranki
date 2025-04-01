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
    // Write input buffer to a temporary file
    await fs.writeFile(tempInputPath, inputBuffer);

    // Construct the ImageMagick command
    // Use magick convert <input> <output.avif>
    const command = `magick convert "${tempInputPath}" "${tempOutputPath}"`;

    // Execute the command
    // Increase timeout if needed for large images or slow systems
    await execAsync(command, { timeout: 15000 }); // 15 second timeout

    // Read the converted AVIF file
    const avifBuffer = await fs.readFile(tempOutputPath);
    return avifBuffer;
  } catch (error) {
    // Log the detailed error for debugging purposes
    console.error('ImageMagick conversion failed:', error);
    // Throw a generic error indicating conversion failure.
    // The caller should handle this failure appropriately.
    // Specific reasons (e.g., ImageMagick not found, policy issues) should be checked via logs.
    throw new Error(`ImageMagick conversion failed. Details: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    // Clean up temporary files, ignoring errors if files don't exist
    try {
      await fs.unlink(tempInputPath);
    } catch (e: any) {
      // Log deletion errors only if it's not a "file not found" error
      if (e.code !== 'ENOENT') {
        console.warn(`Failed to delete temporary input file: ${tempInputPath}`, e);
      }
    }
    try {
      await fs.unlink(tempOutputPath);
    } catch (e: any) {
      // Log deletion errors only if it's not a "file not found" error
      if (e.code !== 'ENOENT') {
        console.warn(`Failed to delete temporary output file: ${tempOutputPath}`, e);
      }
    }
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

      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');

      // Convert to AVIF using ImageMagick
      const avifBuffer = await convertToAvifWithImageMagick(buffer);

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
        // Provide a more specific error message if possible
        error: error instanceof Error ? error.message : 'Unknown error during AVIF conversion'
      });
    }
  });

  // Upload image to Anki media folder, converting to AVIF with ImageMagick if requested
  app.post('/api/image/upload', async (req, res) => {
    try {
      const { base64Data, filename, convertToAvif = true } = req.body;

      // base64Data と filename は必須とする
      if (!base64Data || !filename) {
        const missingParams = [];
        if (!base64Data) missingParams.push('base64Data');
        if (!filename) missingParams.push('filename');
        return res.status(400).json({
          success: false,
          error: `Missing required parameter(s): ${missingParams.join(', ')}`
        });
      }

      // filename が指定されているので、それを使用する
      let finalFilename = filename;
      let uploadData = base64Data;
      let inputBuffer = Buffer.from(base64Data, 'base64');

      // Convert to AVIF if requested
      if (convertToAvif) {
        // AVIF変換を試みる。失敗した場合は外側のcatchブロックで捕捉され、処理全体がエラーとなる。
        console.log(`Attempting AVIF conversion for ${filename || 'new image'}...`);
        const avifBuffer = await convertToAvifWithImageMagick(inputBuffer);
        uploadData = avifBuffer.toString('base64');
        // Ensure filename ends with .avif
        if (!finalFilename.toLowerCase().endsWith('.avif')) {
           finalFilename = finalFilename.replace(/\.[^.]+$/, '') + '.avif';
        }
        console.log(`AVIF conversion successful. Uploading as ${finalFilename}`);
      } else {
         // AVIF変換をスキップする場合
         console.log(`Skipping AVIF conversion. Uploading original format as ${finalFilename}`);
         // uploadData と finalFilename は変換前の値を使用
      }

      // Upload to AnkiConnect
      console.log(`Uploading ${finalFilename} to AnkiConnect...`);
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

      // Check if response is ok (status 200-299)
      if (!response.ok) {
          const errorText = await response.text();
          console.error(`AnkiConnect request failed with status ${response.status}: ${errorText}`);
          return res.status(response.status).json({
              success: false,
              error: `AnkiConnect request failed: ${response.statusText} - ${errorText}`
          });
      }

      const data = await response.json() as { result?: string | null, error?: string }; // AnkiConnect returns filename on success

      if (data.error) {
         console.error(`AnkiConnect storeMediaFile error for ${finalFilename}: ${data.error}`);
        return res.status(500).json({
          success: false,
          error: `AnkiConnect error: ${data.error}`
        });
      }

       // Check if the result is the filename, indicating success
      if (data.result !== finalFilename) {
          // AnkiConnect might return null on success for storeMediaFile, or the filename.
          // Log a warning if it's neither null nor the expected filename, but don't treat as error unless data.error is set.
          if (data.result !== null) {
              console.warn(`AnkiConnect storeMediaFile result mismatch. Expected ${finalFilename} or null, but received: ${data.result}`);
          } else {
               console.log(`AnkiConnect successfully stored ${finalFilename} (result: null).`);
          }
      } else {
           console.log(`AnkiConnect successfully stored ${finalFilename} (result matches filename).`);
      }


      res.json({
        success: true,
        filename: finalFilename // Return the actual filename used for upload
      });
    } catch (error) {
      // Catch errors from fetch or JSON parsing as well
      console.error('Image upload process error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during image upload process'
      });
    }
  });
};
