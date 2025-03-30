import { useState, useCallback } from 'react';

// AVIF変換のデフォルト品質
const DEFAULT_AVIF_QUALITY = 80;

// メディアサーバーのURL
const MEDIA_SERVER_URL = '/media'; // プロキシ経由でアクセス

/**
 * メディアファイル関連の機能を提供するフック
 */
export function useMediaFiles() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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
   * 画像をAVIF形式に変換する
   * @param base64Data Base64エンコードされた画像データ
   * @param quality 品質（1-100）
   */
  const convertToAvif = useCallback(async (base64Data: string, quality: number = DEFAULT_AVIF_QUALITY) => {
    try {
      const response = await fetch('/api/image/convert-to-avif', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          base64Data,
          quality
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'AVIF変換に失敗しました');
      }
      
      return result.data;
    } catch (error) {
      console.error('AVIF conversion error:', error);
      throw error;
    }
  }, []);

  /**
   * 画像ファイルをAnkiのメディアフォルダにアップロードする
   * @param file 画像ファイル
   * @param filename カスタムファイル名（省略時はファイルの元の名前を使用）
   * @param convertToAvifFormat AVIFに変換するかどうか（デフォルト: true）
   */
  const uploadImage = useCallback(async (
    file: File, 
    filename?: string, 
    convertToAvifFormat: boolean = true
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // ファイル名を決定（カスタム名または元のファイル名）
      const finalFilename = filename || file.name;
      
      // 画像をBase64エンコード
      const base64Data = await encodeImageToBase64(file);
      
      // サーバーAPIを使用してアップロード
      const response = await fetch('/api/image/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          base64Data,
          filename: finalFilename,
          convertToAvif: convertToAvifFormat
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '画像のアップロードに失敗しました');
      }
      
      return {
        filename: result.filename,
        success: true
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
      // メディアサーバーURLを使用
      return `${MEDIA_SERVER_URL}/${filename}`;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('画像の取得に失敗しました'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    try {
      const response = await fetch('/api/clear-cache', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Failed to clear media cache:', error);
      return false;
    }
  }, []);

  return {
    isLoading,
    error,
    encodeImageToBase64,
    convertToAvif,
    uploadImage,
    retrieveImage,
    handleFileDrop,
    clearMediaCache
  };
}
