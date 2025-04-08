import React, { useState, useMemo } from 'react';
import { compareAsc, isWithinInterval, startOfToday, differenceInDays, getYear, format, setMonth, setYear, isBefore, parseISO } from 'date-fns';
import { trpc } from '../lib/trpc';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../../../server/src/router';
import type { Exam } from '../../../../shared/types/exam';
import type { StudySchedule } from '../../../../shared/schemas/schedule';
import { BarChart2, BookOpen, Filter, AlertTriangle, CheckCircle, Clock, BookMarked, Loader2 } from 'lucide-react';

// Infer tRPC types
type RouterOutput = inferRouterOutputs<AppRouter>;
type TextbookOutput = RouterOutput['textbook']['getTextbooks'][number];
type TimelineEventOutput = RouterOutput['schedule']['getTimelineEvents'][number];
interface ProgressOutput {
    textbook: TextbookOutput;
    schedule?: StudySchedule;
    progress: {
        solvedProblems: number;
    };
}


interface TextbookStackedProgressProps {
  startDate?: string; // デフォルト: 4/1
  endDate?: string;   // デフォルト: 3/31
  initialSubject?: string;
}

/**
 * 参考書積み上げ進捗コンポーネント
 * 参考書を下から上に積み上げて表示し、予定と実際の進捗を比較する
 */
const TextbookStackedProgress = ({
  // Use date-fns for default dates in 'yyyy-MM-dd' format
  startDate = format(setMonth(setYear(new Date(), getYear(new Date())), 3), 'yyyy-MM-dd'), // Current year's April 1st
  endDate = format(setMonth(setYear(new Date(), getYear(new Date()) + 1), 2), 'yyyy-MM-dd'), // Next year's March 31st
  initialSubject
}: TextbookStackedProgressProps): React.ReactElement | null => { // Use React.ReactElement or null
  // 状態管理 (Filter state)
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>(initialSubject);

  // --- tRPC Queries ---
  const { data: textbooksData, isLoading: isLoadingTextbooks, error: errorTextbooks } = trpc.textbook.getTextbooks.useQuery(
      undefined, { staleTime: 5 * 60 * 1000 }
  );

  const { data: rawTimelineEvents, isLoading: isLoadingTimeline, error: errorTimeline } = trpc.schedule.getTimelineEvents.useQuery(
      undefined, { staleTime: 5 * 60 * 1000 }
  );

  const progressData: { [key: number]: ProgressOutput } = {}; // Placeholder

  // --- Derived State and Data Processing ---

  // Process timeline events once raw data is available
  const { schedules, exams } = useMemo(() => {
      if (!rawTimelineEvents) return { schedules: [], exams: [] };
      const eventsToProcess = Array.isArray(rawTimelineEvents) ? rawTimelineEvents : [];

      // Dates should already be Date objects due to superjson
      const processedEvents = eventsToProcess.map(event => ({
          ...event,
      }));

      const extractedSchedules: StudySchedule[] = processedEvents
          .filter((event): event is typeof event & { type: 'schedule', details: StudySchedule } =>
              event.type === 'schedule'
          )
          .map(event => event.details);

      const extractedExams: Exam[] = processedEvents
          .filter((event): event is typeof event & { type: 'exam' | 'mock_exam', details: Exam } =>
              event.type === 'exam' || event.type === 'mock_exam'
          )
          .map(event => event.details);

      return { schedules: extractedSchedules, exams: extractedExams };
  }, [rawTimelineEvents]);

  // Extract unique subjects from textbooks data
  const subjects = useMemo(() => {
      if (!textbooksData) return [];
      // Use TextbookOutput type here
      const subjectList = Array.from(new Set(textbooksData.map((t: TextbookOutput) => t.subject))).sort();
      return subjectList;
  }, [textbooksData]);


  // Filter schedules based on selected subject
  const filteredSchedules = useMemo(() => {
    if (!textbooksData) return [];
    let filtered = schedules;

    // Filter by subject
    if (selectedSubject) {
      filtered = filtered.filter(schedule => {
        // Use textbooksData from useQuery
        const textbook = textbooksData.find(t => t.id === schedule.textbook_id);
        return textbook && textbook.subject === selectedSubject;
      });
    }

    // Sort using Date objects directly
    return [...filtered].sort((a, b) => compareAsc(a.start_date, b.start_date));
  }, [schedules, textbooksData, selectedSubject]);

  // Sort exams by date (assuming date is a Date object)
  const sortedExams = useMemo(() => {
    const validExams = exams.filter(exam => exam.date instanceof Date); // Check if it's a Date object
    // Sort using Date objects directly
    return [...validExams].sort((a, b) => compareAsc(a.date!, b.date!));
  }, [exams]);

  // Function now accepts Date object
  const isWithinDateRange = (targetDate: Date): boolean => {
    // startDate and endDate are strings from props/defaults, need parsing here
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return isWithinInterval(targetDate, { start, end });
  };

  const calculateProgress = (textbookId: number): number => {
    const progress = progressData[textbookId];
    const textbook = textbooksData?.find(t => t.id === textbookId);

    if (!progress?.progress || typeof progress.progress.solvedProblems !== 'number' || !textbook?.total_problems || textbook.total_problems <= 0) {
        return 0;
    }
    return (progress.progress.solvedProblems / textbook.total_problems) * 100;
  };

  // Calculate planned progress percentage using Date objects
  const calculatePlannedProgress = (schedule: StudySchedule): number => {
    const today = startOfToday();
    const start = schedule.start_date; // Already Date object
    const end = schedule.end_date;     // Already Date object

    const totalDurationDays = differenceInDays(end, start);
    if (totalDurationDays < 0) return 0;

    if (isBefore(today, start)) return 0;
    if (!isBefore(today, end)) return 100;

    const elapsedDays = differenceInDays(today, start);
    const totalDays = totalDurationDays + 1;

    return totalDays > 0 ? Math.min(100, Math.round(((elapsedDays + 1) / totalDays) * 100)) : 0;
  };

  // Get color based on exam type
  const getExamTypeColor = (exam: Exam): string => {
    if (exam.is_mock) return 'bg-yellow-500';
    const nameLower = exam.name?.toLowerCase() ?? '';
    const typeLower = exam.exam_type?.toLowerCase() ?? ''; // exam_type might be null
    if (nameLower.includes('共通') || nameLower.includes('共テ') || typeLower.includes('common')) return 'bg-red-500';
    if (nameLower.includes('二次') || typeLower.includes('secondary')) return 'bg-purple-500';
    return 'bg-gray-500'; // Default
  };

  // Get progress status based on actual vs planned
  const getProgressStatus = (actual: number, planned: number): { status: string; color: string; icon: React.ReactElement } => {
    const diff = actual - planned;
    if (diff >= 10) return { status: '順調', color: 'text-green-500', icon: <CheckCircle className="h-4 w-4 mr-1" /> };
    if (diff >= 0) return { status: 'ほぼ予定通り', color: 'text-blue-500', icon: <CheckCircle className="h-4 w-4 mr-1" /> };
    if (diff >= -10) return { status: 'やや遅れ', color: 'text-yellow-500', icon: <AlertTriangle className="h-4 w-4 mr-1" /> };
    return { status: '遅れ', color: 'text-red-500', icon: <AlertTriangle className="h-4 w-4 mr-1" /> };
  };

  // --- Loading and Error Handling ---
  const isLoading = isLoadingTextbooks || isLoadingTimeline;
  const queryError = errorTextbooks || errorTimeline;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (queryError) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>データの読み込み中にエラーが発生しました: {queryError.message}</p>
      </div>
    );
  }

  // --- Render Logic ---
  if (!textbooksData) {
      return (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
              参考書データがまだ読み込まれていません。
          </div>
      );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header and Subject Filter */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold flex items-center">
          <BarChart2 className="mr-2" />
          参考書積み上げ進捗状況
        </h2>
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            className="p-2 border border-gray-300 rounded-md"
            value={selectedSubject || ''}
            onChange={(e) => setSelectedSubject(e.target.value || undefined)}
          >
            <option value="">全科目</option>
            {/* Use subjects derived from textbooksData */}
            {subjects.map((subject, index) => (
              <option key={index} value={subject}>{subject}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Exam Dates Section */}
      <div className="mb-6">
        <h3 className="text-md font-medium mb-2 flex items-center">
          <Clock className="h-4 w-4 mr-1" />
          試験日程 (期間内)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {/* Pass Date object directly to isWithinDateRange */}
          {sortedExams.filter(exam => exam.date && isWithinDateRange(exam.date)).map((exam, index) => (
            <div key={exam.id ?? index} className="flex items-center p-2 rounded-md border border-gray-200">
              <div className={`w-3 h-3 ${getExamTypeColor(exam)} rounded-full mr-2 flex-shrink-0`}></div>
              <div>
                <div className="text-sm font-medium truncate" title={exam.name}>
                  {exam.is_mock ? exam.name : (exam.university_name ? `${exam.university_name} ${exam.name}` : exam.name)}
                </div>
                <div className="text-xs text-gray-500">
                  {/* Format Date object directly */}
                  {exam.is_mock ? '模試' : '本番'} - {exam.date ? format(exam.date, 'yyyy/MM/dd') : '-'}
                </div>
              </div>
            </div>
          ))}
          {/* Pass Date object directly to isWithinDateRange */}
          {sortedExams.filter(exam => exam.date && isWithinDateRange(exam.date)).length === 0 && (
            <div className="text-sm text-gray-500 col-span-full">期間内に表示する試験日程がありません</div>
          )}
        </div>
      </div>

      {/* Textbook Progress Section */}
      <div className="mt-6">
        <h3 className="text-md font-medium mb-4 flex items-center">
          <BookOpen className="h-4 w-4 mr-1" />
          参考書進捗状況
        </h3>
        {filteredSchedules.length > 0 ? (
          <div className="space-y-4">
            {filteredSchedules.map((schedule) => {
              // Find textbook using textbooksData from useQuery
              const textbook = textbooksData.find(t => t.id === schedule.textbook_id);
              if (!textbook) return null;

              const actualProgress = calculateProgress(textbook.id);
              const plannedProgress = calculatePlannedProgress(schedule);
              const status = getProgressStatus(actualProgress, plannedProgress);

              return (
                <div key={schedule.id ?? textbook.id} className="border border-gray-200 rounded-lg p-4">
                  {/* Textbook Info and Status */}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium">{textbook.title}</h4>
                      <div className="text-sm text-gray-500">{textbook.subject}</div>
                    </div>
                    <div className={`flex items-center text-sm ${status.color}`}>
                      {status.icon}
                      {status.status}
                    </div>
                  </div>
                  {/* Schedule Dates (Format Date objects directly) */}
                  <div className="text-xs text-gray-500 mb-2">
                    期間: {format(schedule.start_date, 'yyyy/MM/dd')} 〜 {format(schedule.end_date, 'yyyy/MM/dd')}
                  </div>
                  {/* Progress Bar */}
                  <div className="relative h-8 bg-gray-100 rounded-md overflow-hidden group">
                    {/* Planned Progress */}
                    <div
                      className="absolute h-full bg-gray-300 border-r-2 border-gray-400 transition-all duration-300 ease-out"
                      style={{ width: `${plannedProgress}%` }}
                      title={`予定: ${plannedProgress}%`}
                    >
                       <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                         予定 {plannedProgress}%
                       </span>
                    </div>
                    {/* Actual Progress */}
                    <div
                      className="absolute h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${actualProgress}%` }}
                       title={`実績: ${Math.round(actualProgress)}%`}
                    >
                      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                         実績 {Math.round(actualProgress)}%
                       </span>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">総問題数:</span> {textbook.total_problems}問
                    </div>
                    <div>
                      <span className="text-gray-500">解いた問題:</span> {progressData[textbook.id]?.progress?.solvedProblems ?? 'N/A'}問 {/* Keep N/A for placeholder */}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <BookMarked className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>{selectedSubject ? `${selectedSubject}のスケジュールがありません` : '表示するスケジュールがありません'}</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-8 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium mb-2">凡例</h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <div className="flex items-center"><div className="w-3 h-3 bg-gray-300 mr-1.5 rounded-sm"></div>予定進捗</div>
          <div className="flex items-center"><div className="w-3 h-3 bg-primary mr-1.5 rounded-sm"></div>実際の進捗</div>
          <div className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-1" />順調</div>
          <div className="flex items-center"><CheckCircle className="h-4 w-4 text-blue-500 mr-1" />ほぼ予定通り</div>
          <div className="flex items-center"><AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />やや遅れ</div>
          <div className="flex items-center"><AlertTriangle className="h-4 w-4 text-red-500 mr-1" />遅れ</div>
        </div>
      </div>
    </div>
  );
};

export default TextbookStackedProgress;
