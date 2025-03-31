import { useState, useEffect, useMemo } from 'react';
import { scheduleService, Textbook, StudySchedule, ExamDate } from '../services/scheduleService';
import { Calendar, BookOpen, Filter, AlertTriangle, CheckCircle, Clock, BookMarked } from 'lucide-react';
import { mockExamService, MockExam } from '../services/mockExamService';

interface TextbookScheduleTimelineProps {
  startDate?: string; // デフォルト: 4/1
  endDate?: string;   // デフォルト: 3/31
  initialSubject?: string;
}

/**
 * 参考書スケジュールタイムラインコンポーネント
 * 参考書の予定期間と実際の進捗を時系列で表示する
 */
const TextbookScheduleTimeline = ({
  startDate = `${new Date().getFullYear()}/04/01`,
  endDate = `${new Date().getFullYear() + 1}/03/31`,
  initialSubject
}: TextbookScheduleTimelineProps) => {
  // 状態管理
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [schedules, setSchedules] = useState<StudySchedule[]>([]);
  const [exams, setExams] = useState<ExamDate[]>([]);
  const [mockExams, setMockExams] = useState<MockExam[]>([]);
  const [progressData, setProgressData] = useState<{[key: number]: any}>({});
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
      
      // 参考書、スケジュール、試験日程、模試を取得
      const [textbooksData, schedulesData, examsData, mockExamsData] = await Promise.all([
        scheduleService.getTextbooks(),
        scheduleService.getSchedules(),
        scheduleService.getExams(),
        mockExamService.getAllMockExams()
      ]);
      
      setTextbooks(textbooksData);
      setSchedules(schedulesData);
      setExams(examsData);
      setMockExams(mockExamsData);
      
      // 科目リストを抽出
      const subjectList = Array.from(new Set(textbooksData.map(t => t.subject))).sort();
      setSubjects(subjectList);
      
      // 各参考書の進捗データを取得
      const progressPromises = schedulesData.map(schedule => 
        scheduleService.getProgress(schedule.textbook_id)
      );
      
      const progressResults = await Promise.all(progressPromises);
      
      // 進捗データをテキストブックIDをキーとしたオブジェクトに変換
      const progressMap: {[key: number]: any} = {};
      progressResults.forEach(progress => {
        if (progress.textbook && progress.textbook.id) {
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

  // 表示対象の参考書をフィルタリング
  const filteredSchedules = useMemo(() => {
    if (!selectedSubject) return schedules;
    return schedules.filter(schedule => {
      const textbook = textbooks.find(t => t.id === schedule.textbook_id);
      return textbook && textbook.subject === selectedSubject;
    });
  }, [schedules, textbooks, selectedSubject]);

  // タイムラインの日付範囲を計算
  const timelineRange = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // 月ごとの区切りを作成
    const months = [];
    let currentDate = new Date(start);
    
    while (currentDate <= end) {
      months.push({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
        label: `${currentDate.getMonth() + 1}月`
      });
      
      // 次の月へ
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    // 総日数を計算
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return {
      startDate: start,
      endDate: end,
      totalDays,
      months
    };
  }, [startDate, endDate]);

  // 日付から位置（パーセント）を計算
  const getPositionPercent = (date: string) => {
    // 日付文字列を正規化
    const dateStr = date.replace(/(\d{4})[^\d]?(\d{2})[^\d]?(\d{2})/, '$1/$2/$3');
    const targetDate = new Date(dateStr);
    
    const start = timelineRange.startDate;
    const totalDays = timelineRange.totalDays;
    
    const daysDiff = Math.ceil((targetDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return (daysDiff / totalDays) * 100;
  };

  // 進捗率を計算
  const calculateProgress = (textbookId: number) => {
    const progress = progressData[textbookId];
    if (!progress) return 0;
    
    return progress.progress.solvedProblems / progress.textbook.total_problems * 100;
  };

  // 今日の位置を計算
  const todayPosition = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 常に今日の位置を計算（範囲外でも表示）
    if (today < timelineRange.startDate) {
      return 0; // 開始日より前の場合は左端に表示
    } else if (today > timelineRange.endDate) {
      return 100; // 終了日より後の場合は右端に表示
    } else {
      return getPositionPercent(today.toISOString().split('T')[0]);
    }
  }, [timelineRange]);

  // 試験タイプに応じた色を取得
  const getExamTypeColor = (examType: string) => {
    switch (examType.toLowerCase()) {
      case '共通テスト':
      case '共テ':
        return 'bg-red-500';
      case '二次試験':
      case '二次':
        return 'bg-purple-500';
      case '模試':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  // 試験タイプに応じたボーダー色を取得
  const getExamTypeBorderColor = (examType: string) => {
    switch (examType.toLowerCase()) {
      case '共通テスト':
      case '共テ':
        return 'border-red-500';
      case '二次試験':
      case '二次':
        return 'border-purple-500';
      case '模試':
        return 'border-yellow-500';
      default:
        return 'border-gray-500';
    }
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
          <Calendar className="mr-2" />
          参考書スケジュールタイムライン
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
      
      {/* タイムラインヘッダー（月表示） */}
      <div className="mb-2 relative">
        <div className="flex border-b border-gray-200">
          <div className="w-40 flex-shrink-0"></div>
          <div className="flex-1 flex">
            {timelineRange.months.map((month, index) => (
              <div 
                key={index} 
                className="flex-1 text-center text-sm text-gray-500 pb-1"
                style={{ minWidth: '40px' }}
              >
                {month.label}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* タイムラインコンテンツ */}
      <div className="relative">
        {/* 今日の位置を示す縦線（常に表示） */}
        <div 
          className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
          style={{ left: `calc(${todayPosition}% + 160px)` }}
        >
          <div className="absolute -top-6 -translate-x-1/2 bg-red-500 text-white text-xs px-1 py-0.5 rounded">
            今日
          </div>
        </div>
        
        {/* 試験日程マーカー */}
        {exams.map((exam, index) => {
          // 位置を計算
          const position = getPositionPercent(exam.exam_date);
          
          // 位置が0%〜100%の範囲内にある場合のみ表示
          if (position >= 0 && position <= 100) {
            // 模試と試験はラインで表示
            return (
              <div 
                key={`exam-${index}`}
                className="absolute top-0 z-20 group"
                style={{ 
                  left: `calc(${position}% + 160px)`,
                  height: '100%'
                }}
              >
                <div 
                  className={`h-full w-0 border-l-2 ${getExamTypeBorderColor(exam.exam_type)} mx-auto`}
                  style={{ borderStyle: 'dashed' }}
                ></div>
                <div className="absolute top-0 -translate-x-1/2 bg-gray-800 text-white text-xs px-1 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  {exam.university_name}: {exam.exam_type} ({exam.exam_date})
                </div>
              </div>
            );
          }
          return null;
        })}
        
        {/* 模試マーカー */}
        {mockExams.map((mockExam, index) => {
          // 位置を計算
          const position = getPositionPercent(mockExam.date);
          
          // 位置が0%〜100%の範囲内にある場合のみ表示
          if (position >= 0 && position <= 100) {
            return (
              <div 
                key={`mock-${index}`}
                className="absolute top-0 z-20 group"
                style={{ 
                  left: `calc(${position}% + 160px)`,
                  height: '100%'
                }}
              >
                <div 
                  className="h-full w-0 border-l-2 border-yellow-500 mx-auto"
                  style={{ borderStyle: 'dashed' }}
                ></div>
                <div className="absolute top-0 -translate-x-1/2 bg-gray-800 text-white text-xs px-1 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  模試: {mockExam.name} ({mockExam.date})
                </div>
              </div>
            );
          }
          return null;
        })}
        
        {/* 参考書スケジュール */}
        <div className="mt-4">
          {filteredSchedules.length > 0 ? (
            <div className="space-y-4">
              {filteredSchedules.map((schedule, index) => {
                const textbook = textbooks.find(t => t.id === schedule.textbook_id);
                if (!textbook) return null;
                
                const startPos = getPositionPercent(schedule.start_date);
                const endPos = getPositionPercent(schedule.end_date);
                const width = endPos - startPos;
                const progress = calculateProgress(textbook.id || 0);
                
                return (
                  <div key={index} className="flex items-center group">
                    <div className="w-40 flex-shrink-0 pr-4">
                      <div className="text-sm font-medium truncate" title={textbook.title}>
                        {textbook.title}
                      </div>
                      <div className="text-xs text-gray-500">{textbook.subject}</div>
                    </div>
                    
                    <div className="flex-1 relative h-8">
                      {/* 予定期間バー */}
                      <div 
                        className="absolute h-6 bg-gray-200 rounded-md"
                        style={{ 
                          left: `${startPos}%`, 
                          width: `${width}%`,
                          top: '4px'
                        }}
                      >
                        {/* 実際の進捗オーバーレイ */}
                        <div 
                          className="h-full bg-primary rounded-md"
                          style={{ width: `${progress}%` }}
                        ></div>
                        
                        {/* ホバー時の詳細情報 */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute top-8 left-0 bg-gray-800 text-white text-xs p-2 rounded whitespace-nowrap z-30">
                            <div className="font-bold">{textbook.title}</div>
                            <div>期間: {schedule.start_date} 〜 {schedule.end_date}</div>
                            <div>進捗: {Math.round(progress)}%</div>
                          </div>
                        </div>
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
      </div>
      
      {/* 凡例 */}
      <div className="mt-8 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium mb-2">凡例</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gray-200 mr-2"></div>
            <span className="text-sm">予定期間</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-primary mr-2"></div>
            <span className="text-sm">実際の進捗</span>
          </div>
          <div className="flex items-center">
            <div className="h-4 w-0 border-l-2 border-red-500 border-dashed mr-2"></div>
            <span className="text-sm">共通テスト</span>
          </div>
          <div className="flex items-center">
            <div className="h-4 w-0 border-l-2 border-purple-500 border-dashed mr-2"></div>
            <span className="text-sm">二次試験</span>
          </div>
          <div className="flex items-center">
            <div className="h-4 w-0 border-l-2 border-yellow-500 border-dashed mr-2"></div>
            <span className="text-sm">模試</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextbookScheduleTimeline;
