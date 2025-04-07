import { z } from 'zod';
import { publicProcedure, router } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { nanoid } from 'nanoid';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { callAnkiConnect } from '../services/ankiService.js';

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
      const buffer = Buffer.from(input.base64Data, 'base64');
      const avifBuffer = await convertToAvifWithImageMagick(buffer);
      const avifBase64 = avifBuffer.toString('base64');
      return { success: true, data: avifBase64 };
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

      if (convertToAvif) {
        const inputBuffer = Buffer.from(base64Data, 'base64');
        const avifBuffer = await convertToAvifWithImageMagick(inputBuffer);
        uploadData = avifBuffer.toString('base64');
        finalFilename = finalFilename.replace(/\.[^/.]+$/, '') + '.avif';
      }

      const ankiResponse = await callAnkiConnect({
        action: 'storeMediaFile',
        params: {
          filename: finalFilename,
          data: uploadData,
        },
      });

      if (ankiResponse.error) {
          throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `AnkiConnect failed to store media file: ${ankiResponse.error}`,
          });
      }

      return { success: true, filename: finalFilename };

    }),
});

export type ImageRouter = typeof imageRouter;
