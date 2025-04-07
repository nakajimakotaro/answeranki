import { router, createCallerFactory } from './trpc.js';
import { universityRouter } from './routers/university.js';
import { ankiRouter } from './routers/anki.js';
import { imageRouter } from './routers/image.js';
import { mediaRouter } from './routers/media.js';
import { textbookRouter } from './routers/textbook.js';
import { scheduleRouter } from './routers/schedule.js';
import { examRouter } from './routers/exam.js';

export const appRouter = router({
  university: universityRouter,
  textbook: textbookRouter,
  schedule: scheduleRouter,
  exam: examRouter,
  anki: ankiRouter,
  image: imageRouter,
  media: mediaRouter,
});

export type AppRouter = typeof appRouter;

const createCaller = createCallerFactory(appRouter);
export const serverCaller = createCaller({});
