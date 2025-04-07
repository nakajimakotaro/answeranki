import { publicProcedure, router } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { clearMediaCache } from '../services/mediaServer.js'; // Import the actual clear function


export const mediaRouter = router({
  /**
   * Clears the server-side media cache.
   */
  clearCache: publicProcedure
    .mutation(async () => {
      clearMediaCache();
      return { success: true, message: 'Media cache cleared successfully.' };
    }),
});

// Export type definition of router for client-side use
export type MediaRouter = typeof mediaRouter;
