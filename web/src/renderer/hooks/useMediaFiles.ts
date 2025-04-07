import { useState, useCallback } from 'react';
import { trpc } from '../lib/trpc.js'; // Import tRPC hooks

// AVIF変換のデフォルト品質 (サーバー側で処理されるため、クライアント側では不要になる可能性)
// const DEFAULT_AVIF_QUALITY = 80;

// メディアサーバーのURL (retrieveImageで使用)
const MEDIA_SERVER_URL = '/media';

/**
 * メディアファイル関連の機能を提供するフック (tRPC版)
 */
export function useMediaFiles() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // tRPC mutations
  const convertToAvifMutation = trpc.image.convertToAvif.useMutation();
  const uploadToAnkiMutation = trpc.image.uploadToAnki.useMutation();
  const clearCacheMutation = trpc.media.clearCache.useMutation();

  /**
   * 画像ファイルをBase64エンコードする
   * @param file 画像ファイル
   */
  const encodeImageToBase64 = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const base64Data = reader.result.split(',')[1];
          resolve(base64Data);
        } else {
          reject(new Error('ファイルの読み込みに失敗しました'));
        }
      };
      reader.onerror = () => {
        reject(new Error('ファイルの読み込みに失敗しました'));
      };
      reader.readAsDataURL(file);
    });
  }, []);

  /**
   * 画像をAVIF形式に変換する (tRPC版)
   * @param base64Data Base64エンコードされた画像データ
   */
  const convertToAvif = useCallback(async (base64Data: string): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await convertToAvifMutation.mutateAsync({ base64Data });
      if (result.success && result.data) {
        return result.data;
      } else {
        // エラーメッセージは mutation の onError で捕捉されるか、ここで設定
        throw new Error('AVIF変換に失敗しました (サーバー)');
      }
    } catch (err) {
      console.error('convertToAvif hook error:', err);
      setError(err instanceof Error ? err : new Error('AVIF変換中にエラーが発生しました'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [convertToAvifMutation]);

  /**
   * 画像ファイルをAnkiのメディアフォルダにアップロードする (tRPC版)
   * @param file 画像ファイル
   * @param filename カスタムファイル名（省略時はファイルの元の名前を使用）
   * @param convertToAvifFormat AVIFに変換するかどうか（デフォルト: true）
   */
  const uploadImage = useCallback(async (
    file: File,
    filename?: string,
    convertToAvifFormat: boolean = true
  ): Promise<{ filename: string; success: boolean }> => {
    setIsLoading(true);
    setError(null);
    try {
      const finalFilename = filename || file.name;
      const base64Data = await encodeImageToBase64(file);

      const result = await uploadToAnkiMutation.mutateAsync({
        base64Data,
        filename: finalFilename,
        convertToAvif: convertToAvifFormat,
      });

      if (result.success && result.filename) {
        return { filename: result.filename, success: true };
      } else {
         // エラーは onError で捕捉されるか、ここで設定
        throw new Error('画像のアップロードに失敗しました (サーバー)');
      }
    } catch (err) {
      console.error('uploadImage hook error:', err);
      setError(err instanceof Error ? err : new Error('画像のアップロード中にエラーが発生しました'));
      return { filename: '', success: false };
    } finally {
      setIsLoading(false);
    }
  }, [encodeImageToBase64, uploadToAnkiMutation]);

  /**
   * Ankiのメディアフォルダから画像を取得するためのURLを生成する
   * @param filename ファイル名
   */
  const retrieveImage = useCallback((filename: string): string | null => {
    // この関数は単にURLを返すだけなので、isLoadingやerrorは不要
    if (!filename) return null;
    return `${MEDIA_SERVER_URL}/${filename}`;
  }, []);

  /**
   * ドラッグ&ドロップされたファイルを処理する
   * @param event ドロップイベント
   */
  const handleFileDrop = useCallback((event: React.DragEvent<HTMLDivElement>): File[] => {
    event.preventDefault();
    event.stopPropagation();
    const files = Array.from(event.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    return imageFiles;
  }, []);

  /**
   * メディアキャッシュをクリアする (tRPC版)
   */
  const clearMediaCache = useCallback(async (): Promise<boolean> => {
    setIsLoading(true); // Optionally set loading state
    setError(null);
    try {
      const result = await clearCacheMutation.mutateAsync();
      return result.success;
    } catch (error) {
      console.error('Failed to clear media cache via tRPC hook:', error);
      setError(error instanceof Error ? error : new Error('キャッシュのクリア中にエラーが発生しました'));
      return false;
    } finally {
       setIsLoading(false); // Optionally clear loading state
    }
  }, [clearCacheMutation]);

  return {
    isLoading: isLoading || convertToAvifMutation.isPending || uploadToAnkiMutation.isPending || clearCacheMutation.isPending,
    error: error || convertToAvifMutation.error || uploadToAnkiMutation.error || clearCacheMutation.error,
    encodeImageToBase64,
    convertToAvif,
    uploadImage,
    retrieveImage,
    handleFileDrop,
    clearMediaCache,
  };
}
