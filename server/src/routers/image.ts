import { z } from 'zod';
import { publicProcedure, router } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { nanoid } from 'nanoid';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
// import fetch from 'node-fetch'; // No longer needed for direct call
// import { serverCaller } from '../router.js'; // REMOVED: Avoid circular dependency
import { appRouter } from '../router.js'; // Import appRouter to create caller inside mutation
import { createCallerFactory } from '../trpc.js'; // Import factory from trpc

const execAsync = promisify(exec);

// AnkiConnect configuration (duplicate from anki.ts, consider centralizing)
const ANKI_CONNECT_URL = 'http://localhost:8765';
const ANKI_CONNECT_VERSION = 6;

/**
 * Converts an image buffer to AVIF format using ImageMagick.
 * @param inputBuffer The input image buffer.
 * @returns A buffer containing the AVIF image data.
 * @throws Throws an error if conversion fails.
 */
const convertToAvifWithImageMagick = async (inputBuffer: Buffer): Promise<Buffer> => {
  const tempInputPath = path.join(os.tmpdir(), `input_${nanoid()}.tmp`);
  const tempOutputPath = path.join(os.tmpdir(), `output_${nanoid()}.avif`);

  try {
    await fs.writeFile(tempInputPath, inputBuffer);
    // Ensure ImageMagick command exists and is configured correctly in the environment
    const command = `magick convert "${tempInputPath}" "${tempOutputPath}"`;
    await execAsync(command, { timeout: 15000 }); // 15 second timeout
    const avifBuffer = await fs.readFile(tempOutputPath);
    if (avifBuffer.length === 0) {
        throw new Error('ImageMagick produced an empty AVIF file.');
    }
    return avifBuffer;
  } catch (error) {
    console.error('ImageMagick conversion failed:', error);
    // Provide a more specific error message
    let errorMessage = 'ImageMagick conversion failed.';
    if (error instanceof Error) {
        if (error.message.includes('command not found') || error.message.includes('not recognized')) {
            errorMessage = 'ImageMagick command not found. Please ensure ImageMagick is installed and in the system PATH.';
        } else if (error.message.includes('timeout')) {
            errorMessage = 'ImageMagick conversion timed out (15 seconds).';
        } else {
            errorMessage = `ImageMagick conversion failed: ${error.message}`;
        }
    } else {
        errorMessage = `ImageMagick conversion failed: ${String(error)}`;
    }
    throw new Error(errorMessage);
  } finally {
    // Clean up temporary files, ignoring errors
    await fs.unlink(tempInputPath).catch(() => {});
    await fs.unlink(tempOutputPath).catch(() => {});
  }
};

// Input schema for convertToAvif mutation
const ConvertToAvifInputSchema = z.object({
  base64Data: z.string().min(1, 'Base64 data cannot be empty'),
});

// Input schema for uploadToAnki mutation
const UploadToAnkiInputSchema = z.object({
  base64Data: z.string().min(1, 'Base64 data cannot be empty'),
  filename: z.string().min(1, 'Filename cannot be empty'),
  convertToAvif: z.boolean().optional().default(true),
});

export const imageRouter = router({
  /**
   * Converts base64 image data to AVIF format using ImageMagick.
   */
  convertToAvif: publicProcedure
    .input(ConvertToAvifInputSchema)
    .mutation(async ({ input }) => {
      try {
        const buffer = Buffer.from(input.base64Data, 'base64');
        const avifBuffer = await convertToAvifWithImageMagick(buffer);
        const avifBase64 = avifBuffer.toString('base64');
        return { success: true, data: avifBase64 };
      } catch (error) {
        console.error('convertToAvif tRPC error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error during AVIF conversion',
          cause: error,
        });
      }
    }),

  /**
   * Uploads an image to Anki's media folder.
   * Optionally converts the image to AVIF before uploading.
   */
  uploadToAnki: publicProcedure
    .input(UploadToAnkiInputSchema)
    .mutation(async ({ input }) => {
      const { base64Data, filename, convertToAvif } = input;
      let finalFilename = filename;
      let uploadData = base64Data;

      try {
        if (convertToAvif) {
          try {
            const inputBuffer = Buffer.from(base64Data, 'base64');
            const avifBuffer = await convertToAvifWithImageMagick(inputBuffer);
            uploadData = avifBuffer.toString('base64');
            // Ensure filename ends with .avif
             finalFilename = finalFilename.replace(/\.[^/.]+$/, '') + '.avif';
          } catch (conversionError) {
            // Re-throw conversion errors to be caught by the main try-catch
            console.error(`AVIF conversion failed for ${filename}, proceeding with original format might be an option if desired, but currently failing.`, conversionError);
            throw new Error(`AVIF conversion failed: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}`);
          }
        }

        // Create the caller inside the mutation to avoid circular dependency
        const caller = createCallerFactory(appRouter)({}); // Assuming no context needed here

        // Call the anki.proxy mutation using the dynamically created caller
        const ankiResponse = await caller.anki.proxy({
          action: 'storeMediaFile',
          params: {
            filename: finalFilename,
            data: uploadData,
          },
        });

        // Check for errors returned by the anki.proxy procedure
        // (The proxy procedure already handles TRPCError wrapping)
        if (ankiResponse && typeof ankiResponse === 'object' && 'error' in ankiResponse && ankiResponse.error) {
           // Re-throw the error message from the proxy response
           throw new Error(`AnkiConnect error: ${ankiResponse.error}`);
        }

        // storeMediaFile returns the filename on success, null/error otherwise.
        // If no error was thrown by the proxy or reported in the response, assume success.
        return { success: true, filename: finalFilename };

      } catch (error) {
        console.error('uploadToAnki tRPC error:', error);
        // Handle errors from conversion or the Anki proxy call
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error during image upload process',
          cause: error,
        });
      }
    }),
});

// Export type definition of router for client-side use
export type ImageRouter = typeof imageRouter;
