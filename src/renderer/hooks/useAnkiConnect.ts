import { useState, useCallback } from 'react';
import AnkiConnectService, { ankiConnectService } from '../services/ankiConnectService';
import { AnkiConnectConfig } from '../types/ankiConnect';

/**
 * AnkiConnectサービスを使用するためのフック
 */
export function useAnkiConnect() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * AnkiConnectとの接続をテストする
   */
  const testConnection = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const connected = await ankiConnectService.testConnection();
      setIsConnected(connected);
      return connected;
    } catch (err) {
      setIsConnected(false);
      setError(err instanceof Error ? err : new Error('接続テストに失敗しました'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * AnkiConnectの設定を更新する
   */
  const updateConfig = useCallback((config: Partial<AnkiConnectConfig>) => {
    // 新しいインスタンスを作成して設定を更新
    const newService = new AnkiConnectService(config);
    // ここでは単純に設定を更新するだけで、グローバルなサービスインスタンスは更新しない
    // 実際のアプリケーションでは、設定を永続化する仕組みが必要
    return newService;
  }, []);

  return {
    isConnected,
    isLoading,
    error,
    testConnection,
    updateConfig,
    ankiConnectService
  };
}
