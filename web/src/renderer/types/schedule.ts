/**
 * 大学受験日の試験種別を表す型エイリアス
 */
export type UniversityExamType =
  | '一般入試'
  | '共通テスト'
  | '推薦入試'
  | 'AO入試'
  | '総合型選抜'
  | '模試' // 模試も受験日として管理する場合があるため含める
  | 'その他';

/**
 * ガントチャートやタイムラインで表示するための汎用的なイベント型
 */
export interface TimelineEvent {
  id: string | number; // イベントの一意なID
  title: string;       // イベントのタイトル（タスク名など）
  startDate: Date;     // 開始日時
  endDate?: Date;      // 終了日時（オプション）
  type: 'schedule' | 'exam' | 'mock_exam' | string; // イベントの種別
}
