import React, { useState, useEffect, useMemo } from 'react'; // Import React
import { parseISO, compareAsc, isWithinInterval, startOfToday, differenceInDays, isValid, getYear, format, setMonth, setYear, isBefore } from 'date-fns'; // Import date-fns functions
import { scheduleService, Textbook, StudySchedule, TimelineEvent, Progress } from '../services/scheduleService'; // Removed ExamDate, Import TimelineEvent and Progress
import { Exam } from '../../../shared/types/exam'; // Import shared Exam type
import { BarChart2, BookOpen, Filter, AlertTriangle, CheckCircle, Clock, BookMarked } from 'lucide-react';

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
}: TextbookStackedProgressProps): JSX.Element => { // Add explicit return type
  // 状態管理
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [schedules, setSchedules] = useState<StudySchedule[]>([]);
  const [exams, setExams] = useState<Exam[]>([]); // Use shared Exam type
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]); // Add state for timeline events
  const [progressData, setProgressData] = useState<{[key: number]: Progress}>({}); // Use Progress type
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>(initialSubject);
  const [subjects, setSubjects] = useState<string[]>([]);

  // データ取得
  useEffect(() => {
    fetchData();
  }, []);

  // データを取得する
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null); // Reset error

      // 参考書とタイムラインイベントを取得
      const [textbooksData, timelineEventsData] = await Promise.all([
        scheduleService.getTextbooks(),
        scheduleService.getTimelineEvents() // Fetch all timeline events
      ]);

      setTextbooks(textbooksData);
      setTimelineEvents(timelineEventsData);

      // スケジュールと試験情報をtimelineEventsDataから抽出
      const extractedSchedules = timelineEventsData
        .filter((event): event is TimelineEvent & { details: StudySchedule } => event.type === 'schedule')
        .map(event => event.details);
      // Extract exams using shared Exam type
      const extractedExams = timelineEventsData
        .filter((event): event is TimelineEvent & { details: Exam } => event.type === 'exam' || event.type === 'mock_exam')
        .map(event => event.details);

      setSchedules(extractedSchedules);
      setExams(extractedExams); // Now contains Exam objects

      // 科目リストを抽出
      const subjectList = Array.from(new Set(textbooksData.map((t: Textbook) => t.subject))).sort();
      setSubjects(subjectList);

      // 各参考書の進捗データを取得 (extractedSchedulesを使用)
      const progressPromises = extractedSchedules.map((schedule: StudySchedule) =>
        scheduleService.getProgress(schedule.textbook_id)
      );

      const progressResults: Progress[] = await Promise.all(progressPromises);

      // 進捗データをテキストブックIDをキーとしたオブジェクトに変換
      const progressMap: {[key: number]: Progress} = {}; // Use Progress type
      progressResults.forEach((progress: Progress) => {
        if (progress?.textbook?.id !== undefined) {
          progressMap[progress.textbook.id] = progress;
        }
      });

      setProgressData(progressMap);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('データの取得中にエラーが発生しました');
      setLoading(false);
    }
  };

  // 表示対象の参考書をフィルタリングして並べ替え
  const filteredSchedules = useMemo(() => {
    let filtered = schedules;
    
    // 科目でフィルタリング
    if (selectedSubject) {
      filtered = filtered.filter(schedule => {
        const textbook = textbooks.find(t => t.id === schedule.textbook_id);
        return textbook && textbook.subject === selectedSubject;
      });
    }

    return [...filtered].sort((a, b) => compareAsc(parseISO(a.start_date), parseISO(b.start_date)));
  }, [schedules, textbooks, selectedSubject]);

  if(exams.length > 0) {
    console.log('試験日程:', JSON.stringify(exams[0], null, 2));
  }
  // 試験日程を日付でソート (date-fns を使用) - Use 'date' property
  const sortedExams = useMemo(() => {
    // Filter out exams with invalid dates before sorting
    const validExams = exams.filter(exam => exam.date && isValid(parseISO(exam.date)));
    return [...validExams].sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)));
  }, [exams]);

  // 日付範囲内かどうかを判定 (date-fns を使用) - Use 'date' property
  const isWithinDateRange = (dateString: string) => {
    try {
      const targetDate = parseISO(dateString); // Use dateString parameter
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      if (!isValid(targetDate) || !isValid(start) || !isValid(end)) return false;
      return isWithinInterval(targetDate, { start, end });
    } catch {
      return false; // Handle potential parsing errors
    }
  };

  // 進捗率を計算
  const calculateProgress = (textbookId: number) => {
    const progress = progressData[textbookId]; // Keep only one declaration
    // Add checks for progress and textbook properties
    if (!progress || !progress.textbook || !progress.textbook.total_problems || progress.textbook.total_problems <= 0) {
        return 0;
    }
    // Ensure progress.progress exists and has solvedProblems
    if (!progress.progress || typeof progress.progress.solvedProblems !== 'number') {
        return 0;
    }
    return (progress.progress.solvedProblems / progress.textbook.total_problems) * 100;
  };

  // 予定進捗率を計算 (date-fns を使用)
  const calculatePlannedProgress = (schedule: StudySchedule) => {
    const today = startOfToday();
    const start = parseISO(schedule.start_date);
    const end = parseISO(schedule.end_date);

    if (!isValid(start) || !isValid(end) || differenceInDays(end, start) < 0) return 0; // Invalid range

    if (isBefore(today, start)) return 0; // Not started yet
    if (!isBefore(today, end)) return 100; // Ended or today is the end date

    const totalDays = differenceInDays(end, start) + 1;
    const elapsedDays = differenceInDays(today, start) + 1;

    return totalDays > 0 ? Math.min(100, Math.round((elapsedDays / totalDays) * 100)) : 0;
  };

  // 試験タイプに応じた色を取得 (Use Exam object)
  const getExamTypeColor = (exam: Exam) => {
    // Use is_mock flag first
    if (exam.is_mock) {
      return 'bg-yellow-500'; // Yellow for mocks
    }
    // Then check name or exam_type for keywords
    const nameLower = exam.name.toLowerCase();
    const typeLower = exam.exam_type.toLowerCase(); // exam_type is now string
    if (nameLower.includes('共通') || nameLower.includes('共テ') || typeLower.includes('common')) {
      return 'bg-red-500'; // Red for common tests
    }
    if (nameLower.includes('二次') || typeLower.includes('secondary')) {
      return 'bg-purple-500'; // Purple for secondary tests
    }
    // Default color
    return 'bg-gray-500';
  }; // Removed extra closing brace here

  // 進捗状況に応じたステータスを取得
  const getProgressStatus = (actual: number, planned: number) => {
    const diff = actual - planned;
    
    if (diff >= 10) return { status: '順調', color: 'text-green-500', icon: <CheckCircle className="h-4 w-4 mr-1" /> };
    if (diff >= 0) return { status: 'ほぼ予定通り', color: 'text-blue-500', icon: <CheckCircle className="h-4 w-4 mr-1" /> };
    if (diff >= -10) return { status: 'やや遅れ', color: 'text-yellow-500', icon: <AlertTriangle className="h-4 w-4 mr-1" /> };
    return { status: '遅れ', color: 'text-red-500', icon: <AlertTriangle className="h-4 w-4 mr-1" /> };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>{error}</p>
        <button 
          className="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm"
          onClick={fetchData}
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
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
            {subjects.map((subject, index) => (
              <option key={index} value={subject}>{subject}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* 試験日程 */}
      <div className="mb-6">
        <h3 className="text-md font-medium mb-2 flex items-center">
          <Clock className="h-4 w-4 mr-1" />
          試験日程
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {/* Filter and map using 'date' property */}
          {sortedExams.filter(exam => isWithinDateRange(exam.date)).map((exam, index) => (
            <div
              key={exam.id || index} // Use exam.id if available
              className="flex items-center p-2 rounded-md border border-gray-200"
            >
              {/* Pass the whole exam object to getExamTypeColor */}
              <div className={`w-3 h-3 ${getExamTypeColor(exam)} rounded-full mr-2`}></div>
              <div>
                {/* Display exam.name, potentially prefixing with university_name if not a mock */}
                <div className="text-sm font-medium">
                  {exam.is_mock ? exam.name : (exam.university_name ? `${exam.university_name} ${exam.name}`: exam.name)}
                </div>
                <div className="text-xs text-gray-500">
                  {/* Display exam.date */}
                  {exam.is_mock ? '模試' : '本番'} - {format(parseISO(exam.date), 'yyyy/MM/dd')}
                </div>
              </div>
            </div>
          ))}

          {/* Filter using 'date' property */}
          {sortedExams.filter(exam => isWithinDateRange(exam.date)).length === 0 && (
            <div className="text-sm text-gray-500 col-span-full">
              表示する試験日程がありません
            </div>
          )}
        </div>
      </div>
      
      {/* 参考書積み上げ表示 */}
      <div className="mt-6">
        <h3 className="text-md font-medium mb-4 flex items-center">
          <BookOpen className="h-4 w-4 mr-1" />
          参考書進捗状況
        </h3>
        
        {filteredSchedules.length > 0 ? (
          <div className="space-y-4">
            {filteredSchedules.map((schedule, index) => {
              const textbook = textbooks.find(t => t.id === schedule.textbook_id);
              if (!textbook) return null;
              
              const actualProgress = calculateProgress(textbook.id || 0);
              const plannedProgress = calculatePlannedProgress(schedule);
              const status = getProgressStatus(actualProgress, plannedProgress);
              
              return (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
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
                  
                  <div className="text-xs text-gray-500 mb-2">
                    期間: {schedule.start_date} 〜 {schedule.end_date}
                  </div>
                  
                  {/* 進捗バー */}
                  <div className="relative h-8 bg-gray-100 rounded-md overflow-hidden">
                    {/* 予定進捗 */}
                    <div 
                      className="absolute h-full bg-gray-300 border-r-2 border-gray-400"
                      style={{ width: `${plannedProgress}%` }}
                    >
                      <div className="absolute right-0 top-0 bottom-0 flex items-center -mr-2">
                        <div className="bg-gray-400 text-white text-xs px-1 rounded">
                          予定 {plannedProgress}%
                        </div>
                      </div>
                    </div>
                    
                    {/* 実際の進捗 */}
                    <div 
                      className="absolute h-full bg-primary"
                      style={{ width: `${actualProgress}%` }}
                    >
                      <div className="absolute right-0 top-0 bottom-0 flex items-center -mr-2">
                        <div className="bg-primary text-white text-xs px-1 rounded">
                          実績 {Math.round(actualProgress)}%
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 詳細情報 */}
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">総問題数:</span> {textbook.total_problems}問
                    </div>
                    <div>
                      <span className="text-gray-500">解いた問題:</span> {progressData[textbook.id || 0]?.progress.solvedProblems || 0}問
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <BookMarked className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>表示するスケジュールがありません</p>
          </div>
        )}
      </div>
      
      {/* 凡例 */}
      <div className="mt-8 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium mb-2">凡例</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gray-300 mr-2"></div>
            <span className="text-sm">予定進捗</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-primary mr-2"></div>
            <span className="text-sm">実際の進捗</span>
          </div>
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-sm">順調</span>
          </div>
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />
            <span className="text-sm">遅れ</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextbookStackedProgress;
