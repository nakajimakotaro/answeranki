import { useState, useMemo } from 'react';
import { getYear, getDaysInYear, startOfYear, getDay, addDays, format, getDate, getMonth } from 'date-fns'; // Import date-fns functions, removed parseISO as it's not used directly here anymore
import { trpc } from '../lib/trpc'; // Import tRPC client
import { Calendar, Filter, BarChart2 } from 'lucide-react'; // Removed BookOpen as filter/stats are removed

interface YearlyActivityCalendarProps {
  year?: number;
}

/**
 * GitHub風の年間アクティビティカレンダー（草）コンポーネント
 */
const YearlyActivityCalendar = ({
  year = getYear(new Date()), // Use getYear for default year
}: YearlyActivityCalendarProps) => {
  // 状態管理
  const [selectedYear, setSelectedYear] = useState(year);
  const [hoveredDay, setHoveredDay] = useState<{date: string, amount: number} | null>(null);

  // --- tRPC Query ---
  const { data: yearlyLogAmounts, isLoading, error: queryError } = trpc.schedule.getYearlyLogs.useQuery(
    { year: selectedYear },
    {
      staleTime: 5 * 60 * 1000, // Cache data for 5 minutes
      refetchOnWindowFocus: false, // Optional: prevent refetch on window focus
    }
  );
  // --- End tRPC Query ---


  // 年間の日付データを生成
  const calendarData = useMemo(() => {
    // Use yearlyLogAmounts from tRPC query (Record<string, number>)
    if (!yearlyLogAmounts) return {
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

      // Get the amount for the specific date from the yearlyLogAmounts record
      const amount = yearlyLogAmounts[dateString] || 0;

      return {
        date: dateString,
        day: getDate(date), // Use getDate from date-fns
        month: getMonth(date), // Use getMonth from date-fns
        dayOfWeek: getDay(date), // Use getDay from date-fns
        amount: amount // Use the amount from the record
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
  }, [yearlyLogAmounts, selectedYear]); // Updated dependency array

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

  if (isLoading) { // Use isLoading from useQuery
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Render calendar only if data is available
  if (!yearlyLogAmounts) {
     return (
       <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
         データがありません。
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

      {/* カレンダー表示 */}
      <div className="relative mt-6"> {/* Added margin top */}
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

      {/* Statistics UI removed */}

    </div>
  );
};

export default YearlyActivityCalendar;
