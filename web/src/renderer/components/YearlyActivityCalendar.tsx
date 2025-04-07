import { useState, useEffect, useMemo } from 'react';
import { getYear, getDaysInYear, startOfYear, getDay, addDays, format, getDate, getMonth, parseISO } from 'date-fns'; // Import date-fns functions
import { scheduleService, YearlyLogData } from '../services/scheduleService.js';
import { Calendar, BookOpen, Filter, BarChart2 } from 'lucide-react';

interface YearlyActivityCalendarProps {
  year?: number;
  initialFilterType?: 'all' | 'textbook' | 'subject';
  initialFilterId?: number;
  initialFilterSubject?: string;
}

/**
 * GitHub風の年間アクティビティカレンダー（草）コンポーネント
 */
const YearlyActivityCalendar = ({
  year = getYear(new Date()), // Use getYear for default year
  initialFilterType = 'all',
  initialFilterId,
  initialFilterSubject
}: YearlyActivityCalendarProps) => {
  // 状態管理
  const [yearlyData, setYearlyData] = useState<YearlyLogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(year);
  const [filterType, setFilterType] = useState<'all' | 'textbook' | 'subject'>(initialFilterType);
  const [selectedTextbookId, setSelectedTextbookId] = useState<number | undefined>(initialFilterId);
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>(initialFilterSubject);
  const [hoveredDay, setHoveredDay] = useState<{date: string, amount: number} | null>(null);

  // 年間データの取得
  useEffect(() => {
    fetchYearlyData();
  }, [selectedYear, filterType, selectedTextbookId, selectedSubject]);

  // 年間データを取得する
  const fetchYearlyData = async () => {
    try {
      setLoading(true);
      
      const params: any = { year: selectedYear };
      
      if (filterType === 'textbook' && selectedTextbookId) {
        params.textbook_id = selectedTextbookId;
      } else if (filterType === 'subject' && selectedSubject) {
        params.subject = selectedSubject;
      }
      
      const data = await scheduleService.getYearlyLogs(params);
      setYearlyData(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching yearly data:', err);
      setError('年間データの取得中にエラーが発生しました');
      setLoading(false);
    }
  };

  // 年間の日付データを生成
  const calendarData = useMemo(() => {
    if (!yearlyData) return {
      days: [],
      weeks: [],
      maxAmount: 0
    };

    const year = selectedYear;
    const yearStartDate = startOfYear(new Date(year, 0, 1)); // Get start of the year using date-fns
    const daysInYear = getDaysInYear(yearStartDate); // Get days in the year using date-fns
    const firstDayOfYear = getDay(yearStartDate); // Get day of the week (0-6) using date-fns

    // 年間の全日付を生成 (date-fns を使用)
    const allDays = Array.from({ length: daysInYear }, (_, i) => {
      const date = addDays(yearStartDate, i); // Calculate each day using addDays
      const dateString = format(date, 'yyyy-MM-dd'); // Format date string using date-fns

      // ログデータから該当日の学習量を取得
      const logEntry = yearlyData.logs.find(log => log.date === dateString);
      
      return {
        date: dateString,
        day: getDate(date), // Use getDate from date-fns
        month: getMonth(date), // Use getMonth from date-fns
        dayOfWeek: getDay(date), // Use getDay from date-fns
        amount: logEntry ? logEntry.total_amount : 0
      };
    });
    
    // 最大値を計算（色の強度計算用）
    const maxAmount = Math.max(...allDays.map(day => day.amount), 1);
    
    // 週ごとにグループ化
    const weeks: any[] = [];
    let week: any[] = [];
    
    // 年の最初の週の前に空のセルを追加
    for (let i = 0; i < firstDayOfYear; i++) {
      week.push(null);
    }
    
    allDays.forEach((day, index) => {
      week.push(day);
      
      // 土曜日または年の最後の日の場合、週を完成させる
      if (day.dayOfWeek === 6 || index === daysInYear - 1) {
        // 週の最後に足りない分の空セルを追加
        while (week.length < 7) {
          week.push(null);
        }
        
        weeks.push(week);
        week = [];
      }
    });
    
    return {
      days: allDays,
      weeks,
      maxAmount
    };
  }, [yearlyData, selectedYear]);

  // 色の強度を計算
  const getColorClass = (amount: number) => {
    if (!calendarData.maxAmount) return 'bg-gray-100';
    
    // 0問の場合は最も薄い色
    if (amount === 0) return 'bg-gray-100';
    
    // 学習量に応じて色の強度を5段階で計算
    const intensity = Math.min(Math.floor((amount / calendarData.maxAmount) * 4), 4);
    
    // 色のバリエーション（薄い緑→濃い緑）
    const colors = [
      'bg-green-100',
      'bg-green-200',
      'bg-green-300',
      'bg-green-500',
      'bg-green-700'
    ];
    
    return colors[intensity];
  };

  // 月の名前
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  
  // 曜日の名前
  const dayOfWeekNames = ['日', '月', '火', '水', '木', '金', '土'];

  // フィルタータイプを変更
  const handleFilterTypeChange = (type: 'all' | 'textbook' | 'subject') => {
    setFilterType(type);
    
    // フィルタータイプが変わったら選択をリセット
    if (type !== 'textbook') setSelectedTextbookId(undefined);
    if (type !== 'subject') setSelectedSubject(undefined);
  };

  if (loading && !yearlyData) {
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
          onClick={fetchYearlyData}
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
          {selectedYear}年の学習活動
        </h2>
        
        <div className="flex space-x-2">
          <button
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
            onClick={() => setSelectedYear(selectedYear - 1)}
          >
            前年
          </button>
          <button
            className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-dark"
            onClick={() => setSelectedYear(getYear(new Date()))} // Use getYear
          >
            今年
          </button>
          <button
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
            onClick={() => setSelectedYear(selectedYear + 1)}
          >
            翌年
          </button>
        </div>
      </div>
      
      {/* フィルター */}
      <div className="mb-6">
        <div className="flex items-center mb-2">
          <Filter className="mr-2 h-4 w-4" />
          <span className="font-medium">フィルター:</span>
        </div>
        
        <div className="flex space-x-2 mb-3">
          <button 
            className={`px-3 py-1 rounded ${filterType === 'all' ? 'bg-primary text-white' : 'bg-gray-200'}`}
            onClick={() => handleFilterTypeChange('all')}
          >
            全体
          </button>
          <button 
            className={`px-3 py-1 rounded ${filterType === 'textbook' ? 'bg-primary text-white' : 'bg-gray-200'}`}
            onClick={() => handleFilterTypeChange('textbook')}
          >
            参考書別
          </button>
          <button 
            className={`px-3 py-1 rounded ${filterType === 'subject' ? 'bg-primary text-white' : 'bg-gray-200'}`}
            onClick={() => handleFilterTypeChange('subject')}
          >
            科目別
          </button>
        </div>
        
        {filterType === 'textbook' && yearlyData && (
          <select 
            className="w-full p-2 border rounded"
            value={selectedTextbookId || ''}
            onChange={(e) => setSelectedTextbookId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">参考書を選択</option>
            {yearlyData.filters.textbooks.map(book => (
              <option key={book.id} value={book.id}>
                {book.title} ({book.subject})
              </option>
            ))}
          </select>
        )}
        
        {filterType === 'subject' && yearlyData && (
          <select 
            className="w-full p-2 border rounded"
            value={selectedSubject || ''}
            onChange={(e) => setSelectedSubject(e.target.value || undefined)}
          >
            <option value="">科目を選択</option>
            {yearlyData.filters.subjects.map((subject, index) => (
              <option key={index} value={subject}>{subject}</option>
            ))}
          </select>
        )}
      </div>
      
      {/* カレンダー表示 */}
      <div className="relative">
        {/* ホバー時の詳細情報 */}
        {hoveredDay && (
          <div className="absolute z-10 bg-gray-800 text-white p-2 rounded shadow-lg text-sm">
            <p className="font-bold">{hoveredDay.date}</p>
            <p>学習量: {hoveredDay.amount}問</p>
          </div>
        )}
        
        <div className="flex mb-1">
          <div className="w-8"></div>
          {monthNames.map((month, index) => (
            <div 
              key={index} 
              className="flex-1 text-xs text-center text-gray-500"
              style={{ minWidth: 'calc((100% - 2rem) / 12)' }}
            >
              {month}
            </div>
          ))}
        </div>
        
        <div className="flex">
          {/* 曜日ラベル */}
          <div className="w-8 mr-2">
            {dayOfWeekNames.map((day, index) => (
              <div key={index} className="h-4 text-xs text-gray-500 flex items-center justify-end pr-1">
                {day}
              </div>
            ))}
          </div>
          
          {/* カレンダーグリッド */}
          <div className="flex-1 grid grid-cols-53 gap-1">
            {calendarData.weeks?.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1">
                {week.map((day: any, dayIndex: number) => (
                  <div 
                    key={`${weekIndex}-${dayIndex}`}
                    className={`h-4 w-4 rounded-sm ${day ? getColorClass(day.amount) : 'bg-transparent'}`}
                    onMouseEnter={() => day && setHoveredDay({ date: day.date, amount: day.amount })}
                    onMouseLeave={() => setHoveredDay(null)}
                  ></div>
                ))}
              </div>
            ))}
          </div>
        </div>
        
        {/* 凡例 */}
        <div className="flex justify-end items-center mt-2 text-xs text-gray-500">
          <span className="mr-1">少ない</span>
          <div className="h-3 w-3 bg-green-100 rounded-sm"></div>
          <div className="h-3 w-3 bg-green-200 rounded-sm"></div>
          <div className="h-3 w-3 bg-green-300 rounded-sm"></div>
          <div className="h-3 w-3 bg-green-500 rounded-sm"></div>
          <div className="h-3 w-3 bg-green-700 rounded-sm mr-1"></div>
          <span>多い</span>
        </div>
      </div>
      
      {/* 統計情報 */}
      {yearlyData && (
        <div className="mt-6 pt-4 border-t">
          <h3 className="text-lg font-semibold flex items-center mb-3">
            <BarChart2 className="mr-2 h-5 w-5" />
            統計情報
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-500">総学習量</p>
              <p className="text-xl font-bold">{yearlyData.statistics.totalAmount}問</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-500">学習日数</p>
              <p className="text-xl font-bold">{yearlyData.statistics.studyDays}日</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-500">1日平均</p>
              <p className="text-xl font-bold">{yearlyData.statistics.avgPerDay}問</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-500">最多日</p>
              <p className="text-xl font-bold">{yearlyData.statistics.maxDay}問</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YearlyActivityCalendar;
