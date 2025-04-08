import { StrictMode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson'; // Import superjson
import { trpc } from './renderer/lib/trpc.js';
import './index.css';
import App from './App.js';

// --- Global Error Handling Setup ---
// Define a type for the custom event detail
interface GlobalErrorEventDetail {
  error: Error;
  message: string;
}

// window.onerror handler
window.onerror = (message, source, lineno, colno, error) => {
  console.error("window.onerror caught:", message, source, lineno, colno, error);

  // Ensure we have an Error object
  const errorObject = error || new Error(String(message));
  const errorMessage = `Unhandled error: ${errorObject.message || message} (Source: ${source}, Line: ${lineno})`;

  // Dispatch a custom event with error details
  window.dispatchEvent(new CustomEvent<GlobalErrorEventDetail>('globalerror', {
    detail: { error: errorObject, message: errorMessage }
  }));

  // Return false to allow default browser error handling (e.g., logging to console)
  return false;
};

// window.onunhandledrejection handler
window.onunhandledrejection = (event) => {
  console.error("window.onunhandledrejection caught:", event.reason);

  // Extract the error object or create one
  const errorObject = event.reason instanceof Error ? event.reason : new Error(String(event.reason ?? 'Unknown rejection reason'));
  const errorMessage = `Unhandled promise rejection: ${errorObject.message}`;

  // Dispatch the custom event
  window.dispatchEvent(new CustomEvent<GlobalErrorEventDetail>('globalerror', {
    detail: { error: errorObject, message: errorMessage }
  }));

  // Prevent default handling if needed, but usually not necessary
  // event.preventDefault();
};
// --- End Global Error Handling Setup ---


// Root component remains largely the same, App now handles tRPC client setup internally
function Root() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/trpc',
          transformer: superjson, // Add transformer to the link options
        }),
      ],
      // transformer: superjson, // Remove from client level
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
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
