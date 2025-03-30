# AnswerAnki

Anki学習カードの解答を管理するためのウェブアプリケーション。

## 概要

AnswerAnkiは、Ankiのカードに対する解答をスキャンして保存し、過去の解答を簡単に参照できるようにするアプリケーションです。ScanSnapスキャナーと連携して、解答用紙を直接取り込むことができます。

## 機能

- Ankiカードの表示と検索
- ScanSnapスキャナーからの解答用紙の取り込み
- 解答画像のAVIF形式への変換と保存
- 解答時間の記録
- 過去の解答履歴の表示

## システム要件

- Node.js 18.0以上
- Anki（AnkiConnectプラグインがインストールされていること）
- ScanSnap（オプション、スキャナー機能を使用する場合）

## インストール

1. リポジトリをクローン：

```bash
git clone https://github.com/yourusername/answeranki.git
cd answeranki
```

2. フロントエンドの依存関係をインストール：

```bash
npm install
```

3. サーバーの依存関係をインストール：

```bash
cd server
npm install
cd ..
```

## 使い方

### 開発モード

1. サーバーとフロントエンドを同時に起動：

```bash
npm run dev:all
```

または、別々のターミナルで起動：

```bash
# サーバー
npm run server:dev

# フロントエンド
npm run dev
```

2. ブラウザで http://localhost:5173 にアクセス

### 本番モード

1. ビルド：

```bash
# フロントエンドをビルド
npm run build

# サーバーをビルド
npm run server:build
```

2. 起動：

```bash
npm start
```

3. ブラウザで http://localhost:3000 にアクセス

## 設定

- Ankiは起動し、AnkiConnectプラグインが有効になっている必要があります
- ScanSnapスキャナーを使用する場合は、ScanSnap Web SDKがインストールされている必要があります

## 技術スタック

- フロントエンド：React、TypeScript、Tailwind CSS
- バックエンド：Node.js、Express
- 画像処理：Sharp（AVIF変換）
- 外部連携：AnkiConnect API、ScanSnap Web SDK

## ライセンス

MIT
