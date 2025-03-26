# Answer2Anki

## 概要

Answer2Ankiは、Ankiと連携し、問題演習とその解答（特に手書きの解答用紙）を効率的に管理するためのElectronアプリケーションです。AnkiConnectアドオンを利用してAnkiと通信します。

## 主な機能

*   Ankiデッキから問題（ノート）を取得して表示します。
*   問題に対応する解答用紙（画像ファイル）をAnkiカードの裏面フィールドに関連付けて保存・表示します。
*   ノートのリスト表示、検索（将来的に実装予定）。
*   AnkiConnectへの接続設定とテスト。

## 使用技術

*   [Electron](https://www.electronjs.org/)
*   [React](https://reactjs.org/)
*   [TypeScript](https://www.typescriptlang.org/)
*   [Vite](https://vitejs.dev/)
*   [Tailwind CSS](https://tailwindcss.com/)
*   [AnkiConnect API](https://github.com/FooSoft/anki-connect)

## セットアップ手順

### 前提条件

*   [Anki](https://apps.ankiweb.net/) がインストールされ、起動していること。
*   [AnkiConnect](https://ankiweb.net/shared/info/2055492159) アドオンがAnkiにインストールされ、有効になっていること。

### インストールと起動

1.  **リポジトリをクローン:**
    ```bash
    git clone <リポジトリURL>
    cd answer2anki
    ```

2.  **依存関係をインストール:**
    ```bash
    npm install
    ```

3.  **開発環境で起動:**
    ```bash
    npm run dev
    ```
    これにより、Electronアプリケーションが開発モードで起動します。

4.  **ビルド (配布用):**
    ```bash
    npm run build
    ```
    ビルドされたアプリケーションは `dist` ディレクトリに出力されます。

## 使い方 (概要)

1.  アプリケーションを起動します。
2.  必要に応じて設定画面でAnkiConnectの接続を確認します。
3.  サイドバーからデッキを選択し、問題リストを表示します。
4.  問題を選択すると、表面（問題文）が表示されます。
5.  解答用紙の画像をアップロードすると、Ankiカードの裏面に関連付けられます。

## ライセンス

MIT License
