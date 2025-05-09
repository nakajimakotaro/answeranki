import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState, useCallback, ErrorInfo } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import './App.css';
import Layout from './renderer/components/Layout.js';
import GlobalErrorDisplay from './renderer/components/GlobalErrorDisplay.js';
import { ErrorProvider, useError } from './renderer/context/ErrorContext.js';
import superjson from 'superjson';
import ProblemList from './renderer/routes/ProblemList.js';
// ProblemView を削除し、新しいページコンポーネントをインポート
// import ProblemView from './renderer/components/ProblemView.js';
import ProblemDetailPage from './renderer/routes/ProblemDetailPage.js';
import ReviewPage from './renderer/routes/ReviewPage.js';
import Dashboard from './renderer/routes/Dashboard.js';
import TextbooksPage from './renderer/routes/TextbooksPage.js';
import UniversitiesPage from './renderer/routes/UniversitiesPage.js';
import SchedulesPage from './renderer/routes/SchedulesPage.js';
import ExamsPage from './renderer/routes/ExamsPage.js';
import TodaysTasks from './renderer/routes/TodaysTasks.js';
import { CalculationMistakesPage } from './renderer/routes/CalculationMistakesPage.js'; // 追加
import { AppRouter } from '@server/router';
import { trpc } from './renderer/lib/trpc.js';

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  return (
    <div role="alert" style={{ padding: '20px', border: '1px solid red', margin: '20px' }}>
      <h2>アプリケーションエラー</h2>
      <p>予期せぬエラーが発生しました。</p>
      <pre style={{ color: 'red' }}>{error.message}</pre>
      <button onClick={resetErrorBoundary}>
        再試行
      </button>
    </div>
  );
};

function AppContent() {
  return (
    <Router>
      <GlobalErrorDisplay />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="problems" element={<ProblemList />} />
          <Route path="problem/:noteId" element={<ProblemDetailPage />} />
          <Route path="todays-tasks" element={<TodaysTasks />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="textbooks" element={<TextbooksPage />} />
          <Route path="universities" element={<UniversitiesPage />} />
          <Route path="schedules" element={<SchedulesPage />} />
          <Route path="exams" element={<ExamsPage />} />
          <Route path="calculation-mistakes" element={<CalculationMistakesPage />} /> {/* 追加 */}
        </Route>
      </Routes>
    </Router>
  );
}

function AppWithErrorBoundary() {
  const { setError } = useError();

  const handleBoundaryError = useCallback((error: Error, info: ErrorInfo) => {
    console.error("ErrorBoundary caught an error:", error, info.componentStack ?? 'N/A');
    let displayMessage = error.message || '不明なエラーが発生しました。';
    if (error.name === 'TRPCClientError' && (error as any).message) {
       displayMessage = (error as any).message;
    }
    setError(error, `エラーが発生しました: ${displayMessage}`);
  }, [setError]);

  const handleBoundaryReset = useCallback(() => {
    setError(null);
  }, [setError]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleBoundaryError}
      onReset={handleBoundaryReset}
    >
      <AppContent />
    </ErrorBoundary>
  );
}


function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        throwOnError: true,
        retry: false,
      },
      mutations: {
        throwOnError: true,
        onError: (error: Error) => {
          console.error("Mutation Error caught in QueryClient onError (should be rare if throwOnError=true):", error);
        },
      },
    },
  }));

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/trpc',
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ErrorProvider>
          <AppWithErrorBoundary />
        </ErrorProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
