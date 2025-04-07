import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

// Define the event detail interface (matching the one in main.tsx)
interface GlobalErrorEventDetail {
  error: Error;
  message: string;
}

interface ErrorContextType {
  error: Error | null;
  setError: (error: Error | null, message?: string) => void;
  errorMessage: string | null;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const ErrorProvider = ({ children }: { children: ReactNode }) => {
  const [error, setErrorState] = useState<Error | null>(null);
  const [errorMessage, setErrorMessageState] = useState<string | null>(null);

  const setError = (error: Error | null, message?: string) => {
    // すでにグローバルエラーが表示されている場合は、新しいエラーで上書きしない方が良い場合もある
    // もしくは、エラーリストとして保持するなどの拡張も考えられる
    // ここではシンプルに最後のエラーを表示する
    setErrorState(error);
    setErrorMessageState(message || error?.message || '不明なエラーが発生しました。');
    if (error) {
      console.error("Global Error Handler Caught:", error, "Custom Message:", message);
    } else {
      // エラーがnullになったらメッセージもクリア
      setErrorMessageState(null);
    }
  };

  // Effect to listen for global error events
  useEffect(() => {
    const handleGlobalError = (event: Event) => {
      if (isGlobalErrorEvent(event)) {
        // Update the context state with the error from the event
        setError(event.detail.error, event.detail.message);
      }
    };

    window.addEventListener('globalerror', handleGlobalError);

    // Cleanup function to remove the listener when the component unmounts
    return () => {
      window.removeEventListener('globalerror', handleGlobalError);
    };
    // No dependencies needed as setError should be stable due to useState/useCallback pattern
    // If setError were recreated on every render, it would need to be a dependency.
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <ErrorContext.Provider value={{ error, setError, errorMessage }}>
      {children}
    </ErrorContext.Provider>
  );
};

export const useError = () => {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

// Helper type guard for the custom event
function isGlobalErrorEvent(event: Event): event is CustomEvent<GlobalErrorEventDetail> {
  // Check if it's a CustomEvent and has the correct type and detail structure
  return event instanceof CustomEvent &&
         event.type === 'globalerror' &&
         typeof event.detail === 'object' &&
         event.detail !== null &&
         'error' in event.detail &&
         event.detail.error instanceof Error && // Ensure error is an Error instance
         'message' in event.detail &&
         typeof event.detail.message === 'string';
}
