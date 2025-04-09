import { useState, useEffect, useCallback, useRef } from 'react';
import { parse, compareDesc } from 'date-fns';
import { RefreshCw, AlertCircle, BookOpen, Save, ChevronLeft, ChevronRight, X, Edit, Eye, EyeOff, Scan, Maximize, XCircle, Play, Pause, StopCircle, Clock, Check, RotateCcw, ThumbsUp } from 'lucide-react';
import { useNotes, useAnkiConnect, useMediaFiles } from '../hooks/index.js';
import { NoteInfo } from '../types/ankiConnect.js';
import scansnap, { COLOR_MODE, COMPRESSION, FORMAT, SCAN_MODE, SCANNING_SIDE } from '../../scansnap.js';
import { nanoid } from 'nanoid';

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
  // useNotes hook now handles its own errors via GlobalErrorBoundary
  const { isLoading, fetchCurrentCard, fetchNoteById, addAnswerToNote, answerCard } = useNotes();
  const { isConnected, testConnection } = useAnkiConnect();
  // useMediaFiles hook now handles its own errors via GlobalErrorBoundary
  const {
    uploadImage,
    handleFileDrop,
    isLoading: isMediaLoading,
  } = useMediaFiles();

  // メディアサーバーのURL
  const mediaServerUrl = '/media'; // プロキシ経由でアクセス

  const [problemData, setProblemData] = useState<ProblemData | null>(null);
  const [connectionChecked, setConnectionChecked] = useState(false);

  // メモと画像アップロード用の状態
  const [memo, setMemo] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // スキャナー関連の状態
  const [isScanning, setIsScanning] = useState(false);
  const [scannerInitialized, setScannerInitialized] = useState(false);

  // パネル表示制御用の状態
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);

  // 解答と過去の解答用紙の表示制御
  const [showAnswer, setShowAnswer] = useState(false);

  // 画像拡大ダイアログの状態
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // タイマー関連の状態
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // 解答時間入力用の状態
  const [solvingTime, setSolvingTime] = useState('');
  // 復習時間入力用の状態
  const [reviewTime, setReviewTime] = useState('');
  // 難易度選択用の状態
  const [selectedEase, setSelectedEase] = useState<1 | 2 | 3 | 4 | null>(null);
  // 解答登録成功状態
  const [answerSuccess, setAnswerSuccess] = useState(false);

  // タイマー機能
  const startTimer = () => {
    if (timerRunning) return;

    setTimerRunning(true);
    startTimeRef.current = Date.now() - elapsedTime;

    timerRef.current = window.setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsedTime(Date.now() - startTimeRef.current);
      }
    }, 100);
  };

  const pauseTimer = () => {
    if (!timerRunning) return;

    setTimerRunning(false);
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetTimer = () => {
    pauseTimer();
    setElapsedTime(0);
    startTimeRef.current = null;
    setSolvingTime('');
  };

  // タイマーの表示形式を整える（分と秒）
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}分${seconds}秒`;
  };

  // タイマー時間を解答時間フィールドに反映（分と秒）
  useEffect(() => {
    if (elapsedTime > 0) {
      const totalSeconds = Math.floor(elapsedTime / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setSolvingTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }
  }, [elapsedTime]);

  // コンポーネントのアンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // AnkiConnectとの接続を確認
  useEffect(() => {
    const checkConnection = async () => {
      await testConnection();
      setConnectionChecked(true);
    };

    checkConnection();
  }, [testConnection]);

  // スキャナーの初期化
  useEffect(() => {
    const initializeScanner = async () => {
      const result = await scansnap.initialize();
      setScannerInitialized(result === 0);
      if (result !== 0) {
        console.error('Scanner initialization failed with code:', result);
        throw new Error(`Scanner initialization failed with code: ${result}`);
      }
    };

    initializeScanner().catch(err => {
      console.error('Error during scanner initialization:', err);
      setScannerInitialized(false);
      throw err;
    });

    // コンポーネントのアンマウント時にスキャナーをクリーンアップ
    // preserveSession=true を指定して、セッションをローカルストレージに保持
    return () => {
      scansnap.cleanup(true);
    };
  }, []);

  // スキャンイベントのハンドラーを設定
  useEffect(() => {
    if (!scannerInitialized) return;

    scansnap.on('scanFinish', async (fileIds: string[]) => {
      setIsScanning(true);

      try {
        const scanPromises = fileIds.map(async (fileId) => {
          const fileInfo = await scansnap.getBlobData(fileId); // Let errors propagate
          const blob = new Blob([fileInfo], { type: 'image/jpeg' });
          const file = new File([blob], `scan_${nanoid(10)}.jpg`, { type: 'image/jpeg' });

          // 画像をプレビューに追加 (非同期だが、ここでは待たない)
          const reader = new FileReader();
          reader.onload = (event) => {
            const result = event.target?.result;
            if (typeof result === 'string') {
              setImagePreviews(prevPreviews => [...prevPreviews, result]);
            }
          };
          reader.readAsDataURL(file);

          return file;
        });

        const scannedFiles = await Promise.all(scanPromises);
        setImages(prevImages => [...prevImages, ...scannedFiles]);

      } catch (err) {
          console.error("Error processing scanned files:", err);
          // Throw error to be caught by GlobalErrorBoundary
          throw err;
      } finally {
          setIsScanning(false); // Ensure scanning state is reset
      }
    });

    return () => {
      // イベントリスナーのクリーンアップは不要（scansnap内部で管理）
    };
  }, [scannerInitialized]);

  // スキャン実行関数
  const handleScan = async () => {
    if (!scannerInitialized) {
      // Throw error instead of setting local state
      throw new Error('スキャナーが初期化されていません');
    }

    setIsScanning(true);

    try {
      // スキャン設定
      scansnap.state.format = FORMAT.JPEG;
      scansnap.state.colorMode = COLOR_MODE.COLOR;
      scansnap.state.compression = COMPRESSION.LOW;
      scansnap.state.scanMode = SCAN_MODE.SUPER_FINE;
      scansnap.state.scanningSide = SCANNING_SIDE.SIMPLEX;

      // スキャン実行 - let errors propagate
      const result = await scansnap.scan();

      if (result !== 0) {
        // Throw error instead of setting local state
        throw new Error(`スキャンに失敗しました (エラーコード: ${result})`);
      }
    } finally {
      setIsScanning(false); // Ensure scanning state is reset
    }
  };

  // 接続が確立されたら問題を取得
  useEffect(() => {
    if (isConnected) {
      fetchProblemData();
    }
  }, [isConnected, noteId, isCurrentCard]);

  // 問題データを取得する関数
  const fetchProblemData = async () => {
    if (!isConnected) return;

    let data;
    // Let errors from fetchCurrentCard/fetchNoteById propagate
    if (isCurrentCard) {
        data = await fetchCurrentCard();
    } else if (noteId) {
      const noteInfo = await fetchNoteById(noteId);
      if (noteInfo) {
        data = {
          noteId: noteInfo.noteId,
          noteInfo: noteInfo,
          deckName: '', // Assuming deckName is not critical or fetched elsewhere
          question: noteInfo.fields['表面']?.value || '',
          answer: noteInfo.fields['裏面']?.value || ''
        };
      }
    }

      if (data) {
        setProblemData(data);
        if ('noteInfo' in data && data.noteInfo?.fields?.裏面?.value) {
          extractAnswerEntries(data.noteInfo.fields.裏面.value);
        }
      }
  };


  // 裏面の内容から解答エントリを抽出する関数
  const extractAnswerEntries = (backContent: string): { date: string; content: string }[] => {
    if (!backContent) return [];

    const entryRegex = /<div class="answer-entry"><p><strong>([^<]+)<\/strong><\/p>([\s\S]*?)<\/div>/g;
    const entries: { date: string; content: string }[] = [];

    let match;
    while ((match = entryRegex.exec(backContent)) !== null) {
      const dateStr = match[1];
      const content = match[0];
      entries.push({ date: dateStr, content: content });
    }

    if (backContent.includes('<hr><div class="answer-entry">')) {
      const pastAnswerRegex = /<hr><div class="answer-entry"><p><strong>([^<]+)<\/strong><\/p>([\s\S]*?)<\/div>/g;
      while ((match = pastAnswerRegex.exec(backContent)) !== null) {
        const dateStr = match[1];
        const content = match[0];
        if (!entries.some(entry => entry.date === dateStr)) {
          entries.push({ date: dateStr, content: content });
        }
      }
    }

    return entries.sort((a, b) => {
      try {
        const dateA = parse(a.date, 'yyyy/MM/dd HH:mm:ss', new Date());
        const dateB = parse(b.date, 'yyyy/MM/dd HH:mm:ss', new Date());
        return compareDesc(dateA, dateB);
      } catch (e) {
        console.error("Error parsing date for sorting:", a.date, b.date, e);
        return 0; // Keep original order if parsing fails
      }
    });
  };

  // 画像のドロップハンドラー
  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const imageFiles = handleFileDrop(e); // Let errors propagate from handleFileDrop

    if (imageFiles.length > 0) {
      setImages(prevImages => [...prevImages, ...imageFiles]);
      imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          if (result) {
            setImagePreviews(prevPreviews => [...prevPreviews, result]);
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
    if (!problemData) {
      console.error('Attempted to save without problem data.');
      return;
    }
    if (images.length === 0 && !memo.trim() && !solvingTime && !reviewTime) {
      console.warn('Attempted to save with no content.');
      return;
    }

    setSaving(true);

    try {
      let imageFilenames = '';

      if (images.length > 0) {
        const uploadPromises = images.map(image => uploadImage(image, undefined, true));
        const uploadResults = await Promise.all(uploadPromises);

        const successfulUploads = uploadResults.filter(result => result.success);
        if (successfulUploads.length !== images.length) {
           throw new Error('One or more images failed to upload.');
        }
        imageFilenames = successfulUploads.map(result => result.filename).join(',');
      }

      let timeInfo = '';
      if (solvingTime) timeInfo += `【解答時間: ${solvingTime}】`;
      if (reviewTime) {
        if (timeInfo) timeInfo += ' ';
        timeInfo += `【復習時間: ${reviewTime}】`;
      }
      let memoWithTime = memo;
      if (timeInfo) memoWithTime = `${timeInfo}\n${memo}`;

      // Let errors from addAnswerToNote propagate
      await addAnswerToNote(
        problemData.noteId,
        imageFilenames,
        memoWithTime,
        '過去解答' // Assuming '過去解答' is the correct field name or type
      );

      // If successful:
      setSaveSuccess(true);
      const timer = setTimeout(() => setSaveSuccess(false), 3000);

      await fetchProblemData(); // Re-fetch data

      // Reset form
      setMemo('');
      setImages([]);
      setImagePreviews([]);
      setSolvingTime('');
      setReviewTime('');
      resetTimer();

    } finally {
      setSaving(false); // Ensure saving state is reset
    }
  };

  // パネルの表示状態に基づいてグリッドクラスを決定
  const getGridClass = () => {
    if (leftPanelVisible && rightPanelVisible) {
      return "grid grid-cols-1 lg:grid-cols-2 gap-4";
    } else if (leftPanelVisible || rightPanelVisible) {
      return "block";
    } else {
      return "hidden";
    }
  };

  // メディアURLを使用して画像パスを修正する関数
  const processHtml = (html: string) => {
    if (!mediaServerUrl || !html) return html;
    return html.replace(
      /<img\s+src="([^"]+)"/g,
      (match: string, filename: string) => {
        if (filename.startsWith('http://') || filename.startsWith('https://')) {
          return `<img src="${filename}"`;
        }
        return `<img src="${mediaServerUrl}/${filename}"`;
      }
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

      {/* タイマー */}
      <div className="mb-6 p-4 border rounded-lg shadow-sm bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Clock className="w-5 h-5 mr-2 text-gray-600" />
            <h2 className="text-lg font-semibold">解答時間</h2>
          </div>
          <div className="text-2xl font-mono font-bold">{formatTime(elapsedTime)}</div>
        </div>
        <div className="flex justify-center gap-3 mt-3">
          <button
            onClick={startTimer}
            disabled={timerRunning}
            className={`btn ${timerRunning ? 'btn-disabled' : 'btn-success'} flex items-center`}
          >
            <Play className="w-4 h-4 mr-1" />
            開始
          </button>
          <button
            onClick={pauseTimer}
            disabled={!timerRunning}
            className={`btn ${!timerRunning ? 'btn-disabled' : 'btn-warning'} flex items-center`}
          >
            <Pause className="w-4 h-4 mr-1" />
            一時停止
          </button>
          <button
            onClick={resetTimer}
            className="btn btn-error flex items-center"
          >
            <StopCircle className="w-4 h-4 mr-1" />
            リセット
          </button>
        </div>
      </div>

      {!isConnected && connectionChecked && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4 flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 mt-0.5" />
          <div>
            <p className="font-semibold">AnkiConnectに接続できません</p>
            <p>Ankiが起動しているか、AnkiConnectプラグインがインストールされているか確認してください。</p>
            <p className="mt-1">
              <button
                onClick={() => testConnection()}
                className="text-yellow-700 underline"
              >
                再接続を試みる
              </button>
            </p>
          </div>
        </div>
      )}

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

              {/* 解答時間入力フィールド */}
              <div className="mb-4">
                <label htmlFor="solving-time" className="block text-sm font-medium text-gray-700 mb-1">
                  解答時間（分:秒）
                </label>
                <div className="flex items-center">
                  <input
                    id="solving-time"
                    type="text"
                    className="w-24 p-2 border border-gray-300 rounded-md mr-2"
                    placeholder="0:00"
                    value={solvingTime}
                    onChange={(e) => setSolvingTime(e.target.value)}
                    pattern="[0-9]+:[0-5][0-9]"
                  />
                  <span className="text-gray-600">（分:秒）</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  タイマーを使用すると自動的に入力されます
                </p>
              </div>

              {/* 復習時間入力フィールド */}
              <div className="mb-4">
                <label htmlFor="review-time" className="block text-sm font-medium text-gray-700 mb-1">
                  復習時間（分:秒）
                </label>
                <div className="flex items-center">
                  <input
                    id="review-time"
                    type="text"
                    className="w-24 p-2 border border-gray-300 rounded-md mr-2"
                    placeholder="0:00"
                    value={reviewTime}
                    onChange={(e) => setReviewTime(e.target.value)}
                    pattern="[0-9]+:[0-5][0-9]"
                  />
                  <span className="text-gray-600">（分:秒）</span>
                </div>
              </div>

              {/* スキャンボタン */}
              <div className="mb-4 flex justify-center">
                <button
                  className="btn btn-secondary flex items-center"
                  onClick={handleScan}
                  disabled={!scannerInitialized || isScanning}
                >
                  {isScanning ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      スキャン中...
                    </>
                  ) : (
                    <>
                      <Scan className="w-4 h-4 mr-2" />
                      スキャナーで読み取り
                    </>
                  )}
                </button>
              </div>

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
                            className="max-h-48 mx-auto cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEnlargedImage(preview);
                            }}
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
                          <button
                            className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full p-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEnlargedImage(preview);
                            }}
                            title="拡大"
                          >
                            <Maximize className="w-4 h-4" />
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

                      newFiles.forEach(file => {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const result = event.target?.result;
                          if (result && typeof result === 'string') {
                            setImagePreviews(prevPreviews => [...prevPreviews, result]);
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

              {/* 難易度選択 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  難易度を選択（オプション）
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={`btn btn-sm ${selectedEase === 1 ? 'btn-error' : 'btn-outline'} flex items-center`}
                    onClick={() => setSelectedEase(selectedEase === 1 ? null : 1)}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    もう一度(1)
                  </button>
                  <button
                    className={`btn btn-sm ${selectedEase === 2 ? 'btn-warning' : 'btn-outline'} flex items-center`}
                    onClick={() => setSelectedEase(selectedEase === 2 ? null : 2)}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    難しい(2)
                  </button>
                  <button
                    className={`btn btn-sm ${selectedEase === 3 ? 'btn-info' : 'btn-outline'} flex items-center`}
                    onClick={() => setSelectedEase(selectedEase === 3 ? null : 3)}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    普通(3)
                  </button>
                  <button
                    className={`btn btn-sm ${selectedEase === 4 ? 'btn-success' : 'btn-outline'} flex items-center`}
                    onClick={() => setSelectedEase(selectedEase === 4 ? null : 4)}
                  >
                    <ThumbsUp className="w-3 h-3 mr-1" />
                    簡単(4)
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  難易度を選択すると、解答保存時にAnkiに解答結果も登録されます
                </p>
              </div>

              {/* 保存成功メッセージ */}
              {(saveSuccess || answerSuccess) && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                  {saveSuccess && answerSuccess ? (
                    "解答と難易度が正常に保存されました"
                  ) : saveSuccess ? (
                    "解答が正常に保存されました"
                  ) : (
                    "難易度が正常に登録されました"
                  )}
                </div>
              )}

              {/* 保存ボタン */}
              {(() => {
                const hasContentToSave = images.length > 0 || memo.trim() !== '' || solvingTime !== '' || reviewTime !== '';
                const isButtonDisabled =
                  isLoading ||
                  !problemData ||
                  (!hasContentToSave && selectedEase === null) ||
                  saving ||
                  isMediaLoading ||
                  saveSuccess;

                return (
                  <button
                    className="btn btn-primary w-full flex items-center justify-center"
                    onClick={async () => {
                      if (!problemData) return;
                      
                      setSaving(true);
                      try {
                        // 解答内容がある場合は保存
                        if (hasContentToSave) {
                          await handleSave();
                        }
                        
                        // 難易度が選択されている場合は解答結果を登録
                        if (selectedEase !== null) {
                          const success = await answerCard(problemData.noteId, selectedEase);
                          if (success) {
                            setAnswerSuccess(true);
                            setTimeout(() => setAnswerSuccess(false), 3000);
                            setSelectedEase(null);
                          }
                        }
                      } catch (error) {
                        console.error('Failed to save answer or register difficulty:', error);
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={isButtonDisabled}
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {hasContentToSave && selectedEase !== null ? (
                          "解答と難易度を保存"
                        ) : hasContentToSave ? (
                          "解答を保存"
                        ) : (
                          "難易度を登録"
                        )}
                      </>
                    )}
                  </button>
                );
              })()}
            </div>
          )}

          {/* 右側：問題情報 */}
          {rightPanelVisible && (
            <div className="card p-6 border rounded-lg shadow-sm mb-4">
              <h2 className="text-xl font-semibold mb-3 flex items-center">
                <BookOpen className="w-5 h-5 mr-2" />
                問題情報
              </h2>

              {problemData.deckName && (
                <div className="mb-4">
                  <div className="text-sm text-gray-500 mb-1">デッキ</div>
                  <div className="font-medium">{problemData.deckName}</div>
                </div>
              )}

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

              <div className="mb-4">
                <div className="text-sm text-gray-500 mb-1">表面</div>
                <div className="p-3 bg-gray-50 rounded border" dangerouslySetInnerHTML={{
                  __html: processHtml(problemData.question)
                }} />
              </div>

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

              {showAnswer && (
                <div className="mb-4">
                  <div className="text-sm text-gray-500 mb-1">裏面（解答）</div>
                  <div className="p-3 bg-gray-50 rounded border" dangerouslySetInnerHTML={{
                    __html: processHtml(problemData.answer || '解答がありません')
                  }} />
                </div>
              )}


              {showAnswer && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm text-gray-500">過去の解答用紙</div>
                  </div>
                  {problemData.noteInfo?.fields?.過去解答?.value ? (
                    <div className="p-3 bg-gray-50 rounded border" dangerouslySetInnerHTML={{
                      __html: processHtml(problemData.noteInfo.fields.過去解答.value)
                    }} />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded border text-gray-500">過去の解答はありません</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 画像拡大ダイアログ */}
      {enlargedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full">
            <img
              src={enlargedImage}
              alt="拡大画像"
              className="max-h-[90vh] max-w-full object-contain"
            />
            <button
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 shadow-lg"
              onClick={() => setEnlargedImage(null)}
              title="閉じる"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProblemView;
