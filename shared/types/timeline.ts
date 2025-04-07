import { Exam } from './exam.js';

// Raw event type received from API before parsing dates
export interface RawTimelineEvent {
  id: string;
  type: 'schedule' | 'exam' | 'mock_exam';
  title: string;
  startDate: string;
  endDate?: string;
  details: any;
}

// Type for timeline events after date parsing
export interface TimelineEvent {
  id: string; // Example: "schedule-1", "exam-5", "mock_exam-10"
  type: 'schedule' | 'exam' | 'mock_exam';
  title: string; // Example: "数学 参考書A", "大学X 共通テスト", "第1回 模試Y"
  startDate: Date; // Use Date object
  endDate?: Date; // Use Date object (optional for schedule)
  details: Exam | any;
}
