import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import isDev from 'electron-is-dev';
import http from 'http';
import url from 'url';

let mainWindow: BrowserWindow | null = null;
let mediaCache: Record<string, string> = {};

function createWindow() {
  // ブラウザウィンドウを作成
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // 開発環境では開発サーバーのURLを、本番環境ではビルドされたファイルを読み込む
  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  // 開発環境の場合はDevToolsを開く
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // ウィンドウが閉じられたときの処理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ファイル名からContent-Typeを取得する関数
const getContentTypeFromFilename = (filename: string): string => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
};

// メディアサーバーの設定
const setupMediaServer = () => {
  const server = http.createServer(async (req, res) => {
    // リクエストURLからファイル名を取得
    const parsedUrl = url.parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '';
    
    // パスからファイル名を抽出（/media/filename.jpg → filename.jpg）
    const filename = decodeURIComponent(pathname.replace(/^\/media\//, ''));
    
    if (!filename) {
      res.statusCode = 400;
      res.end('Bad Request: No filename specified');
      return;
    }
    
    // デバッグログ
    console.log(`Media server request: ${pathname}, filename: ${filename}`);

    try {
      // キャッシュにあればそれを返す
      if (mediaCache[filename]) {
        const base64Data = mediaCache[filename];
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Content-Typeを設定
        const contentType = getContentTypeFromFilename(filename);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24時間キャッシュ
        res.statusCode = 200;
        res.end(buffer);
        return;
      }

      // AnkiConnectからメディアファイルを取得
      const response = await fetch('http://localhost:8765', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'retrieveMediaFile',
          version: 6,
          params: {
            filename
          }
        })
      });

      const data = await response.json() as { result: string, error: string | null };
      
      if (data.error) {
        console.error('AnkiConnect error:', data.error);
        res.statusCode = 404;
        res.end(`File not found: ${filename}`);
        return;
      }

      // 取得したBase64データをバイナリに変換
      const base64Data = data.result;
      const buffer = Buffer.from(base64Data, 'base64');
      
      // キャッシュに保存
      mediaCache[filename] = base64Data;
      
      // Content-Typeを設定
      let contentType = getContentTypeFromFilename(filename);
      
      // AVIFファイルの場合は特別に処理
      if (filename.endsWith('.avif')) {
        contentType = 'image/avif';
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24時間キャッシュ
      res.statusCode = 200;
      res.end(buffer);
    } catch (error) {
      console.error('Error retrieving media file:', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // ポート8766でサーバーを起動
  server.listen(8766, () => {
    console.log('Media server running at http://localhost:8766/');
  });

  // サーバーエラーハンドリング
  server.on('error', (error) => {
    console.error('Media server error:', error);
  });

  return server;
};

// キャッシュをクリアするIPC通信を設定
const setupIpcHandlers = () => {
  ipcMain.handle('clear-media-cache', () => {
    mediaCache = {};
    return true;
  });

  ipcMain.handle('get-media-server-url', () => {
    return 'http://localhost:8766';
  });
};

// Electronの初期化が完了したらウィンドウとサーバーを作成
app.whenReady().then(() => {
  createWindow();
  setupMediaServer();
  setupIpcHandlers();
});

// すべてのウィンドウが閉じられたときの処理（macOSを除く）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// アプリケーションがアクティブになったときの処理（macOS）
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
