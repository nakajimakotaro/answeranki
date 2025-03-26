import { useState, useCallback, useEffect } from 'react';
import { ankiConnectService } from '../services/ankiConnectService';

// Electronのコンテキスト分離を回避するための方法
// @ts-ignore
const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;

/**
 * メディアファイル関連の機能を提供するフック
 */
export function useMediaFiles() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [mediaServerUrl, setMediaServerUrl] = useState<string | null>(null);

  // メディアサーバーのURLを取得
  useEffect(() => {
    const getMediaServerUrl = async () => {
      if (!ipcRenderer) {
        console.error('ipcRenderer is not available');
        return;
      }
      
      try {
        const url = await ipcRenderer.invoke('get-media-server-url');
        setMediaServerUrl(url);
      } catch (err) {
        console.error('Failed to get media server URL:', err);
      }
    };

    getMediaServerUrl();
  }, []);

  /**
   * 画像ファイルをBase64エンコードする
   * @param file 画像ファイル
   */
  const encodeImageToBase64 = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // data:image/jpeg;base64,... の形式から、Base64部分のみを抽出
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
   * 画像ファイルをAnkiのメディアフォルダにアップロードする
   * @param file 画像ファイル
   * @param filename カスタムファイル名（省略時はファイルの元の名前を使用）
   */
  const uploadImage = useCallback(async (file: File, filename?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // ファイル名を決定（カスタム名または元のファイル名）
      const finalFilename = filename || file.name;
      
      // タイムスタンプを追加してユニークなファイル名にする
      const timestamp = new Date().getTime();
      const extension = finalFilename.split('.').pop() || 'png';
      const uniqueFilename = `answer_${timestamp}.${extension}`;
      
      // 画像をBase64エンコード
      const base64Data = await encodeImageToBase64(file);
      
      // AnkiConnectを使用してアップロード
      const success = await ankiConnectService.storeMediaFile(uniqueFilename, base64Data);
      
      if (!success) {
        throw new Error('画像のアップロードに失敗しました');
      }
      
      return {
        filename: uniqueFilename,
        success
      };
    } catch (err) {
      setError(err instanceof Error ? err : new Error('画像のアップロードに失敗しました'));
      return {
        filename: '',
        success: false
      };
    } finally {
      setIsLoading(false);
    }
  }, [encodeImageToBase64]);

  /**
   * Ankiのメディアフォルダから画像を取得する
   * @param filename ファイル名
   */
  const retrieveImage = useCallback(async (filename: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // メディアサーバーが利用可能な場合はそちらを使用
      if (mediaServerUrl) {
        return `${mediaServerUrl}/media/${filename}`;
      }
      
      // フォールバック: 直接AnkiConnectから取得
      const base64Data = await ankiConnectService.retrieveMediaFile(filename);
      return `data:image/png;base64,${base64Data}`;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('画像の取得に失敗しました'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [mediaServerUrl]);

  /**
   * ドラッグ&ドロップされたファイルを処理する
   * @param event ドロップイベント
   */
  const handleFileDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    const files = Array.from(event.dataTransfer.files);
    
    // 画像ファイルのみをフィルタリング
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    return imageFiles;
  }, []);

  /**
   * メディアキャッシュをクリアする
   */
  const clearMediaCache = useCallback(async () => {
    if (!ipcRenderer) {
      console.error('ipcRenderer is not available');
      return false;
    }
    
    try {
      await ipcRenderer.invoke('clear-media-cache');
      return true;
    } catch (err) {
      console.error('Failed to clear media cache:', err);
      return false;
    }
  }, []);

  return {
    isLoading,
    error,
    encodeImageToBase64,
    uploadImage,
    retrieveImage,
    handleFileDrop,
    clearMediaCache,
    mediaServerUrl
  };
}
