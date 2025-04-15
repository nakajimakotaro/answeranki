// 保存時に渡すデータの型
export interface ReviewPanelSaveData {
  memo: string;
  images: File[];
  solvingTime: string;
  reviewTime: string;
  selectedEase: 1 | 2 | 3 | 4 | null;
}

// ReviewPanel コンポーネントの Props
export interface ReviewPanelProps {
  cardId: number | undefined; // 解答保存時に必要
  onSave: (data: ReviewPanelSaveData) => Promise<void>;
  isSaving: boolean; // 保存処理中フラグ
  saveSuccess: boolean; // 保存成功フラグ
  saveError: Error | null; // 保存エラー
}

// 子コンポーネントで共通して使う可能性のある Props
export interface CommonPanelProps {
  isSaving: boolean;
  isMediaLoading: boolean; // 画像アップロード中フラグ (SaveSection で使用)
}

export type TimerMode = 'solving' | 'review';

// TimerSection の Props
export interface TimerSectionProps {
  timerMode: TimerMode; // 追加: 現在のタイマーモード
  elapsedTime: number; // 解答経過時間 (ms)
  reviewElapsedTime: number; // 追加: 復習経過時間 (ms)
  timerRunning: boolean;
  onStartTimer: (e?: React.MouseEvent) => void;
  onPauseTimer: (e?: React.MouseEvent) => void;
  onResetTimer: (e?: React.MouseEvent) => void; // 現在のモードのタイマーをリセット
  onToggleMode: (e?: React.MouseEvent) => void; // 解答/復習モードを切り替え
  formatTime: (ms: number) => string;
}

// AccordionContent の Props
export interface AccordionContentProps {
  isAccordionOpen: boolean;
  children: React.ReactNode;
}

// TimeInputSection の Props
export interface TimeInputSectionProps {
  solvingTime: string; // MM:SS 形式
  reviewTime: string; // MM:SS 形式
  timerRunning: boolean;
  timerMode: TimerMode; // 追加: 現在のタイマーモード
  onSolvingTimeChange: (value: string) => void;
  onReviewTimeChange: (value: string) => void;
}

// ScannerSection の Props
export interface ScannerSectionProps {
  scannerInitialized: boolean;
  isScanning: boolean;
  onScan: () => void;
}

// ImageUploadSection の Props
export interface ImageUploadSectionProps {
  imagePreviews: string[];
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  onEnlargeImage: (preview: string) => void;
}

// MemoSection の Props
export interface MemoSectionProps {
  memo: string;
  onMemoChange: (value: string) => void;
}

// DifficultySection の Props
export interface DifficultySectionProps {
  selectedEase: 1 | 2 | 3 | 4 | null;
  onEaseSelect: (ease: 1 | 2 | 3 | 4 | null) => void;
}

// SaveSection の Props
export interface SaveSectionProps extends CommonPanelProps {
  cardId: number | undefined;
  hasContentToSave: boolean;
  selectedEase: 1 | 2 | 3 | 4 | null;
  saveSuccess: boolean;
  saveError: Error | null;
  onSave: () => void;
}

// ImageDialog の Props
export interface ImageDialogProps {
  enlargedImage: string | null;
  onClose: () => void;
}
