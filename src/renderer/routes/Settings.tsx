import { useState, useEffect } from 'react';
import { Save, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useAnkiConnect } from '../hooks';
import { ankiConnectService } from '../services';

// ローカルストレージのキー
const STORAGE_KEY = {
  ANKI_CONNECT_URL: 'ankiConnectUrl',
  TEXTBOOK_TAGS: 'textbookTags'
};

const Settings = () => {
  const { isLoading: isConnecting, testConnection, updateConfig } = useAnkiConnect();
  
  const [ankiConnectUrl, setAnkiConnectUrl] = useState('http://localhost:8765');
  const [textbookTags, setTextbookTags] = useState<string[]>([]);
  const [newTextbookTag, setNewTextbookTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'success' | 'error' | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');

  // 初期設定の読み込み
  useEffect(() => {
    const savedUrl = localStorage.getItem(STORAGE_KEY.ANKI_CONNECT_URL);
    const savedTextbookTags = localStorage.getItem(STORAGE_KEY.TEXTBOOK_TAGS);
    
    if (savedUrl) {
      setAnkiConnectUrl(savedUrl);
    }
    
    if (savedTextbookTags) {
      try {
        setTextbookTags(JSON.parse(savedTextbookTags));
      } catch (e) {
        console.error('参考書タグの読み込みに失敗しました:', e);
        setTextbookTags([]);
      }
    }
  }, []);

  // 設定を保存する処理
  const handleSave = async () => {
    setSaving(true);
    
    try {
      // URLが変更された場合は、AnkiConnectの設定も更新
      if (ankiConnectUrl !== localStorage.getItem(STORAGE_KEY.ANKI_CONNECT_URL)) {
        updateConfig({ url: ankiConnectUrl });
      }
      
      // 設定をローカルストレージに保存
      localStorage.setItem(STORAGE_KEY.ANKI_CONNECT_URL, ankiConnectUrl);
      localStorage.setItem(STORAGE_KEY.TEXTBOOK_TAGS, JSON.stringify(textbookTags));
      
      setSaveSuccess(true);
      
      // 3秒後に成功メッセージをクリア
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('設定の保存に失敗しました:', error);
    } finally {
      setSaving(false);
    }
  };
  
  // 参考書タグを追加
  const addTextbookTag = () => {
    if (newTextbookTag.trim() && !textbookTags.includes(newTextbookTag.trim())) {
      setTextbookTags([...textbookTags, newTextbookTag.trim()]);
      setNewTextbookTag('');
    }
  };
  
  // 参考書タグを削除
  const removeTextbookTag = (tagToRemove: string) => {
    setTextbookTags(textbookTags.filter(tag => tag !== tagToRemove));
  };

  // AnkiConnect接続テスト
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    setConnectionMessage('');
    
    try {
      // 一時的に設定を更新（保存はしない）
      updateConfig({ url: ankiConnectUrl });
      
      // 接続テスト
      const connected = await ankiConnectService.testConnection();
      
      if (connected) {
        setConnectionStatus('success');
        setConnectionMessage('AnkiConnectとの接続に成功しました。');
      } else {
        setConnectionStatus('error');
        setConnectionMessage('AnkiConnectとの接続に失敗しました。Ankiが起動しているか確認してください。');
      }
    } catch (error) {
      setConnectionStatus('error');
      setConnectionMessage(error instanceof Error ? error.message : '接続テストに失敗しました');
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="container mx-auto">
      <h1 className="text-2xl font-bold mb-6">設定</h1>
      
      <div className="card max-w-2xl">
        <h2 className="text-xl font-semibold mb-4">AnkiConnect設定</h2>
        
        <div className="mb-6">
          <label htmlFor="anki-connect-url" className="block text-sm font-medium text-gray-700 mb-1">
            AnkiConnect URL
          </label>
          <div className="flex">
            <input
              id="anki-connect-url"
              type="text"
              className="flex-1 p-2 border border-gray-300 rounded-l-md"
              value={ankiConnectUrl}
              onChange={(e) => setAnkiConnectUrl(e.target.value)}
            />
            <button
              className="btn bg-gray-200 text-gray-700 rounded-l-none flex items-center"
              onClick={handleTestConnection}
              disabled={testingConnection || isConnecting}
            >
              {testingConnection || isConnecting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <span>テスト</span>
              )}
            </button>
          </div>
          {connectionStatus === 'success' && (
            <div className="flex items-center text-green-600 text-sm mt-1">
              <CheckCircle className="w-4 h-4 mr-1" />
              <span>{connectionMessage}</span>
            </div>
          )}
          {connectionStatus === 'error' && (
            <div className="flex items-center text-red-600 text-sm mt-1">
              <AlertCircle className="w-4 h-4 mr-1" />
              <span>{connectionMessage}</span>
            </div>
          )}
        </div>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">参考書タグ設定</h3>
          <p className="text-sm text-gray-500 mb-2">
            問題一覧に表示する参考書のタグを設定します。
          </p>
          
          <div className="flex mb-2">
            <input
              type="text"
              className="flex-1 p-2 border border-gray-300 rounded-l-md"
              placeholder="参考書タグを入力..."
              value={newTextbookTag}
              onChange={(e) => setNewTextbookTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addTextbookTag();
                }
              }}
            />
            <button
              className="btn bg-gray-200 text-gray-700 rounded-l-none"
              onClick={addTextbookTag}
            >
              追加
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-2">
            {textbookTags.map((tag, index) => (
              <div key={index} className="bg-gray-100 rounded-full px-3 py-1 flex items-center">
                <span className="mr-1">{tag}</span>
                <button
                  className="text-gray-500 hover:text-red-500"
                  onClick={() => removeTextbookTag(tag)}
                >
                  ×
                </button>
              </div>
            ))}
            {textbookTags.length === 0 && (
              <p className="text-gray-400 text-sm">参考書タグが設定されていません</p>
            )}
          </div>
        </div>
        
        
        <div className="flex items-center justify-between">
          <div>
            {saveSuccess && (
              <span className="text-green-600">設定が保存されました</span>
            )}
          </div>
          <button
            className="btn btn-primary flex items-center"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                設定を保存
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="card max-w-2xl mt-6">
        <h2 className="text-xl font-semibold mb-4">アプリケーション情報</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">バージョン</p>
            <p>1.0.0</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">開発者</p>
            <p>Answer2Anki Team</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
