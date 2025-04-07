import { z } from 'zod';
import { publicProcedure, router } from '../trpc.js';
import { TRPCError } from '@trpc/server';

const ANKI_CONNECT_URL = 'http://localhost:8765';
const ANKI_CONNECT_VERSION = 6;

const ankiProxyInputSchema = z.object({
  action: z.string(),
  params: z.record(z.unknown()).optional().default({}),
});

export const ankiRouter = router({
  proxy: publicProcedure
    .input(ankiProxyInputSchema)
    .mutation(async ({ input }: { input: z.infer<typeof ankiProxyInputSchema> }) => {
      try {
        const ankiRequest = {
          action: input.action,
          version: ANKI_CONNECT_VERSION,
          params: input.params,
        };

        // Use built-in fetch
        const response = await fetch(ANKI_CONNECT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ankiRequest),
        });

        if (!response.ok) {
          // Try to parse error from AnkiConnect response
          let errorDetails = `AnkiConnect request failed with status ${response.status}`;
          try {
            const errorData = await response.json() as { error?: string };
            if (errorData.error) {
              errorDetails = errorData.error;
            }
          } catch (parseError) {
            // Ignore if response is not JSON
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to communicate with AnkiConnect: ${errorDetails}`,
          });
        }

        const data = await response.json();
        return data;

      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        // Handle network errors or other unexpected issues
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('ECONNREFUSED')) {
           throw new TRPCError({
             code: 'INTERNAL_SERVER_ERROR',
             message: 'Failed to connect to AnkiConnect. Is Anki running with AnkiConnect installed?',
             cause: error,
           });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while contacting AnkiConnect.',
          cause: error,
        });
      }
    }),

  testConnection: publicProcedure.query(async () => {
    try {
      const response = await fetch(ANKI_CONNECT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'version',
          version: ANKI_CONNECT_VERSION,
        }),
      });

      // Check if the response status indicates success (e.g., 200 OK)
      if (!response.ok) {
         // Handle non-OK responses (like 404, 500, etc.)
         throw new Error(`AnkiConnect returned status ${response.status}`);
      }

      const data = await response.json() as { result?: number; error?: string };

      if (data.error) {
        // AnkiConnect itself reported an error
        return { connected: false, error: data.error, version: null };
      }

      const isConnected = data.result === ANKI_CONNECT_VERSION;
      return {
        connected: isConnected,
        version: data.result ?? null,
        error: isConnected ? null : `AnkiConnect version mismatch or invalid response. Expected ${ANKI_CONNECT_VERSION}, got ${data.result ?? 'N/A'}`,
      };
    } catch (error) {
       const message = error instanceof Error ? error.message : String(error);
       let errorMessage = 'Failed to connect to AnkiConnect.';
       if (message.includes('ECONNREFUSED')) {
         errorMessage = 'Failed to connect to AnkiConnect. Is Anki running with AnkiConnect installed?';
       } else if (message.includes('AnkiConnect returned status')) {
           errorMessage = `AnkiConnect connection test failed: ${message}`;
       }

      return {
        connected: false,
        error: errorMessage,
        version: null,
      };
    }
  }),
});

export type AnkiRouter = typeof ankiRouter;
