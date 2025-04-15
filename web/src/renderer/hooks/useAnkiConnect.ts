import { useState, useCallback, useEffect } from 'react';
import { trpc } from '../lib/trpc';

/**
 * AnkiConnectの接続状態を確認するためのフック (tRPC版)
 */
export function useAnkiConnect() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラーメッセージ専用のstate

  // useQueryフックを使用。初期状態では実行しない (enabled: false)
  const ankiVersionQuery = trpc.anki.miscellaneous.version.useQuery(undefined, {
    enabled: false, // 手動でトリガーするため最初は無効
    retry: false, // 接続失敗時にリトライしない
    staleTime: Infinity, // 成功したらキャッシュを永続化
    gcTime: Infinity, // キャッシュを永続化
    refetchOnWindowFocus: false, // ウィンドウフォーカスで再取得しない
  });

  /**
   * AnkiConnectとの接続をテストする
   */
  const testConnection = useCallback(async () => {
    setErrorMessage(null); // エラーメッセージをリセット
    setIsConnected(null); // 接続状態をリセット
    setVersion(null); // バージョンをリセット
    try {
      // refetchを実行してクエリをトリガー
      const result = await ankiVersionQuery.refetch();

      if (result.isError) {
        // isErrorフラグでエラーを判定
        console.error('AnkiConnect test connection failed:', result.error);
        setIsConnected(false);
        setErrorMessage(result.error?.message ?? '接続テスト中に不明なエラーが発生しました');
        setVersion(null);
        return false;
      }

      // 成功した場合、dataから値を取得
      // result.data の型はサーバー側の定義に基づく
      // ここでは仮に { connected: boolean, version: number | null, error: string | null } と想定
      if (result.data) {
         // サーバー側のanki.tsを確認したところ、versionクエリは直接バージョン番号(number)を返すか、
         // 接続失敗時にTRPCErrorをスローする実装になっているようです。
         // そのため、成功時は data にバージョン番号が入ります。
         // connected や error プロパティは存在しません。
        setIsConnected(true); // 成功したら接続済みとする
        setVersion(result.data); // バージョン番号を設定
        setErrorMessage(null); // エラーメッセージをクリア
        return true;
      } else {
        // データがない場合（通常は isError で捕捉されるはずだが念のため）
        setIsConnected(false);
        setErrorMessage('接続テスト結果の取得に失敗しました');
        setVersion(null);
        return false;
      }

    } catch (err: any) {
      // refetch自体が予期せぬエラーをスローした場合 (通常は isError で処理される)
      console.error('AnkiConnect test connection unexpected error:', err);
      setIsConnected(false);
      setErrorMessage(err?.message ?? '接続テスト中に予期せぬエラーが発生しました');
      setVersion(null);
      return false;
    }
  }, [ankiVersionQuery.refetch]); // 依存配列を ankiVersionQuery.refetch に変更

  // ankiVersionQuery の状態を監視してフックの state を更新
  // isLoading は ankiVersionQuery.isFetching を使う
  const isLoading = ankiVersionQuery.isFetching;

  return {
    isConnected,
    isLoading,
    error: errorMessage, // エラーメッセージを返す
    version, // バージョン番号も返すように変更
    testConnection,
  };
}
