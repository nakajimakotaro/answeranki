import { StrictMode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { trpc } from './renderer/lib/trpc.js'; // Import the trpc instance
import './index.css';
import App from './App.js';
import type { AppRouter } from '@server/router.js'; // Ensure this path is correct

function Root() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({ // Use trpc.createClient
      links: [
        httpBatchLink({
          url: '/trpc',
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}> {/* Use trpc.Provider */}
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );
}


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
