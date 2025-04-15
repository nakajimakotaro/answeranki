import { router, createCallerFactory } from './trpc.js';
import { universityRouter } from './routers/university.js';
import { imageRouter } from './routers/image.js';
import { textbookRouter } from './routers/textbook.js';
import { scheduleRouter } from './routers/schedule.js';
import { examRouter } from './routers/exam.js';
import { cardRouter, deckRouter, graphicalRouter, mediaRouter, miscellaneousRouter, noteRouter, statisticRouter  } from './routers/anki.js';

export const appRouter = router({
  university: universityRouter,
  textbook: textbookRouter,
  schedule: scheduleRouter,
  exam: examRouter,
  image: imageRouter,
  anki: {
    card: cardRouter,
    deck: deckRouter,
    graphical: graphicalRouter,
    media: mediaRouter,
    miscellaneous: miscellaneousRouter,
    note: noteRouter,
    statistic: statisticRouter,
  },
});

export type AppRouter = typeof appRouter;

const createCaller = createCallerFactory(appRouter);
export const serverCaller = createCaller({});
