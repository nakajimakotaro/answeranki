import { Exam } from './exam.js';

export interface RawTimelineEvent {
  id: string;
  type: 'schedule' | 'exam' | 'mock_exam';
  title: string;
  startDate: string;
  endDate?: string;
  details: any;
}

export interface TimelineEvent {
  id: string;
  type: 'schedule' | 'exam' | 'mock_exam';
  title: string;
  startDate: Date;
  endDate?: Date;
  details: Exam | any;
}
