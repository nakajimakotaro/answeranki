【前提】
- AnkiConnectは http://localhost:8765 で動作
- 各リクエストは HTTP POST で送信（JSON形式）

2. ノート詳細情報の取得
【エンドポイント】 notesInfo
【目的】取得したノートIDから、各ノートの詳細情報（フィールド内容、タグ、モデルなど）を取得する
【リクエスト例】
{
  "action": "notesInfo",
  "version": 6,
  "params": {
    "notes": [<ノートID1>, <ノートID2>, ...]
  }
}
【レスポンス】
- result: 各ノートの詳細情報が配列形式で返される

3. スキャン画像のアップロード
【エンドポイント】 storeMediaFile
【目的】スキャンした解答用紙画像（Base64エンコード済み）を Anki のメディアフォルダにアップロードする
【リクエスト例】
{
  "action": "storeMediaFile",
  "version": 6,
  "params": {
    "filename": "scanned_image.png",
    "data": "BASE64_ENCODED_IMAGE_DATA"
  }
}
【注意点】
- "BASE64_ENCODED_IMAGE_DATA" は、画像ファイルを Base64 エンコードした文字列に置換

4. メディアファイルの取得
【エンドポイント】 retrieveMediaFile
【目的】Anki のメディアフォルダから指定ファイルを取得する（Base64 エンコード済みデータ）
【リクエスト例】
{
  "action": "retrieveMediaFile",
  "version": 6,
  "params": {
    "filename": "scanned_image.png"
  }
}
【レスポンス】
- result: ファイルの Base64 エンコード済みデータ（存在しない場合はエラー）

5. 既存カードの更新
【エンドポイント】 updateNoteFields
【目的】既存ノートのフィールド（裏面）に、スキャン画像（img タグ経由）や補足メモを追加・更新する
【リクエスト例】
{
  "action": "updateNoteFields",
  "version": 6,
  "params": {
    "note": {
      "id": <ノートID>,
      "fields": {
        "裏面": "解答詳細<br><img src=\"scanned_image.png\"><br>補足メモ"
      }
    }
  }
}
【レスポンス】
- 更新処理の成功状況が返される

6. 特定デッキのリスト取得
【エンドポイント】 deckNames
【目的】Anki に存在する全デッキの名前リストを取得する
【リクエスト例】
{
  "action": "deckNames",
  "version": 6,
  "params": {}
}
【レスポンス】
- result: デッキ名の配列
