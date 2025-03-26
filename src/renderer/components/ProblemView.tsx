import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, AlertCircle, BookOpen, Save, ChevronLeft, ChevronRight, X, Edit, Eye, EyeOff, Calendar } from 'lucide-react';
import { useNotes, useAnkiConnect, useMediaFiles } from '../hooks';
import { NoteInfo } from '../types/ankiConnect';

// 問題データの型定義
interface ProblemData {
  noteId: number;
  noteInfo?: NoteInfo;
  deckName: string;
  question: string;
  answer: string;
}

interface ProblemViewProps {
  noteId?: number;
  isCurrentCard?: boolean;
  onRefresh?: () => void;
  onNavigateBack?: () => void;
}

/**
 * 問題表示と解答アップロードのための共通コンポーネント
 * CurrentProblemとProblemDetailで共通して使用される
 */
const ProblemView = ({ noteId, isCurrentCard = false, onRefresh, onNavigateBack }: ProblemViewProps) => {
  const { notes, isLoading, error: noteError, fetchCurrentCard, fetchNoteById, addAnswerToNote } = useNotes();
  const { isConnected, testConnection } = useAnkiConnect();
  const { 
    mediaServerUrl, 
    uploadImage, 
    handleFileDrop,
    isLoading: isMediaLoading,
    error: mediaError,
    clearMediaCache
  } = useMediaFiles();
  
  const [problemData, setProblemData] = useState<ProblemData | null>(null);
  const [connectionChecked, setConnectionChecked] = useState(false);
  
  // メモと画像アップロード用の状態
  const [memo, setMemo] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // パネル表示制御用の状態
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  
  // 解答と過去の解答用紙の表示制御
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedAnswerDate, setSelectedAnswerDate] = useState<string | null>(null);

  // AnkiConnectとの接続を確認
  useEffect(() => {
    const checkConnection = async () => {
      await testConnection();
      setConnectionChecked(true);
    };
    
    checkConnection();
  }, [testConnection]);

  // 接続が確立されたら問題を取得
  useEffect(() => {
    if (isConnected) {
      fetchProblemData();
    }
  }, [isConnected, noteId, isCurrentCard]);

  // 問題データを取得する関数
  const fetchProblemData = async () => {
    if (!isConnected) return;
    
    try {
      let data;
      
      if (isCurrentCard) {
        // 現在表示中のカードを取得
        data = await fetchCurrentCard();
      } else if (noteId) {
        // 指定されたノートIDの情報を取得
        const noteInfo = await fetchNoteById(noteId);
        if (noteInfo) {
          // ProblemDetailと同じ形式のデータ構造に変換
          // ノート情報から問題データを構築
          data = {
            noteId: noteInfo.noteId,
            noteInfo: noteInfo,
            // deckNameはnoteInfoには含まれていないので空文字をデフォルト値とする
            deckName: '',
            // フィールドから表面と裏面の内容を取得
            question: noteInfo.fields['表面']?.value || '',
            answer: noteInfo.fields['裏面']?.value || ''
          };
        }
      }
      
      if (data) {
        setProblemData(data);
        
        // 過去の解答エントリがある場合、最新の日付を選択
        if (data.noteInfo?.fields?.裏面?.value) {
          const entries = extractAnswerEntries(data.noteInfo.fields.裏面.value);
          if (entries.length > 0) {
            setSelectedAnswerDate(entries[0].date);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch problem data:', err);
    }
  };

  // HTMLタグを除去してプレーンテキストを取得する関数
  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '');
  };
  
  // 裏面の内容から解答エントリを抽出する関数
  const extractAnswerEntries = (backContent: string): { date: string; content: string }[] => {
    if (!backContent) return [];
    
    // 解答エントリを抽出
    const entryRegex = /<div class="answer-entry"><p><strong>([^<]+)<\/strong><\/p>([\s\S]*?)<\/div>/g;
    const entries: { date: string; content: string }[] = [];
    
    let match;
    while ((match = entryRegex.exec(backContent)) !== null) {
      const dateStr = match[1]; // 日付と時刻
      const content = match[0]; // エントリ全体
      
      entries.push({
        date: dateStr,
        content: content
      });
    }
    
    // 新しい順に並べ替え
    return entries.reverse();
  };

  // 画像のドロップハンドラー
  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const imageFiles = handleFileDrop(e);
    
    if (imageFiles.length > 0) {
      // 既存の画像に新しい画像を追加
      setImages(prevImages => [...prevImages, ...imageFiles]);
      
      // 新しい画像のプレビューを作成
      imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result;
          if (result && typeof result === 'string') {
            setImagePreviews(prevPreviews => [...prevPreviews, result]);
            setSaveError(null);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  }, [handleFileDrop]);
  
  // 画像を削除する
  const removeImage = useCallback((index: number) => {
    setImages(prevImages => {
      const newImages = [...prevImages];
      newImages.splice(index, 1);
      return newImages;
    });
    
    setImagePreviews(prevPreviews => {
      const newPreviews = [...prevPreviews];
      newPreviews.splice(index, 1);
      return newPreviews;
    });
  }, []);

  // ドラッグオーバーイベントの処理
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // 保存処理
  const handleSave = async () => {
    if (images.length === 0 || !problemData) {
      setSaveError('画像がアップロードされていないか、カード情報が取得できていません');
      return;
    }
    
    setSaving(true);
    setSaveError(null);
    
    try {
      // 1. すべての画像をAnkiのメディアフォルダに保存
      const uploadPromises = images.map(image => uploadImage(image));
      const uploadResults = await Promise.all(uploadPromises);
      
      // アップロード失敗がないか確認
      const failedUploads = uploadResults.filter(result => !result.success);
      if (failedUploads.length > 0) {
        throw new Error(`${failedUploads.length}個の画像のアップロードに失敗しました`);
      }
      
      // 2. ノートのフィールドを更新
      // 複数の画像ファイル名をカンマ区切りで連結
      const imageFilenames = uploadResults.map(result => result.filename).join(',');
      
      const success = await addAnswerToNote(
        problemData.noteId,
        imageFilenames,
        memo,
        '過去解答'
      );
      
      if (success) {
        setSaveSuccess(true);
        
        // 3秒後に成功メッセージをクリア
        const timer = setTimeout(() => {
          setSaveSuccess(false);
        }, 3000);
        
        // 保存成功後にカード情報を再取得
        await fetchProblemData();
        
        // フォームをリセット
        setMemo('');
        setImages([]);
        setImagePreviews([]);
        
        // コンポーネントアンマウント時にタイマーをクリア
        return () => clearTimeout(timer);
      } else {
        throw new Error('ノートの更新に失敗しました');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存に失敗しました');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // パネルの表示状態に基づいてグリッドクラスを決定
  const getGridClass = () => {
    if (leftPanelVisible && rightPanelVisible) {
      return "grid grid-cols-1 lg:grid-cols-2 gap-4";
    } else if (leftPanelVisible) {
      return "block";
    } else if (rightPanelVisible) {
      return "block";
    } else {
      // 両方非表示の場合（通常はありえない）
      return "hidden";
    }
  };

  // メディアURLを使用して画像パスを修正する関数
  const processHtml = (html: string) => {
    if (!mediaServerUrl || !html) return html;
    
    return html.replace(
      /<img\s+src="([^"]+)"/g, 
      (match: string, filename: string) => {
        // すでに完全なURLの場合はそのまま使用
        if (filename.startsWith('http://') || filename.startsWith('https://')) {
          return `<img src="${filename}"`;
        }
        // 相対パスの場合はメディアサーバーのURLを追加
        return `<img src="${mediaServerUrl}/media/${filename}"`;
      }
    );
  };

  // エラーメッセージを表示する関数
  const renderError = (errorMessage: string | Error | null) => {
    if (!errorMessage) return null;
    
    const message = errorMessage instanceof Error ? errorMessage.message : errorMessage;
    
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-start">
        <AlertCircle className="w-5 h-5 mr-2 mt-0.5" />
        <div>
          <p className="font-semibold">エラーが発生しました</p>
          <p>{message}</p>
          {isConnected === false && (
            <p className="mt-2">
              <strong>確認事項:</strong>
              <ul className="list-disc pl-5 mt-1">
                <li>Ankiが起動していることを確認してください</li>
                <li>AnkiConnectプラグインがインストールされていることを確認してください</li>
              </ul>
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{isCurrentCard ? '現在の問題' : '問題詳細'}</h1>
        <div className="flex gap-2">
          {onNavigateBack && (
            <button 
              onClick={onNavigateBack}
              className="btn btn-outline flex items-center"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              戻る
            </button>
          )}
          <button 
            onClick={onRefresh || fetchProblemData}
            className="btn btn-primary flex items-center"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            更新
          </button>
        </div>
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
      
      {renderError(noteError)}
      {renderError(mediaError)}
      
      {/* パネル表示切り替えボタン */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setLeftPanelVisible(!leftPanelVisible)}
          className="btn btn-sm btn-outline flex items-center"
          title={leftPanelVisible ? "メモパネルを隠す" : "メモパネルを表示"}
        >
          {leftPanelVisible ? <ChevronLeft className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
          {leftPanelVisible ? "メモパネルを隠す" : "メモパネルを表示"}
        </button>
        
        <button
          onClick={() => setRightPanelVisible(!rightPanelVisible)}
          className="btn btn-sm btn-outline flex items-center"
          title={rightPanelVisible ? "問題パネルを隠す" : "問題パネルを表示"}
        >
          {rightPanelVisible ? <ChevronRight className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
          {rightPanelVisible ? "問題パネルを隠す" : "問題パネルを表示"}
        </button>
      </div>
      
      {/* 2カラムレイアウト */}
      {problemData && (
        <div className={getGridClass()}>
          {/* 左側：メモと画像アップロード */}
          {leftPanelVisible && (
            <div className="card p-6 border rounded-lg shadow-sm mb-4">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Edit className="w-5 h-5 mr-2" />
                メモと解答画像
              </h2>
              
              {/* 画像アップロード */}
              <div 
                className={`border-2 border-dashed rounded-lg p-8 mb-4 text-center cursor-pointer
                  ${images.length > 0 ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-primary'}
                `}
                onDrop={onDrop}
                onDragOver={handleDragOver}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                {imagePreviews.length > 0 ? (
                  <div>
                    <p className="text-green-600 mb-2">{imagePreviews.length}枚の画像がアップロードされました</p>
                    <div className="grid grid-cols-2 gap-2">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative">
                          <img 
                            src={preview} 
                            alt={`アップロードされた解答 ${index + 1}`} 
                            className="max-h-48 mx-auto"
                          />
                          <button
                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(index);
                            }}
                            title="削除"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      className="mt-4 btn btn-sm btn-outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById('file-upload')?.click();
                      }}
                    >
                      さらに画像を追加
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-500">
                      ここに解答画像をドラッグ&ドロップ
                    </p>
                    <p className="text-gray-400 text-sm mt-1">
                      または、クリックして画像を選択
                    </p>
                  </div>
                )}
                <input 
                  id="file-upload" 
                  type="file" 
                  accept="image/*" 
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      const newFiles = Array.from(e.target.files);
                      setImages(prevImages => [...prevImages, ...newFiles]);
                      
                      // 新しい画像のプレビューを作成
                      newFiles.forEach(file => {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const result = event.target?.result;
                          if (result && typeof result === 'string') {
                            setImagePreviews(prevPreviews => [...prevPreviews, result]);
                            setSaveError(null);
                          }
                        };
                        reader.readAsDataURL(file);
                      });
                    }
                  }}
                />
              </div>
              
              {/* メモ入力 */}
              <div className="mb-4">
                <label htmlFor="memo" className="block text-sm font-medium text-gray-700 mb-1">
                  メモ（オプション）
                </label>
                <textarea
                  id="memo"
                  rows={4}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="解答に関するメモを入力..."
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>
              
              {/* エラーメッセージ */}
              {saveError && renderError(saveError)}
              
              {/* 保存成功メッセージ */}
              {saveSuccess && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                  解答が正常に保存されました
                </div>
              )}
              
              {/* 保存ボタン */}
              <button
                className="btn btn-primary w-full flex items-center justify-center"
                onClick={handleSave}
                disabled={images.length === 0 || saving || isMediaLoading || saveSuccess}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    解答を保存
                  </>
                )}
              </button>
            </div>
          )}
          
          {/* 右側：問題情報 */}
          {rightPanelVisible && (
            <div className="card p-6 border rounded-lg shadow-sm mb-4">
              <h2 className="text-xl font-semibold mb-3 flex items-center">
                <BookOpen className="w-5 h-5 mr-2" />
                {isCurrentCard ? '現在表示中のカード' : '問題情報'}
              </h2>
              
              {/* デッキ名 */}
              {problemData.deckName && (
                <div className="mb-4">
                  <div className="text-sm text-gray-500 mb-1">デッキ</div>
                  <div className="font-medium">{problemData.deckName}</div>
                </div>
              )}
              
              {/* タグ */}
              {problemData.noteInfo?.tags && problemData.noteInfo.tags.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm text-gray-500 mb-1">タグ</div>
                  <div className="flex flex-wrap gap-1">
                    {problemData.noteInfo.tags.map((tag: string) => (
                      <span 
                        key={tag} 
                        className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 表面 */}
              <div className="mb-4">
                <div className="text-sm text-gray-500 mb-1">表面</div>
                <div className="p-3 bg-gray-50 rounded border" dangerouslySetInnerHTML={{ 
                  __html: processHtml(problemData.question)
                }} />
              </div>
              
              {/* 解答表示切り替えボタン */}
              <div className="mb-4">
                <button
                  onClick={() => setShowAnswer(!showAnswer)}
                  className="btn btn-outline flex items-center"
                >
                  {showAnswer ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-2" />
                      解答を隠す
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      解答を表示
                    </>
                  )}
                </button>
              </div>
              
              {/* 裏面（解答） - 表示/非表示切り替え可能 */}
              {showAnswer && (
                <div className="mb-4">
                  <div className="text-sm text-gray-500 mb-1">裏面（解答）</div>
                  <div className="p-3 bg-gray-50 rounded border" dangerouslySetInnerHTML={{ 
                    __html: processHtml(problemData.answer || '解答がありません')
                  }} />
                </div>
              )}
              
              
              {/* 過去の解答用紙 - 表示/非表示切り替え可能 */}
              {showAnswer && problemData.noteInfo?.fields?.裏面?.value && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm text-gray-500">過去の解答用紙</div>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1 text-gray-500" />
                      <span className="text-sm text-gray-500 mr-2">日付:</span>
                    </div>
                  </div>
                  
                  {/* 日付選択ボタン */}
                  {(() => {
                    const entries = extractAnswerEntries(problemData.noteInfo.fields.裏面.value);
                    if (entries.length === 0) {
                      return <div className="p-3 bg-gray-50 rounded border text-gray-500">過去の解答はありません</div>;
                    }
                    
                    return (
                      <>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {entries.map((entry, index) => (
                            <button
                              key={index}
                              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                                selectedAnswerDate === entry.date
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                              onClick={() => setSelectedAnswerDate(entry.date)}
                            >
                              {entry.date}
                            </button>
                          ))}
                        </div>
                        
                        {/* 選択した日付の解答エントリを表示 */}
                        {selectedAnswerDate && (
                          <div className="p-3 bg-gray-50 rounded border">
                            {entries
                              .filter(entry => entry.date === selectedAnswerDate)
                              .map((entry, index) => (
                                <div key={index} dangerouslySetInnerHTML={{ 
                                  __html: processHtml(entry.content)
                                }} />
                              ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProblemView;
