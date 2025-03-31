import { useState, useEffect } from 'react';
import { scheduleService, Textbook, StudySchedule, StudyLog, ExamDate } from '../services/scheduleService';
import { BarChart2, Calendar, BookOpen, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { mockExamService, MockExam } from '../services/mockExamService';

interface ScheduleProgressChartProps {
  textbookId?: number;
}

/**
 * スケジュール進捗チャートコンポーネント
 * 実際の進捗と予定の進捗を比較して表示する
 */
const ScheduleProgressChart = ({ textbookId }: ScheduleProgressChartProps) => {
  // 状態管理
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [selectedTextbookId, setSelectedTextbookId] = useState<number | undefined>(textbookId);
  const [progressData, setProgressData] = useState<any>(null);
  const [mockExams, setMockExams] = useState<MockExam[]>([]);
  const [exams, setExams] = useState<ExamDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // データ取得
  useEffect(() => {
    fetchTextbooks();
    fetchMockExams();
    fetchExams();
  }, []);

  // 参考書が選択されたら進捗データを取得
  useEffect(() => {
    if (selectedTextbookId) {
      fetchProgressData(selectedTextbookId);
    }
  }, [selectedTextbookId]);

  // 模試データを取得
  const fetchMockExams = async () => {
    try {
      const mockExamsData = await mockExamService.getAllMockExams();
      setMockExams(mockExamsData);
    } catch (err) {
      console.error('Error fetching mock exams:', err);
      setError('模試データの取得中にエラーが発生しました');
    }
  };

  // 試験日程を取得
  const fetchExams = async () => {
    try {
      const examsData = await scheduleService.getExams();
      setExams(examsData);
    } catch (err) {
      console.error('Error fetching exams:', err);
      setError('試験日程の取得中にエラーが発生しました');
    }
  };

  // 参考書一覧を取得
  const fetchTextbooks = async () => {
    try {
      const textbooksData = await scheduleService.getTextbooks();
      setTextbooks(textbooksData);
      
      // 初期選択（指定がなければ最初の参考書）
      if (!selectedTextbookId && textbooksData.length > 0) {
        setSelectedTextbookId(textbooksData[0].id);
      }
    } catch (err) {
      console.error('Error fetching textbooks:', err);
      setError('参考書データの取得中にエラーが発生しました');
    }
  };

  // 進捗データを取得
  const fetchProgressData = async (textbookId: number) => {
    try {
      setLoading(true);
      
      // 参考書の進捗情報を取得
      const progress = await scheduleService.getProgress(textbookId);
      
      // スケジュールがない場合
      if (!progress.schedule) {
        setProgressData({
          hasSchedule: false,
          textbook: progress.textbook
        });
        setLoading(false);
        return;
      }
      
      // 日付の範囲を取得
      const startDate = new Date(progress.schedule.start_date);
      const endDate = new Date(progress.schedule.end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 経過日数を計算
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const elapsedDays = Math.min(
        Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
        totalDays
      );
      
      // 残り日数を計算
      const remainingDays = Math.max(0, totalDays - elapsedDays);
      
      // 理想的な進捗を計算
      const dailyIdealProgress = progress.textbook.total_problems / totalDays;
      const idealProgress = Math.min(
        Math.round(dailyIdealProgress * elapsedDays),
        progress.textbook.total_problems
      );
      
      // 実際の進捗
      const actualProgress = progress.progress.solvedProblems;
      
      // 進捗の差を計算
      const progressDifference = actualProgress - idealProgress;
      const progressStatus = progressDifference >= 0 ? '順調' : '遅れ';
      
      // 1日あたりの残り問題数
      const dailyTarget = remainingDays > 0 
        ? Math.ceil((progress.textbook.total_problems - actualProgress) / remainingDays)
        : 0;
      
      // 日別の進捗データを作成
      const dailyData = progress.logs.map((log: StudyLog) => ({
        date: log.date,
        actual: log.actual_amount,
        planned: Math.round(dailyIdealProgress)
      }));
      
      // 累積データを計算
      let cumulativeActual = 0;
      let cumulativeIdeal = 0;
      
      const cumulativeData = dailyData.map((day: any) => {
        cumulativeActual += day.actual;
        cumulativeIdeal += day.planned;
        
        return {
          date: day.date,
          actual: cumulativeActual,
          ideal: cumulativeIdeal
        };
      });
      
      setProgressData({
        hasSchedule: true,
        textbook: progress.textbook,
        schedule: progress.schedule,
        totalDays,
        elapsedDays,
        remainingDays,
        idealProgress,
        actualProgress,
        progressDifference,
        progressStatus,
        dailyTarget,
        dailyData,
        cumulativeData,
        totalProblems: progress.textbook.total_problems
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching progress data:', err);
      setError('進捗データの取得中にエラーが発生しました');
      setLoading(false);
    }
  };

  // 日付をフォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
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
          onClick={() => selectedTextbookId && fetchProgressData(selectedTextbookId)}
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
          スケジュール進捗状況
        </h2>
        
        <div className="w-64">
          <select
            className="w-full p-2 border border-gray-300 rounded-md"
            value={selectedTextbookId || ''}
            onChange={(e) => setSelectedTextbookId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">参考書を選択</option>
            {textbooks.map((textbook) => (
              <option key={textbook.id} value={textbook.id}>
                {textbook.title} ({textbook.subject})
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {progressData && (
        <div>
          {!progressData.hasSchedule ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-lg text-gray-600">
                {progressData.textbook.title}のスケジュールが設定されていません
              </p>
              <p className="text-sm text-gray-500 mt-2">
                スケジュールを設定すると進捗状況を確認できます
              </p>
            </div>
          ) : (
            <>
              {/* 進捗サマリー */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <BookOpen className="h-5 w-5 text-gray-500 mr-2" />
                    <h3 className="font-medium">全体の進捗</h3>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-3xl font-bold">
                        {progressData.actualProgress}/{progressData.totalProblems}
                      </p>
                      <p className="text-sm text-gray-500">
                        問題 ({Math.round((progressData.actualProgress / progressData.totalProblems) * 100)}%)
                      </p>
                    </div>
                    <div className="h-16 w-16 flex-shrink-0">
                      <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center relative">
                        <div 
                          className="absolute inset-0 rounded-full bg-primary"
                          style={{ 
                            clipPath: `polygon(0 0, 100% 0, 100% 100%, 0% 100%)`,
                            opacity: 0.2
                          }}
                        ></div>
                        <div 
                          className="absolute inset-0 rounded-full"
                          style={{ 
                            clipPath: `polygon(50% 50%, 50% 0, ${50 + 50 * Math.cos(Math.PI * 2 * (progressData.actualProgress / progressData.totalProblems))}% ${50 - 50 * Math.sin(Math.PI * 2 * (progressData.actualProgress / progressData.totalProblems))}%, ${progressData.actualProgress / progressData.totalProblems > 0.75 ? '100% 100%, 0 100%, 0 0' : ''})`,
                            background: '#3b82f6'
                          }}
                        ></div>
                        <div className="bg-white rounded-full h-10 w-10 flex items-center justify-center z-10">
                          <span className="text-xs font-medium">
                            {Math.round((progressData.actualProgress / progressData.totalProblems) * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <Calendar className="h-5 w-5 text-gray-500 mr-2" />
                    <h3 className="font-medium">期間の進捗</h3>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-3xl font-bold">
                        {progressData.elapsedDays}/{progressData.totalDays}
                      </p>
                      <p className="text-sm text-gray-500">
                        日 ({Math.round((progressData.elapsedDays / progressData.totalDays) * 100)}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">残り</p>
                      <p className="text-xl font-bold">{progressData.remainingDays}日</p>
                    </div>
                  </div>
                  <div className="mt-2 bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-primary h-full" 
                      style={{ width: `${(progressData.elapsedDays / progressData.totalDays) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg ${progressData.progressDifference >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center mb-2">
                    <Clock className="h-5 w-5 text-gray-500 mr-2" />
                    <h3 className="font-medium">進捗状況</h3>
                  </div>
                  <div className="flex items-center">
                    {progressData.progressDifference >= 0 ? (
                      <CheckCircle className="h-8 w-8 text-green-500 mr-3" />
                    ) : (
                      <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
                    )}
                    <div>
                      <p className="font-bold text-lg">
                        {progressData.progressStatus}
                      </p>
                      <p className="text-sm">
                        {progressData.progressDifference >= 0 
                          ? `予定より${progressData.progressDifference}問先行` 
                          : `予定より${Math.abs(progressData.progressDifference)}問遅れ`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm text-gray-600">
                      1日あたり<span className="font-bold">{progressData.dailyTarget}問</span>で完了予定
                    </p>
                  </div>
                </div>
              </div>
              
              {/* 進捗グラフ */}
              <div className="mt-8">
                <h3 className="text-lg font-medium mb-4">累積進捗グラフ</h3>
                <div className="relative h-64 border border-gray-200 rounded-lg p-4">
                  {/* Y軸 */}
                  <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-gray-500 py-2">
                    <span>{progressData.totalProblems}</span>
                    <span>{Math.round(progressData.totalProblems * 0.75)}</span>
                    <span>{Math.round(progressData.totalProblems * 0.5)}</span>
                    <span>{Math.round(progressData.totalProblems * 0.25)}</span>
                    <span>0</span>
                  </div>
                  
                  {/* グラフエリア */}
                  <div className="ml-12 h-full relative">
                    {/* 水平線 */}
                    <div className="absolute w-full h-full flex flex-col justify-between">
                      <div className="border-t border-gray-200"></div>
                      <div className="border-t border-gray-200"></div>
                      <div className="border-t border-gray-200"></div>
                      <div className="border-t border-gray-200"></div>
                      <div className="border-t border-gray-200"></div>
                    </div>
                    
                    {/* 理想的な進捗線 */}
                    <div className="absolute inset-0">
                      <svg className="w-full h-full">
                        <line
                          x1="0"
                          y1="100%"
                          x2="100%"
                          y2="0"
                          stroke="#9ca3af"
                          strokeWidth="2"
                          strokeDasharray="4"
                        />
                      </svg>
                    </div>
                    
                    {/* 実際の進捗線 */}
                    {progressData.cumulativeData && progressData.cumulativeData.length > 0 && (
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <polyline
                          points={progressData.cumulativeData.map((point: any, index: number) => {
                            // Handle division by zero for x coordinate
                            const numPoints = progressData.cumulativeData.length;
                            const x = numPoints > 1 
                              ? (index / (numPoints - 1)) * 100 
                              : 0; // If only one point, place it at the start (0%)
                            
                            // Handle division by zero for y coordinate
                            const y = progressData.totalProblems > 0
                              ? 100 - (point.actual / progressData.totalProblems) * 100
                              : 100; // If totalProblems is 0, y is 100% (bottom of the graph)
                              
                            // Ensure x and y are valid finite numbers before returning the string
                            const finalX = Number.isFinite(x) ? x : 0;
                            const finalY = Number.isFinite(y) ? y : 100; // Default to bottom if y is not finite
                            
                            // Round to avoid overly long decimals (optional but can help)
                            const roundedX = finalX.toFixed(2);
                            const roundedY = finalY.toFixed(2);

                            // Return plain numbers, not percentages, for the points attribute
                            return `${roundedX},${roundedY}`; 
                          }).join(' ')}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="3"
                        />
                      </svg>
                    )}
                    
                    {/* 模試と試験のマーカー */}
                    <svg className="w-full h-full absolute top-0 left-0 pointer-events-none">
                      {/* 模試のマーカー（ライン表示） */}
                      {mockExams.map((mockExam, index) => {
                        // 日付文字列を正規化（YYYY/MM/DD または YYYY-MM-DD 形式に）
                        const dateStr = mockExam.date.replace(/(\d{4})[^\d]?(\d{2})[^\d]?(\d{2})/, '$1/$2/$3');
                        const mockExamDate = new Date(dateStr);
                        
                        // スケジュールの日付範囲を取得
                        const scheduleStartStr = progressData.schedule.start_date.replace(/(\d{4})[^\d]?(\d{2})[^\d]?(\d{2})/, '$1/$2/$3');
                        const scheduleEndStr = progressData.schedule.end_date.replace(/(\d{4})[^\d]?(\d{2})[^\d]?(\d{2})/, '$1/$2/$3');
                        const startDate = new Date(scheduleStartStr);
                        const endDate = new Date(scheduleEndStr);
                        
                        // 全ての模試を表示（日付範囲のフィルタリングを一時的に無効化）
                        const position = (mockExamDate.getTime() - startDate.getTime()) / 
                                        (endDate.getTime() - startDate.getTime()) * 100;
                        
                        // 位置が0%〜100%の範囲内にある場合のみ表示
                        if (position >= 0 && position <= 100) {
                          return (
                            <line
                              key={`mock-${index}`}
                              x1={`${position}%`}
                              y1="0%"
                              x2={`${position}%`}
                              y2="100%"
                              stroke="#f59e0b" // 黄色系
                              strokeWidth="2"
                              strokeDasharray="4"
                            />
                          );
                        }
                        return null;
                      })}
                      
                      {/* 試験のマーカー（ライン表示） */}
                      {exams.map((exam, index) => {
                        // 日付文字列を正規化
                        const dateStr = exam.exam_date.replace(/(\d{4})[^\d]?(\d{2})[^\d]?(\d{2})/, '$1/$2/$3');
                        const examDate = new Date(dateStr);
                        
                        // スケジュールの日付範囲を取得
                        const scheduleStartStr = progressData.schedule.start_date.replace(/(\d{4})[^\d]?(\d{2})[^\d]?(\d{2})/, '$1/$2/$3');
                        const scheduleEndStr = progressData.schedule.end_date.replace(/(\d{4})[^\d]?(\d{2})[^\d]?(\d{2})/, '$1/$2/$3');
                        const startDate = new Date(scheduleStartStr);
                        const endDate = new Date(scheduleEndStr);
                        
                        // 全ての試験を表示（日付範囲のフィルタリングを一時的に無効化）
                        const position = (examDate.getTime() - startDate.getTime()) / 
                                        (endDate.getTime() - startDate.getTime()) * 100;
                        
                        // 位置が0%〜100%の範囲内にある場合のみ表示
                        if (position >= 0 && position <= 100) {
                          // 試験タイプに応じた色を設定
                          let color = "#9ca3af"; // デフォルト色
                          if (exam.exam_type.includes("共通") || exam.exam_type.includes("共テ")) {
                            color = "#ef4444"; // 赤色系
                          } else if (exam.exam_type.includes("二次")) {
                            color = "#8b5cf6"; // 紫色系
                          } else if (exam.exam_type.toLowerCase().includes("模試")) {
                            color = "#f59e0b"; // 黄色系（模試）
                          }
                          
                          return (
                            <line
                              key={`exam-${index}`}
                              x1={`${position}%`}
                              y1="0%"
                              x2={`${position}%`}
                              y2="100%"
                              stroke={color}
                              strokeWidth="2"
                              strokeDasharray="4"
                            />
                          );
                        }
                        return null;
                      })}
                    </svg>
                    
                    {/* 今日の位置 */}
                    <div 
                      className="absolute top-0 bottom-0 border-l-2 border-red-400"
                      style={{ 
                        left: `${(progressData.elapsedDays / progressData.totalDays) * 100}%`,
                        display: progressData.elapsedDays < progressData.totalDays ? 'block' : 'none'
                      }}
                    >
                      <div className="absolute -top-2 -translate-x-1/2 bg-red-400 text-white text-xs px-1 rounded">
                        今日
                      </div>
                    </div>
                  </div>
                  
                  {/* X軸 */}
                  <div className="absolute left-12 right-0 bottom-0 flex justify-between text-xs text-gray-500">
                    <span>{formatDate(progressData.schedule.start_date)}</span>
                    <span>{formatDate(progressData.schedule.end_date)}</span>
                  </div>
                  
                  {/* 凡例 */}
                  <div className="absolute top-2 right-2 flex flex-col items-start text-xs space-y-1">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-blue-500 mr-1"></div>
                      <span>実際の進捗</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-0 border-t-2 border-dashed border-gray-400 mr-1"></div>
                      <span>理想的な進捗</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-0 border-l-2 border-dashed border-yellow-500 mr-1"></div>
                      <span>模試</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-0 border-l-2 border-dashed border-red-500 mr-1"></div>
                      <span>共通テスト</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-0 border-l-2 border-dashed border-purple-500 mr-1"></div>
                      <span>二次試験</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 日別の進捗比較 */}
              <div className="mt-8">
                <h3 className="text-lg font-medium mb-4">日別の進捗比較</h3>
                <div className="overflow-x-auto">
                  <div className="min-w-full" style={{ height: '200px' }}>
                    <div className="flex h-full">
                      {progressData.dailyData && progressData.dailyData.map((day: any, index: number) => {
                        const actual = day.actual;
                        const planned = day.planned;
                        
                        // 最大値を計算
                        const maxValue = Math.max(
                          ...progressData.dailyData.map((d: any) => 
                            Math.max(d.actual, d.planned)
                          )
                        );
                        
                        // 高さを計算（0 除算を防ぐ）
                        const actualHeight = maxValue > 0 ? (actual / maxValue) * 150 : 0;
                        const plannedHeight = maxValue > 0 ? (planned / maxValue) * 150 : 0;
                        
                        return (
                          <div key={index} className="flex flex-col justify-end items-center mx-1" style={{ width: '30px' }}>
                            <div className="w-full flex flex-col items-center">
                              <div 
                                className="w-full bg-blue-500"
                                style={{ height: `${actualHeight}px` }}
                              ></div>
                              <div 
                                className="w-full bg-gray-300 mt-1"
                                style={{ height: `${plannedHeight}px` }}
                              ></div>
                            </div>
                            <div className="text-xs mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
                              {formatDate(day.date)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                {/* 凡例 */}
                <div className="flex items-center justify-center mt-8 text-sm">
                  <div className="flex items-center mr-4">
                    <div className="w-4 h-4 bg-blue-500 mr-1"></div>
                    <span>実際の学習量</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-gray-300 mr-1"></div>
                    <span>予定の学習量</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ScheduleProgressChart;
