import { useState, useEffect, useCallback, useRef } from 'react';
import { Edit } from 'lucide-react'; // ChevronDown, ChevronUp を削除
import { useMediaFiles } from '../../hooks/index.js';
import scansnap, { COLOR_MODE, COMPRESSION, FORMAT, SCAN_MODE, SCANNING_SIDE } from '../../../scansnap.js';
import { nanoid } from 'nanoid';
import { ReviewPanelProps, ReviewPanelSaveData, TimerMode } from './types'; // TimerMode をインポート
import TimerSection from './TimerSection';
// import AccordionContent from './AccordionContent'; // AccordionContent を削除
import TimeInputSection from './TimeInputSection';
import ScannerSection from './ScannerSection';
import ImageUploadSection from './ImageUploadSection';
import MemoSection from './MemoSection';
import DifficultySection from './DifficultySection';
import SaveSection from './SaveSection';
import ImageDialog from './ImageDialog';

/**
 * レビュー専用のコントロールパネルコンポーネント (分割後)
 */
const ReviewPanel = ({
  cardId,
  onSave,
  isSaving,
  saveSuccess,
  saveError
}: ReviewPanelProps) => {
  const {
    handleFileDrop,
    isLoading: isMediaLoading,
  } = useMediaFiles();

  const [memo, setMemo] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerInitialized, setScannerInitialized] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<TimerMode>('solving'); // 'solving' or 'review'
  const [elapsedTime, setElapsedTime] = useState(0); // 解答経過時間 (ms)
  const [reviewElapsedTime, setReviewElapsedTime] = useState(0); // 復習経過時間 (ms)
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [solvingTime, setSolvingTime] = useState(''); // MM:SS 形式
  const [reviewTime, setReviewTime] = useState(''); // MM:SS 形式
  const [selectedEase, setSelectedEase] = useState<1 | 2 | 3 | 4 | null>(null);
  // const [isAccordionOpen, setIsAccordionOpen] = useState(false); // isAccordionOpen を削除

  // --- Timer Functions ---
  const formatTime = useCallback((ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    // MM:SS 形式の文字列を返すヘルパー関数
    const formatMMSS = (m: number, s: number) => `${m}:${s.toString().padStart(2, '0')}`;
    // formatTime は表示用 (X分Y秒)
    return `${minutes}分${seconds}秒`;
  }, []);

  const formatMMSS = useCallback((ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // タイマーを開始するコアロジック
  const startTimerInternal = useCallback(() => {
    if (timerRunning) return; // 既に実行中なら何もしない
    setTimerRunning(true);
    const currentElapsedTime = timerMode === 'solving' ? elapsedTime : reviewElapsedTime;
    startTimeRef.current = Date.now() - currentElapsedTime;
    timerRef.current = window.setInterval(() => {
      if (startTimeRef.current !== null) {
        const newElapsedTime = Date.now() - startTimeRef.current;
        if (timerMode === 'solving') {
          setElapsedTime(newElapsedTime);
        } else {
          setReviewElapsedTime(newElapsedTime);
        }
      }
    }, 100);
  }, [timerRunning, timerMode, elapsedTime, reviewElapsedTime]); // 依存配列は変更なし

  // イベントハンドラとしての startTimer
  const startTimer = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    startTimerInternal(); // 内部ロジックを呼び出す
  }, [startTimerInternal]);

  const pauseTimer = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!timerRunning) return;
    setTimerRunning(false);
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // タイマー停止時に現在の経過時間を MM:SS 形式で確定
    if (timerMode === 'solving') {
      setSolvingTime(formatMMSS(elapsedTime));
    } else {
      setReviewTime(formatMMSS(reviewElapsedTime));
    }
  }, [timerRunning, timerMode, elapsedTime, reviewElapsedTime, formatMMSS]);

  // resetTimer は現在のモードのタイマーのみをリセットする
  const resetTimer = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    pauseTimer();

    if (timerMode === 'solving') {
      setElapsedTime(0);
      setSolvingTime('');
    } else {
      setReviewElapsedTime(0);
      setReviewTime('');
    }
    startTimeRef.current = null;
  }, [pauseTimer, timerMode, formatMMSS]);

  // 新しいモード切替関数
  const toggleTimerMode = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    pauseTimer();
    setTimerMode(prevMode => prevMode === 'solving' ? 'review' : 'solving');
  }, [pauseTimer]);


  // elapsedTime または reviewElapsedTime が変更されたら、対応する MM:SS 形式のステートを更新
  useEffect(() => {
    if (timerRunning) {
      if (timerMode === 'solving') {
        setSolvingTime(formatMMSS(elapsedTime));
      } else {
        setReviewTime(formatMMSS(reviewElapsedTime));
      }
    }
  }, [elapsedTime, reviewElapsedTime, timerRunning, timerMode, formatMMSS]);


  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  // --- Timer Functions End ---

  // --- Auto Start Timer ---
  useEffect(() => {
    // cardId があり、タイマーが実行中でなく、解答モードの場合にタイマーを開始
    if (cardId && !timerRunning && timerMode === 'solving') {
      startTimerInternal();
    }
    // cardId が変更されたら（新しい問題が表示されたら）、タイマーをリセットして開始
    // ただし、初回マウント時や cardId が null -> 有効 になった場合はリセットしない
    // このロジックは少し複雑になるため、まずは自動開始のみ実装
    // TODO: カードが変わったときにタイマーをリセットするかどうか検討
  }, [cardId, timerRunning, timerMode, startTimerInternal]); // cardId と timerMode を依存配列に追加
  // --- Auto Start Timer End ---


  // --- Scanner Logic ---
  useEffect(() => {
    const initializeScanner = async () => {
      try {
        const result = await scansnap.initialize();
        setScannerInitialized(result === 0);
        if (result !== 0) console.error('Scanner initialization failed:', result);
      } catch (err) {
        console.error('Error initializing scanner:', err);
        setScannerInitialized(false);
      }
    };
    initializeScanner();
    return () => { scansnap.cleanup(true); };
  }, []);

  useEffect(() => {
    if (!scannerInitialized) return;
    const handleScanFinish = async (fileIds: string[]) => {
      setIsScanning(true);
      try {
        const scanPromises = fileIds.map(async (fileId) => {
          const fileInfo = await scansnap.getBlobData(fileId);
          const blob = new Blob([fileInfo], { type: 'image/jpeg' });
          const file = new File([blob], `scan_${nanoid(10)}.jpg`, { type: 'image/jpeg' });
          const reader = new FileReader();
          reader.onload = (event) => {
            const result = event.target?.result;
            if (typeof result === 'string') {
              setImagePreviews(prev => [...prev, result]);
            }
          };
          reader.readAsDataURL(file);
          return file;
        });
        const scannedFiles = await Promise.all(scanPromises);
        setImages(prev => [...prev, ...scannedFiles]);
      } catch (err) {
        console.error("Error processing scanned files:", err);
      } finally {
        setIsScanning(false);
      }
    };
    scansnap.on('scanFinish', handleScanFinish);
  }, [scannerInitialized]);

  const handleScan = useCallback(async () => {
    if (!scannerInitialized) {
      console.error('Scanner not initialized.');
      return;
    }
    setIsScanning(true);
    try {
      scansnap.state.format = FORMAT.JPEG;
      scansnap.state.colorMode = COLOR_MODE.COLOR;
      scansnap.state.compression = COMPRESSION.LOW;
      scansnap.state.scanMode = SCAN_MODE.SUPER_FINE;
      scansnap.state.scanningSide = SCANNING_SIDE.SIMPLEX;
      const result = await scansnap.scan();
      if (result !== 0) throw new Error(`Scanner error: ${result}`);
    } catch (err) {
      console.error("Scanner error:", err);
    }
    // setIsScanning(false); // Handled by event listener
  }, [scannerInitialized]);
  // --- Scanner Logic End ---

  // --- Image Drop Handler ---
  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const imageFiles = handleFileDrop(e);
    if (imageFiles.length > 0) {
      setImages(prev => [...prev, ...imageFiles]);
      imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          if (result) setImagePreviews(prev => [...prev, result]);
        };
        reader.readAsDataURL(file);
      });
    }
  }, [handleFileDrop]);
  // --- Image Drop Handler End ---

  // --- Image File Change Handler ---
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setImages(prev => [...prev, ...newFiles]);
      newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          if (result) setImagePreviews(prev => [...prev, result]);
        };
        reader.readAsDataURL(file);
      });
    }
  }, []);
  // --- Image File Change Handler End ---

  // --- Image Remove ---
  const removeImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  }, []);
  // --- Image Remove End ---

  // --- Drag Over ---
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);
  // --- Drag Over End ---

  // --- Save Logic ---
  const handleInternalSave = useCallback(async () => {
    if (!cardId) {
      console.error('Cannot save without cardId.');
      return;
    }
    const hasContentToSave = images.length > 0 || memo.trim() !== '' || solvingTime !== '' || reviewTime !== '';
    if (!hasContentToSave && selectedEase === null) {
      console.warn('No content or difficulty to save.');
      return;
    }

    // Stop any running timer before saving
    pauseTimer();

    await onSave({ memo, images, solvingTime, reviewTime, selectedEase });

    // Reset state after successful save (or attempt)
    setMemo('');
    setImages([]);
    setImagePreviews([]);
    setSolvingTime(''); // Clear input display
    setReviewTime(''); // Clear input display
    setElapsedTime(0); // Reset timer value
    setReviewElapsedTime(0); // Reset timer value
    setTimerMode('solving'); // Reset mode to solving
    setSelectedEase(null);
    // setIsAccordionOpen(false); // アコーディオン状態のリセットを削除
    // Ensure timer interval is cleared and refs are null
    // pauseTimer(); // Already called above

  }, [cardId, images, memo, solvingTime, reviewTime, selectedEase, onSave, pauseTimer]); // resetTimer removed, pauseTimer added
  // --- Save Logic End ---

  // --- Other Handlers ---
  // const handleToggleAccordion = useCallback(() => setIsAccordionOpen(prev => !prev), []); // アコーディオン切り替えハンドラを削除
  const handleEnlargeImage = useCallback((preview: string) => setEnlargedImage(preview), []);
  const handleCloseDialog = useCallback(() => setEnlargedImage(null), []);
  const handleEaseSelect = useCallback((ease: 1 | 2 | 3 | 4 | null) => setSelectedEase(ease), []);
  const handleMemoChange = useCallback((value: string) => setMemo(value), []);
  const handleSolvingTimeChange = useCallback((value: string) => setSolvingTime(value), []);
  const handleReviewTimeChange = useCallback((value: string) => setReviewTime(value), []);
  // --- Other Handlers End ---

  const hasContentToSave = images.length > 0 || memo.trim() !== '' || solvingTime !== '' || reviewTime !== '';

  return (
    <>
      {/* Adjusted container styling: added border, rounded corners, shadow, padding, and spacing between elements */}
      <div
        className="bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden scrollbar-hidden mb-6 p-4 space-y-4"
      >
        {/* Panel Header - Not clickable anymore, simplified */}
        <div
          className="flex items-center"
        >
          {/* Title */}
          <h3 className="text-lg font-semibold flex items-center"> {/* Increased title size */}
            <Edit className="w-5 h-5 mr-2 text-gray-600 flex-shrink-0" /> {/* Adjusted icon size/color */}
            <span>レビュー入力</span> {/* Changed title text */}
          </h3>
          {/* Removed toggle icon */}
        </div>

        {/* Timer Section - Placed inside the main div */}
        <TimerSection
          timerMode={timerMode}
          elapsedTime={elapsedTime}
          reviewElapsedTime={reviewElapsedTime}
          timerRunning={timerRunning}
          onStartTimer={startTimer}
          onPauseTimer={pauseTimer}
          onResetTimer={resetTimer}
          onToggleMode={toggleTimerMode}
          formatTime={formatTime}
        />

        {/* Content Sections - Always visible, removed AccordionContent wrapper */}
        {/* Added spacing between sections implicitly via parent's space-y-4 */}
        <TimeInputSection
          solvingTime={solvingTime}
          reviewTime={reviewTime}
            timerRunning={timerRunning}
            timerMode={timerMode} // timerMode を渡す
            onSolvingTimeChange={handleSolvingTimeChange}
            onReviewTimeChange={handleReviewTimeChange}
          />
          <ScannerSection
            scannerInitialized={scannerInitialized}
            isScanning={isScanning}
            onScan={handleScan}
          />
          <ImageUploadSection
            imagePreviews={imagePreviews}
            onDrop={onDrop}
            onDragOver={handleDragOver}
            onFileChange={handleFileChange}
            onRemoveImage={removeImage}
            onEnlargeImage={handleEnlargeImage}
          />
          <MemoSection
            memo={memo}
            onMemoChange={handleMemoChange}
          />
          <DifficultySection
            selectedEase={selectedEase}
            onEaseSelect={handleEaseSelect}
          />
          <SaveSection
            cardId={cardId}
            hasContentToSave={hasContentToSave}
            selectedEase={selectedEase}
            isSaving={isSaving}
            isMediaLoading={isMediaLoading}
            saveSuccess={saveSuccess}
            saveError={saveError}
            onSave={handleInternalSave}
          />
        {/* Removed closing AccordionContent tag */}
      </div>

      {/* Image Enlargement Dialog */}
      <ImageDialog
        enlargedImage={enlargedImage}
        onClose={handleCloseDialog}
      />
    </>
  );
};

export default ReviewPanel;
