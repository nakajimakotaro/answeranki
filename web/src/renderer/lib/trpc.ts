import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../../../../server/src/router';

export const trpc = createTRPCReact<AppRouter>();

export const rawTrpcClient = createTRPCReact<AppRouter>().createClient({
  links: [
    httpBatchLink({
      url: '/trpc',
      transformer: superjson,
    }),
  ],
});
