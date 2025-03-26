import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, AlertCircle, Search, Tag, Book } from 'lucide-react';
import { useNotes, useAnkiConnect, useDecks, useMediaFiles } from '../hooks';
import { NoteInfo } from '../types/ankiConnect';

const ProblemList = () => {
  const { isConnected, testConnection } = useAnkiConnect();
  const { decks, isLoading: isLoadingDecks, error: decksError, fetchDecks } = useDecks();
  const { notes, isLoading: isLoadingNotes, error: notesError, fetchNotesByQuery } = useNotes();
  const { mediaServerUrl } = useMediaFiles();
  
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [currentProblemTag, setCurrentProblemTag] = useState('current');

  // 設定を読み込む
  useEffect(() => {
    const savedCurrentProblemTag = localStorage.getItem('currentProblemTag');
    
    if (savedCurrentProblemTag) {
      setCurrentProblemTag(savedCurrentProblemTag);
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

  // 接続が確立されたらデッキリストを取得
  useEffect(() => {
    if (isConnected) {
      fetchDecks();
    }
  }, [isConnected, fetchDecks]);

  // デッキを選択したときの処理
  const handleDeckSelect = async (deckName: string) => {
    setSelectedDeck(deckName);
    
    // デッキに属するノートを検索
    const query = `deck:"${deckName}"`;
    await fetchNotesByQuery(query);
  };

  // 検索処理
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      if (selectedDeck) {
        // 検索クエリが空の場合は、選択中のデッキのノートを再取得
        const query = `deck:"${selectedDeck}"`;
        await fetchNotesByQuery(query);
      }
      return;
    }
    
    let query = searchQuery;
    
    // デッキが選択されている場合は、そのデッキ内で検索
    if (selectedDeck) {
      query = `deck:"${selectedDeck}" ${searchQuery}`;
    }
    
    await fetchNotesByQuery(query);
  };

  // HTMLタグを除去してプレーンテキストを取得する関数
  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '');
  };

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">問題一覧</h1>
        <button 
          onClick={() => fetchDecks()}
          className="btn btn-primary flex items-center"
          disabled={isLoadingDecks}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingDecks ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>
      
      {!isConnected && connectionChecked && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 mt-0.5" />
          <div>
            <p className="font-semibold">AnkiConnectに接続できません</p>
            <p>Ankiが起動しているか、AnkiConnectプラグインがインストールされているか確認してください。</p>
            <p className="mt-1">
              <button 
                onClick={() => testConnection()} 
                className="text-red-700 underline"
              >
                再接続を試みる
              </button>
            </p>
          </div>
        </div>
      )}
      
      {(decksError || notesError) && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 mt-0.5" />
          <div>
            <p className="font-semibold">エラーが発生しました</p>
            <p>{decksError?.message || notesError?.message}</p>
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
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : decks.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {decks.map((deck, index) => (
              <button
                key={index}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  selectedDeck === deck 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                onClick={() => handleDeckSelect(deck)}
              >
                {deck}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">デッキが見つかりませんでした</p>
          </div>
        )}
      </div>
      
      {/* 検索バー */}
      <div className="mb-6">
        <div className="flex">
          <div className="relative flex-1">
            <input
              type="text"
              className="w-full p-2 pl-10 border border-gray-300 rounded-l-md"
              placeholder="問題を検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          </div>
          <button
            className="btn bg-gray-200 text-gray-700 rounded-l-none"
            onClick={handleSearch}
          >
            検索
          </button>
        </div>
      </div>
      
      {/* 問題一覧 */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3 flex items-center">
          <Tag className="w-5 h-5 mr-2" />
          {selectedDeck ? `${selectedDeck}の問題` : '検索結果'}
        </h2>
        
        {isLoadingNotes ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : notes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {notes.map((note) => {
              // フィールド名を取得（最初のフィールドを表示用に使用）
              const fieldNames = Object.keys(note.fields);
              const firstFieldName = fieldNames[0] || '';
              const firstFieldValue = note.fields[firstFieldName]?.value || '';
              
              // HTMLタグを除去してプレーンテキストを取得
              const plainText = stripHtml(firstFieldValue);
              
              // 現在の問題タグを持っているか確認
              const hasCurrentTag = note.tags.includes(currentProblemTag);
              
              return (
                <div key={note.noteId} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="mb-2 font-medium truncate" title={plainText}>
                    {plainText.length > 50 ? plainText.substring(0, 50) + '...' : plainText}
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex flex-wrap gap-1">
                      {note.tags.map((tag, tagIndex) => (
                        <span 
                          key={tagIndex} 
                          className={`text-xs px-2 py-1 rounded ${
                            tag === currentProblemTag 
                              ? 'bg-primary text-white' 
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <Link 
                      to={`/problem/${note.noteId}`} 
                      className="text-primary hover:underline text-sm"
                    >
                      詳細
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">問題が見つかりませんでした</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProblemList;
