import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertCircle, Calendar, BookOpen, Play, ArrowRight } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { useAnkiConnect } from '../hooks';

/**
 * 今日やることページ
 * スケジュールに基づいて今日やるべきAnkiデッキを表示し、レビューを開始できる
 */
const TodaysTasks = () => {
  const navigate = useNavigate();
  const { isConnected, testConnection } = useAnkiConnect();
  const [connectionChecked, setConnectionChecked] = useState(false);

  // tRPC クエリフックを使用
  const {
    data: tasks = [],
    isLoading,
    error: queryError,
    refetch: refetchTasks
  } = trpc.schedule.getTodaysTasks.useQuery(
    undefined,
    {
      // オプションが必要な場合はここに追加
    }
  );

  // tRPC ミューテーションフックを使用
  const reviewMutation = trpc.anki.graphical.guiDeckReview.useMutation({
    onError: (err) => {
      console.error(`Failed to start deck review:`, err);
    },
  });

  // AnkiConnectとの接続を確認
  useEffect(() => {
    const checkConnection = async () => {
      if (testConnection) {
        await testConnection();
      }
      setConnectionChecked(true);
    };

    checkConnection();
  }, [testConnection]);

  // 更新ボタンの処理
  const handleRefresh = useCallback(() => {
    refetchTasks();
    reviewMutation.reset();
  }, [refetchTasks, reviewMutation]);

  // デッキレビュー開始処理
  const handleStartReview = useCallback((deckName: string) => {
    if (!isConnected) {
      console.warn('AnkiConnect is not connected. Cannot start review.');
      return;
    }
    // Ankiのデッキレビューを開始
    reviewMutation.mutate({ name: deckName }, {
      onSuccess: () => {
        // レビュー開始成功後、レビューページに遷移（デッキ名をクエリパラメータで渡す）
        navigate(`/review?deck=${encodeURIComponent(deckName)}`);
      }
    });
  }, [isConnected, reviewMutation, navigate]);

  // エラー表示用の変数
  const displayError = queryError || reviewMutation.error;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">今日やること</h1>
        <button
          onClick={handleRefresh}
          className="btn btn-primary flex items-center"
          disabled={isLoading || reviewMutation.isPending}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>

      {/* 接続チェック */}
      {connectionChecked && !isConnected && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4 flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">AnkiConnectに接続できません</p>
            <p>Ankiが起動しているか、AnkiConnectプラグインがインストールされ、許可されているか確認してください。</p>
            {testConnection && (
              <p className="mt-1">
                <button
                  onClick={testConnection}
                  className="text-yellow-700 underline"
                >
                  再接続を試みる
                </button>
              </p>
            )}
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {displayError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">エラーが発生しました</p>
            <p>{displayError.message}</p>
          </div>
        </div>
      )}

      {/* 今日のタスク一覧 */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3 flex items-center">
          <Calendar className="w-5 h-5 mr-2" />
          今日のスケジュール
        </h2>

        {/* ローディング表示 */}
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : tasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
              >
                <div className="flex items-center mb-2">
                  <BookOpen className="w-5 h-5 mr-2 text-primary flex-shrink-0" />
                  <h3 className="text-lg font-medium truncate" title={task.textbook_title}>{task.textbook_title}</h3>
                </div>
                <div className="text-sm text-gray-600 mb-1">
                  科目: {task.textbook_subject}
                </div>
                <div className="text-sm text-gray-600 mb-3">
                  目標: {task.daily_goal !== null ? `${task.daily_goal} 問` : '未設定'}
                </div>

                {task.anki_deck_name ? (
                  <button
                    className="btn btn-primary w-full flex items-center justify-center"
                    onClick={() => handleStartReview(task.anki_deck_name!)}
                    disabled={!isConnected || reviewMutation.isPending}
                  >
                    {reviewMutation.isPending && reviewMutation.variables?.name === task.anki_deck_name ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        開始中...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        レビュー開始
                      </>
                    )}
                  </button>
                ) : (
                  <div className="text-center py-2 bg-gray-100 rounded text-gray-500 text-sm">
                    Ankiデッキ未設定
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          // データがない場合の表示
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">今日のスケジュールはありません</p>
            <p className="text-sm text-gray-400 mt-1">
              スケジュールページで学習計画を設定してください
            </p>
            <button
              className="mt-4 btn btn-outline flex items-center mx-auto"
              onClick={() => navigate('/schedules')}
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              スケジュール設定へ
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodaysTasks;
