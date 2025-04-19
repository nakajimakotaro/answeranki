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
  const status = result.ok ? 'OK' : 'ERR';
  console.log(`[${type}] ${path} - ${status} (${durationMs}ms)`);
  if (!result.ok && result.error) {
    // 詳細なエラー情報を出力
    const { message, code, stack } = result.error;
    console.error(`[tRPC Error] ${type} ${path} - code: ${code}, message: ${message}`);
    if (stack) {
      console.error(stack);
    }
  }
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
