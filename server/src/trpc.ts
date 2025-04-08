import { initTRPC } from '@trpc/server';
import superjson from 'superjson'; // Import superjson

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.create({
  /**
   * @see https://trpc.io/docs/v11/data-transformers
   */
  transformer: superjson, // Add superjson transformer
});

/**
 * Create a middleware that logs the request path.
 */
const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;
  console.log(`[${type}] ${path} - ${result.ok ? 'OK' : 'ERR'} (${durationMs}ms)`);
  return result;
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;
// Apply the logger middleware to the public procedure
export const publicProcedure = t.procedure.use(loggerMiddleware);
export const createCallerFactory = t.createCallerFactory;
