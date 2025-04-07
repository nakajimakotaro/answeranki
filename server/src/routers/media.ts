import { publicProcedure, router } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { clearMediaCache } from '../services/mediaServer.js'; // Import the actual clear function


export const mediaRouter = router({
  /**
   * Clears the server-side media cache.
   */
  clearCache: publicProcedure
    .mutation(async () => {
      try {
        // Call the imported function to clear the shared cache
        clearMediaCache();
        return { success: true, message: 'Media cache cleared successfully.' };
      } catch (error) {
        console.error('Failed to clear media cache via tRPC:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to clear media cache.',
          cause: error,
        });
      }
    }),
});

// Export type definition of router for client-side use
export type MediaRouter = typeof mediaRouter;
