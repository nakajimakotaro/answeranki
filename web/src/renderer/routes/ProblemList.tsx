import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, AlertCircle, Search, Tag, Book, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAnkiConnect, useDecks } from '../hooks';
// import { Note } from 'yanki-connect'; // Note 型は不要に
import { trpc } from '../lib/trpc'; // tRPC クライアントをインポート

const ProblemList = () => {
  const { isConnected, testConnection } = useAnkiConnect();
  // useDecks から fetchDecks を削除し、refetch を追加 (useDecks フックの修正が必要な場合あり)
  const { decks, isLoading: isLoadingDecks, error: decksError, refetch: refetchDecks } = useDecks();

  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [ankiQuery, setAnkiQuery] = useState<string>(''); // Anki検索クエリ
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [currentProblemTag, setCurrentProblemTag] = useState('current');
  const [currentPage, setCurrentPage] = useState(1); // 現在のページ番号
  const pageSize = 50; // 1ページあたりの表示件数

  // 設定と前回の状態を読み込む
  useEffect(() => {
    const savedCurrentProblemTag = localStorage.getItem('currentProblemTag');
    if (savedCurrentProblemTag) {
      setCurrentProblemTag(savedCurrentProblemTag);
    }
    const savedSelectedDeck = localStorage.getItem('problemList_selectedDeck');
    if (savedSelectedDeck) {
      setSelectedDeck(savedSelectedDeck);
    }
    const savedSearchQuery = localStorage.getItem('problemList_searchQuery');
    if (savedSearchQuery) {
      setSearchQuery(savedSearchQuery);
    }
  }, []);

  // AnkiConnectとの接続を確認
  useEffect(() => {
    const checkConnection = async () => {
      await testConnection();
      setConnectionChecked(true);
    };
    checkConnection();
  }, [testConnection]);

  // selectedDeck または searchQuery が変更されたら ankiQuery を更新
  useEffect(() => {
    let queryParts: string[] = [];
    if (selectedDeck) {
      queryParts.push(`deck:"${selectedDeck}"`);
    }
    if (searchQuery.trim()) {
      queryParts.push(searchQuery.trim());
    }
    const newQuery = queryParts.join(' ');
    setAnkiQuery(newQuery);
    setCurrentPage(1); // 検索条件が変わったら1ページ目に戻る

    // 状態をlocalStorageに保存
    if (selectedDeck) {
      localStorage.setItem('problemList_selectedDeck', selectedDeck);
    } else {
      localStorage.removeItem('problemList_selectedDeck');
    }
    localStorage.setItem('problemList_searchQuery', searchQuery);

  }, [selectedDeck, searchQuery]);

  // findNotes クエリ: ankiQuery に基づいてノートIDを取得
  const findNotesQuery = trpc.anki.note.findNotes.useQuery(
    { query: ankiQuery },
    {
      // enabled は boolean を返すようにする
      enabled: !!(isConnected && ankiQuery), // 接続済みでクエリがある場合のみ実行
      staleTime: 5 * 60 * 1000, // 5分間キャッシュを有効にする
    }
  );

  // 全ノートIDをメモ化
  const allNoteIds = useMemo(() => findNotesQuery.data ?? [], [findNotesQuery.data]);

  // 現在のページに表示するノートIDを計算
  const paginatedNoteIds = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return allNoteIds.slice(startIndex, startIndex + pageSize);
  }, [allNoteIds, currentPage, pageSize]);

  // 総ページ数を計算
  const totalPages = useMemo(() => Math.ceil(allNoteIds.length / pageSize), [allNoteIds.length, pageSize]);

  // notesInfo クエリ: ページングされたノートIDに基づいて詳細情報を取得
  const notesInfoQuery = trpc.anki.note.notesInfo.useQuery(
    { notes: paginatedNoteIds }, // ページングされたIDを使用
    {
      // enabled は boolean を返すようにする
      // findNotesQuery が成功し、ページングされたIDが存在する場合に有効化
      enabled: !!(isConnected && findNotesQuery.isSuccess && paginatedNoteIds.length > 0),
      staleTime: 5 * 60 * 1000, // 5分間キャッシュを有効にする
      placeholderData: (previousData) => previousData, // ページ切り替え時に前のデータを保持
    }
  );

  // 表示するノート情報 (notesInfoQuery.data が存在しない場合は空配列)
  const notes = useMemo(() => notesInfoQuery.data ?? [], [notesInfoQuery.data]);
  const isLoadingNotes = findNotesQuery.isLoading || notesInfoQuery.isLoading;
  // エラーオブジェクトを結合するのではなく、どちらか一方、または両方を表示するようにする
  const queryError = findNotesQuery.error || notesInfoQuery.error;


  // デッキを選択したときの処理
  const handleDeckSelect = (deckName: string) => {
    // 同じデッキが選択された場合は選択解除
    if (selectedDeck === deckName) {
      setSelectedDeck(null);
    } else {
      setSelectedDeck(deckName);
    }
  };

  // HTMLタグを除去してプレーンテキストを取得する関数
  const stripHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">問題一覧</h1>
        <button
          onClick={() => refetchDecks()} // fetchDecks を refetchDecks に変更
          className="btn btn-primary flex items-center"
          disabled={isLoadingDecks || !isConnected}
          title={!isConnected ? "Ankiに接続されていません" : "デッキリストを更新"}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingDecks ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>

      {!isConnected && connectionChecked && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="w-5 h-5 mr-2" />
          <div>
            <p className="font-semibold">AnkiConnectに接続できません</p>
            <p>Ankiが起動しているか、AnkiConnectプラグインがインストールされているか確認してください。</p>
            <p className="mt-1">
              <button
                onClick={() => testConnection()}
                className="text-error-content underline"
              >
                再接続を試みる
              </button>
            </p>
          </div>
        </div>
      )}

      {/* クエリ関連のエラー表示 */}
      {queryError && (
        <div className="alert alert-warning mb-4">
          <AlertCircle className="w-5 h-5 mr-2" />
          <div>
            <p className="font-semibold">問題の取得中にエラーが発生しました</p>
            <p>{queryError.message}</p>
            {/* <pre className="text-xs mt-2">{JSON.stringify(queryError, null, 2)}</pre> */}
          </div>
        </div>
      )}
      {/* デッキ取得エラー表示 (クエリエラーとは別) */}
      {decksError && !queryError && ( // クエリエラーがない場合のみ表示
         <div className="alert alert-warning mb-4">
          <AlertCircle className="w-5 h-5 mr-2" />
          <div>
            <p className="font-semibold">デッキリストの取得中にエラーが発生しました</p>
            <p>{decksError.message}</p>
          </div>
        </div>
      )}


      {/* デッキリスト */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3 flex items-center">
          <Book className="w-5 h-5 mr-2" />
          デッキリスト
        </h2>

        {isLoadingDecks ? (
          <div className="flex justify-center items-center h-16">
            <span className="loading loading-spinner text-primary"></span>
          </div>
        ) : decks.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {decks.map((deck) => (
              <button
                key={deck}
                className={`btn btn-sm rounded-full ${
                  selectedDeck === deck
                    ? 'btn-primary'
                    : 'btn-ghost bg-gray-200 hover:bg-gray-300'
                }`}
                onClick={() => handleDeckSelect(deck)}
              >
                {deck}
              </button>
            ))}
          </div>
        ) : isConnected ? (
           <div className="text-center py-8 bg-base-200 rounded-lg">
            <p className="text-base-content/70">デッキが見つかりませんでした。</p>
          </div>
        ) : (
          <div className="text-center py-8 bg-base-200 rounded-lg">
            <p className="text-base-content/70">Ankiに接続してデッキを読み込みます。</p>
          </div>
        )}
      </div>

      {/* 検索バー */}
      <div className="mb-6">
        <div className="flex">
          <div className="relative flex-1">
            <input
              type="text"
              className="input input-bordered w-full pl-10 rounded-r-none"
              placeholder="問題を検索 (例: tag:marked)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={!isConnected}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/50 w-4 h-4" />
          </div>
          <button
            className="btn btn-secondary rounded-l-none"
            disabled={!isConnected}
          >
            検索
          </button>
        </div>
      </div>

      {/* 問題一覧 */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3 flex items-center">
          <Tag className="w-5 h-5 mr-2" />
          {selectedDeck ? `${selectedDeck} の問題` : '検索結果'}
          {/* 件数は全件数を表示 */}
          {ankiQuery && !findNotesQuery.isLoading && <span className="text-sm text-base-content/70 ml-2">({allNoteIds.length}件)</span>}
        </h2>

        {isLoadingNotes ? (
          <div className="flex justify-center items-center h-32">
             <span className="loading loading-spinner text-primary loading-lg"></span>
          </div>
        ) : notes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {notes.map((noteInfo, index) => { // 変数名を noteInfo に変更し、型は NotesInfoResultNotesInner
              const fields = noteInfo.fields || {}; // 正しい型を使用
              const fieldNames = Object.keys(fields);
              // '問題' フィールドがあればそれを優先、なければ最初のフィールド
              const targetFieldName = fieldNames.includes('問題') ? '問題' : fieldNames[0] || '';
              const fieldValue = fields[targetFieldName]?.value || '';

              // HTMLタグを除去してプレーンテキストを取得
              const plainText = stripHtml(fieldValue);

              return (
                <Link
                  key={noteInfo.noteId}
                  to={`/problem/${noteInfo.noteId}`} // noteId を使用
                  className="card bg-base-100 shadow-md hover:shadow-lg transition-shadow relative block cursor-pointer group"
                >
                  <div className="absolute top-0 left-0 bg-primary text-primary-content px-2 py-0.5 text-xs font-bold rounded-tl-lg rounded-br-lg z-10">
                    問{index + 1}
                  </div>
                  <div className="card-body p-4 pt-8"> {/* 上部にスペース確保 */}
                    <p className="mb-2 font-medium truncate card-title text-sm" title={plainText}>
                      {plainText.length > 60 ? plainText.substring(0, 60) + '...' : plainText || '(内容なし)'}
                    </p>
                    <div className="flex justify-between items-end">
                      <div className="flex flex-wrap gap-1 mt-2">
                        {noteInfo.tags.map((tag: string) => ( // 型指定
                          <span
                            key={tag}
                            className={`badge badge-sm ${
                              tag === currentProblemTag
                                ? 'badge-primary'
                                : 'badge-outline'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <span className="text-primary text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        詳細を見る
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : allNoteIds.length === 0 && ankiQuery && !queryError ? ( // 全件数が0で、クエリがあり、エラーがない場合
          <div className="text-center py-8 bg-base-200 rounded-lg">
            <p className="text-base-content/70">問題が見つかりませんでした。</p>
            <p className="text-sm text-base-content/50 mt-1">検索条件: {ankiQuery}</p>
          </div>
        ) : !ankiQuery && isConnected ? ( // まだ検索していない場合 (接続済み)
          <div className="text-center py-8 bg-base-200 rounded-lg">
            <p className="text-base-content/70">デッキを選択するか、検索を実行してください。</p>
          </div>
        ) : null /* 接続前やエラー時は何も表示しない */}

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center space-x-4 mt-6">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1 || isLoadingNotes}
            >
              <ChevronLeft className="w-4 h-4" />
              前へ
            </button>
            <span className="text-sm">
              ページ {currentPage} / {totalPages}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || isLoadingNotes}
            >
              次へ
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProblemList;
