import { z } from 'zod';
import { publicProcedure, router } from '../trpc.js';
import { callAnkiConnect } from '../services/ankiService.js';

const ankiProxyInputSchema = z.object({
  action: z.string(),
  params: z.record(z.unknown()).optional().default({}),
});

export const ankiRouter = router({
  proxy: publicProcedure
    .input(ankiProxyInputSchema)
    .mutation(async ({ input }) => {
      const data = await callAnkiConnect(input);
      return data;
    }),

  testConnection: publicProcedure.query(async (): Promise<{ connected: boolean; version: number | null; error: string | null; }> => {
    try {
      const data = await callAnkiConnect<{ version?: number }>({ action: 'version' });

      if (data.error) {
        return { connected: false, error: `AnkiConnect error: ${data.error}`, version: null };
      }

      if (typeof data.result !== 'number') {
          throw new Error('Invalid response format from AnkiConnect version check.');
      }

      const expectedVersion = 6;
      const isConnected = data.result === expectedVersion;

      return {
        connected: isConnected,
        version: data.result,
        error: isConnected ? null : `AnkiConnect version mismatch or invalid response. Expected ${expectedVersion}, got ${data.result}`,
      };
    } catch (error) {
       const message = error instanceof Error ? error.message : String(error);
       let errorMessage = `Failed to connect to AnkiConnect: ${message}`;

      return {
        connected: false,
        error: errorMessage,
        version: null,
      };
    }
  }),
});

export type AnkiRouter = typeof ankiRouter;
