import { router, createCallerFactory } from './trpc.js'; // Import createCallerFactory
import { universityRouter } from './routers/university.js'; // Use .js extension
import { ankiRouter } from './routers/anki.js'; // Import the new Anki router
import { imageRouter } from './routers/image.js'; // Import the new Image router
import { mediaRouter } from './routers/media.js'; // Import the new Media router
// Import other routers here as they are created
import { textbookRouter } from './routers/textbook.js'; // Re-added .js
import { scheduleRouter } from './routers/schedule.js'; // Use .js extension
// import { logRouter } from './routers/log.js'; // Assuming logs are part of scheduleRouter now
import { examRouter } from './routers/exam.js'; // Re-added .js

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = router({
  university: universityRouter,
  textbook: textbookRouter,
  schedule: scheduleRouter, // Enable schedule router
  // log: logRouter, // Remove if logs are handled by scheduleRouter
  exam: examRouter,
  anki: ankiRouter, // Add the anki router
  image: imageRouter, // Add the image router
  media: mediaRouter, // Add the media router
  // Add other routers here
});

// Export type definition of API
// This type is used on the client to provide type-safe calls
export type AppRouter = typeof appRouter;

// Create and export the caller for server-side procedure calls
const createCaller = createCallerFactory(appRouter);
// Note: If you have context setup, you'd pass it here, e.g., createCaller({})
export const serverCaller = createCaller({});
