#!/bin/bash

# AnswerAnki セットアップスクリプト

echo "AnswerAnki セットアップを開始します..."

# フロントエンドの依存関係をインストール
echo "フロントエンドの依存関係をインストールしています..."
npm install

# サーバーの依存関係をインストール
echo "サーバーの依存関係をインストールしています..."
cd server
npm install
cd ..

echo "セットアップが完了しました！"
echo ""
echo "開発モードで起動するには:"
echo "npm run dev:all"
echo ""
echo "本番用にビルドするには:"
echo "npm run build && npm run server:build"
echo ""
echo "本番モードで起動するには:"
echo "npm start"
