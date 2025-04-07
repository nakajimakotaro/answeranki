import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackRender: (props: { error: Error; resetErrorBoundary: () => void }) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    // エラー発生時にstateを更新し、フォールバックUIを表示させる
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // エラー情報をログに出力
    console.error("GlobalErrorBoundary caught an error:", error, errorInfo);
    // ここで外部のログサービスに送信することも可能
    // 注意: このメソッドはコミットフェーズで呼ばれるため、副作用（例: API呼び出し）は慎重に行う
  }

  resetErrorBoundary = () => {
    // エラー状態をリセットし、再度childrenを描画試行
    this.setState({ hasError: false, error: null });
    // 必要であれば、ここでアプリケーションの状態をリセットする処理を追加
    // 例: window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // エラーがあればフォールバックUIを描画
      return this.props.fallbackRender({
        error: this.state.error,
        resetErrorBoundary: this.resetErrorBoundary,
      });
    }

    // エラーがなければ通常通り子コンポーネントを描画
    return this.props.children;
  }
}

export default GlobalErrorBoundary;
