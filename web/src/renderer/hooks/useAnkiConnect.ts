import { useState, useCallback } from 'react';
import { rawTrpcClient } from '../lib/trpc'; // Import the raw tRPC client instance

/**
 * AnkiConnectの接続状態を確認するためのフック (tRPC版)
 */
export function useAnkiConnect() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Store error message string or null
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);

  /**
   * AnkiConnectとの接続をテストする
   */
  const testConnection = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsConnected(null); // Reset connection status
    setVersion(null); // Reset version

    try {
      // Use the raw tRPC client for direct procedure call
      const result = await rawTrpcClient.anki.testConnection.query();
      setIsConnected(result.connected);
      setVersion(result.version);
      setError(result.error); // Set error message from result if any
      return result.connected;
    } catch (err: any) { // Catch any error
      console.error('AnkiConnect test connection failed:', err);
      setIsConnected(false);
      // Set error message from the caught error
      setError(err?.message ?? '接続テスト中に不明なエラーが発生しました');
      setVersion(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isConnected,
    isLoading,
    error,
    testConnection,
  };
};
