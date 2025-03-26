# Answer2Anki - 数学解答スキャン管理アプリケーション

## プロジェクト概要

Ankiと連携して数学の問題解答をスキャン保存・管理するElectronアプリケーション。ユーザーが解いた問題の解答用紙をスキャンし、対応するAnkiカードに保存することで、学習履歴を効率的に管理できます。

## 主要機能

1. **現在解いている問題の取得・表示**
   - 取得したノートの詳細情報（表面、裏面等）を表示

2. **スキャン画像のアップロード**
   - ドラッグ&ドロップによる画像取り込み
   - 画像のBase64エンコード処理
   - AnkiConnectを使用してメディアフォルダに保存

3. **問題解答の保存**
   - 「過去解答」フィールドに画像とメモを追加
   - 既存の解答履歴を保持しつつ追加

4. **デッキ一覧表示**
   - 利用可能なデッキ一覧の取得と表示
   - デッキ選択によるフィルタリング

## 技術スタック

### フロントエンド
React, TypeScript, React Router, Tailwind CSS v4, daisyUI, Lucide Icons

### バックエンド
Electron, Vite

## アプリケーション構造

### ディレクトリ構造
```
answer2anki/
├── package.json
├── vite.config.ts
├── electron.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main/         # Electron メインプロセス
│   ├── renderer/     # フロントエンド (React)
│   │   ├── routes/   # ページコンポーネント
│   │   ├── components/ # UIコンポーネント
│   │   ├── hooks/    # カスタムフック
│   │   └── services/ # サービス層
│   └── styles/       # スタイル設定
└── public/           # 静的ファイル
```

### コンポーネント設計

#### 主要コンポーネント
1. **ルートレイアウト**: サイドバーとメインコンテンツエリアを含む基本レイアウト
2. **問題一覧**: 現在解いている問題のリスト表示
3. **問題詳細**: 選択した問題の詳細表示と解答アップロード機能
4. **スキャンドロップゾーン**: 画像のドラッグ&ドロップ受付エリア
5. **メモエディタ**: 解答に関するメモ入力フォーム
6. **設定画面**: アプリケーション設定の管理

#### 状態管理
- カスタムフックを使用した状態管理
- AnkiConnectとの通信を抽象化するサービス層

## AnkiConnect連携設計

### API通信フロー
1. **問題取得フロー**
   - `notesInfo` APIでノート詳細情報取得
   - 取得したデータをUIに表示

2. **解答保存フロー**
   - 画像をBase64エンコード
   - `storeMediaFile` APIで画像をAnkiメディアフォルダに保存
   - `updateNoteFields` APIで「過去解答」フィールドを更新

### エラーハンドリング
- AnkiConnect接続エラーの検出と表示
- 画像処理エラーの適切な処理
- ユーザーフレンドリーなエラーメッセージ

## UI/UX設計

### 画面レイアウト
1. **サイドバー**
   - アプリケーションロゴ
   - ナビゲーションリンク（問題一覧、設定）
   - バージョン情報

2. **問題一覧画面**
   - 問題カードのグリッド表示
   - 更新ボタン
   - フィルタリングオプション

3. **問題詳細画面**
   - 問題内容表示（表面、裏面）
   - スキャン画像ドロップエリア
   - メモ入力フォーム
   - 保存ボタン
   - 過去解答履歴表示

4. **設定画面**
   - AnkiConnect接続設定
   - 表示オプション

### インタラクション設計
- ドラッグ&ドロップによる直感的な画像取り込み
- リアルタイムプレビュー
- 保存成功時の視覚的フィードバック
- エラー発生時の明確な通知

## 実装ステップ

### フェーズ1: 基本設定（実装済み）
1. プロジェクト初期化（Vite + React + TypeScript）
   - `npm create vite@latest . -- --template react-ts`で初期化
   - 必要なパッケージをインストール
     - React関連: react, react-dom, react-router-dom
     - Electron関連: electron, electron-is-dev, vite-plugin-electron
     - UI関連: @tailwindcss/cli, @tailwindcss/postcss, daisyui, lucide-react

2. Electron設定
   - `src/main/index.ts`にElectronのメインプロセスを実装
   - `vite.config.ts`にElectronプラグインを追加
   - `package.json`に開発用と本番用のスクリプトを追加
     - `"electron:dev": "vite --host && electron ."`
     - `"electron:build": "tsc && vite build && electron-builder"`

3. Tailwind CSS v4 + daisyUI設定
   - `src/styles/tailwind.css`にテーマ設定を実装
   - `index.css`を更新してTailwindとdaisyUIを読み込み
   - カラーパレット、フォント、コンポーネントスタイルを定義

4. React Router設定
   - `App.tsx`にルーティング構造を実装
   - 以下のコンポーネントを作成:
     - `Layout.tsx`: サイドバーとメインコンテンツエリアを含む基本レイアウト
     - `Sidebar.tsx`: ナビゲーションリンクを含むサイドバー
     - `Home.tsx`: 問題一覧ページ（モックデータ使用）
     - `ProblemDetail.tsx`: 問題詳細と解答アップロードページ
     - `Settings.tsx`: アプリケーション設定ページ

### 現在のプロジェクト構造
```
answer2anki/
├── package.json        # 依存関係とスクリプト
├── vite.config.ts      # Vite設定（Electronプラグイン含む）
├── tsconfig.json       # TypeScript設定
├── index.html          # エントリーポイントHTML
└── src/
    ├── main/           # Electron メインプロセス
    │   └── index.ts    # Electronのエントリーポイント
    ├── renderer/       # フロントエンド (React)
    │   ├── routes/     # ページコンポーネント
    │   │   ├── Home.tsx           # 問題一覧ページ
    │   │   ├── ProblemDetail.tsx  # 問題詳細ページ
    │   │   └── Settings.tsx       # 設定ページ
    │   ├── components/ # UIコンポーネント
    │   │   ├── Layout.tsx         # 共通レイアウト
    │   │   └── Sidebar.tsx        # サイドバー
    │   ├── hooks/      # カスタムフック（フェーズ2で実装予定）
    │   └── services/   # サービス層（フェーズ2で実装予定）
    ├── styles/         # スタイル設定
    │   └── tailwind.css # Tailwind設定
    ├── App.tsx         # ルートコンポーネント
    └── index.css       # グローバルスタイル
```

### フェーズ2: AnkiConnect連携
1. AnkiConnectサービス層実装
2. API通信テスト
3. エラーハンドリング実装

### フェーズ3: UI実装
1. ルートレイアウト実装
2. 問題一覧画面実装
3. 問題詳細画面実装
4. ドラッグ&ドロップ機能実装
5. メモエディタ実装

### フェーズ4: 機能統合
1. 全機能の統合
2. エラー処理の改善
3. UI/UXの最終調整

### フェーズ5: パッケージング
1. アプリケーションアイコン設定
2. ビルド設定
3. インストーラー作成

## 開発環境設定

### 必要なパッケージ
- react, react-dom, react-router-dom
- electron, electron-is-dev
- @tailwindcss/cli, @tailwindcss/postcss, daisyui
- lucide-react
- vite, vite-plugin-electron
- typescript

### 開発コマンド
- 開発サーバー起動
- ビルド
- パッケージング

## 注意点と課題

1. **AnkiConnectの接続確認**
   - Ankiが起動していない場合のエラーハンドリング
   - 接続テスト機能の実装

2. **画像処理の最適化**
   - 大きな画像ファイルの効率的な処理
   - 画像圧縮オプションの検討

3. **データ永続化**
   - アプリケーション設定の保存
   - 最近使用したデッキの記憶

4. **パフォーマンス考慮**
   - 多数の問題がある場合のリスト表示最適化
   - 画像プレビューの効率的な処理
