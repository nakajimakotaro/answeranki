import { createTRPCReact } from '@trpc/react-query';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'; // Import necessary client functions
import type { AppRouter } from '../../../../server/src/router.js'; // Import AppRouter type

// Create the tRPC instance for use with React Hooks in components
export const trpc = createTRPCReact<AppRouter>();

// Create a raw tRPC client instance for use outside of React components (e.g., services)
export const rawTrpcClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
      // You can add headers here if needed, e.g., for authentication
      // async headers() {
      //   return {
      //     authorization: getAuthCookie(),
      //   };
      // },
    }),
  ],
});

// Note: Client creation for the Provider in main.tsx uses trpc.createClient,
// which is specifically for integrating with the QueryClientProvider.
// The rawTrpcClient created here is for direct procedure calls.
