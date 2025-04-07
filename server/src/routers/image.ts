import { z } from 'zod';
import { publicProcedure, router } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { nanoid } from 'nanoid';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { appRouter } from '../router.js'; // Import appRouter to create caller inside mutation
import { createCallerFactory } from '../trpc.js';

const execAsync = promisify(exec);

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
    const command = `magick convert "${tempInputPath}" "${tempOutputPath}"`;
    await execAsync(command, { timeout: 15000 });
    const avifBuffer = await fs.readFile(tempOutputPath);
    if (avifBuffer.length === 0) {
        throw new Error('ImageMagick produced an empty AVIF file.');
    }
    return avifBuffer;
  } catch (error) {
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
    await fs.unlink(tempInputPath).catch(() => {});
    await fs.unlink(tempOutputPath).catch(() => {});
  }
};

const ConvertToAvifInputSchema = z.object({
  base64Data: z.string().min(1, 'Base64 data cannot be empty'),
});

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
             finalFilename = finalFilename.replace(/\.[^/.]+$/, '') + '.avif';
          } catch (conversionError) {
            throw new Error(`AVIF conversion failed: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}`);
          }
        }

        const caller = createCallerFactory(appRouter)({});

        const ankiResponse = await caller.anki.proxy({
          action: 'storeMediaFile',
          params: {
            filename: finalFilename,
            data: uploadData,
          },
        });

        if (ankiResponse && typeof ankiResponse === 'object' && 'error' in ankiResponse && ankiResponse.error) {
           throw new Error(`AnkiConnect error: ${ankiResponse.error}`);
        }

        return { success: true, filename: finalFilename };

      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error during image upload process',
          cause: error,
        });
      }
    }),
});

export type ImageRouter = typeof imageRouter;
