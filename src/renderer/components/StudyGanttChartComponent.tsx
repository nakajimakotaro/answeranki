import React, { useState, useEffect } from 'react';
import { addDays, format, parseISO, differenceInDays, getDay, isWithinInterval } from 'date-fns'; // subDays, startOfWeek, endOfWeek を削除
import { scheduleService, TimelineEvent } from '../services/scheduleService';
import { getDailyDateRange, getYearlyDateRange } from '../config/scheduleConfig'; // 設定ファイルをインポート

// 表示モードの型定義
type ViewMode = 'daily' | 'biWeekly';

// コンポーネントのProps型定義
interface StudyGanttChartProps {
  containerWidth: number;
  containerHeight?: number;
  className?: string;
  events?: TimelineEvent[];
  viewType?: 'daily' | 'yearly';
}

// ガントチャートコンポーネント
const StudyGanttChartComponent: React.FC<StudyGanttChartProps> = ({
  containerWidth,
  containerHeight = 400,
  className = '',
  events: externalEvents,
  viewType,
}) => {
  // 状態管理
  const [events, setEvents] = useState<TimelineEvent[]>(externalEvents || []);
  const [viewMode, setViewMode] = useState<ViewMode>(viewType === 'yearly' ? 'biWeekly' : 'daily');
  const [loading, setLoading] = useState<boolean>(!externalEvents);
  const [error, setError] = useState<string | null>(null);
  
  // 日付範囲の計算
  const today = new Date(); // today は todayMarker で使用するため残す

  // 表示モードに応じた日付範囲を計算 (設定ファイルから取得)
  const getDateRange = () => {
    if (viewMode === 'daily') {
      return getDailyDateRange();
    } else { // biWeekly (yearly)
      return getYearlyDateRange();
    }
  };

  // viewType が変更されたときに viewMode を更新
  useEffect(() => {
    if (viewType) {
      setViewMode(viewType === 'yearly' ? 'biWeekly' : 'daily');
    }
  }, [viewType]);

  // データ取得
  useEffect(() => {
    // 外部からイベントが提供されている場合はそれを使用
    if (externalEvents) {
      setEvents(externalEvents);
      setLoading(false);
      return;
    }

    const fetchEvents = async () => {
      try {
        setLoading(true);
        const { startDate, endDate } = getDateRange();
        const timelineEvents = await scheduleService.getTimelineEvents(startDate, endDate);
        setEvents(timelineEvents);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch timeline events:', err);
        setError('イベントの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [viewMode, externalEvents]); // 表示モードが変わったら再取得

  // SVG描画のための計算
  const calculateChartDimensions = () => {
    const { startDate, endDate } = getDateRange();
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const dayCount = differenceInDays(end, start) + 1;
    
    // 日付ごとの幅を計算 (常に1日あたりの幅を基準にする)
    const dayWidth = containerWidth / dayCount;

    // ヘッダーの高さ (月表示用に少し高くする)
    const headerHeight = 65; // 50 -> 65

    // イベント1つあたりの高さ
    const eventHeight = 30;
    const eventMargin = 5;
    
    return {
      dayWidth,
      headerHeight,
      eventHeight,
      eventMargin,
      totalDays: dayCount,
      startDate: start,
      endDate: end,
    };
  };

  // 日付からX座標を計算
  const dateToX = (date: Date) => {
    const { startDate, dayWidth } = calculateChartDimensions();
    const days = differenceInDays(date, startDate);
    return days * dayWidth;
  };

  // 日付ラベルと月ラベルを生成する共通関数
  const generateDateAndMonthLabels = (mode: ViewMode) => {
    const { startDate, totalDays, dayWidth } = calculateChartDimensions();
    const dateLabels = [];
    const monthLabels = [];
    let prevYear: string | null = null;
    let prevMonth: string | null = null;
    let currentMonthStartX = 0;

    for (let i = 0; i < totalDays; i++) {
      const date = addDays(startDate, i);
      const currentYear = format(date, 'yyyy');
      const currentMonth = format(date, 'yyyy-MM'); // 月の識別に年も含める
      const dayX = i * dayWidth;

      // 年ラベルの生成
      const showYear = prevYear !== currentYear;
      prevYear = currentYear;

      // 月ラベルの生成
      if (prevMonth !== currentMonth) {
        // 前の月のラベルがあれば、幅を計算して設定
        if (monthLabels.length > 0) {
          monthLabels[monthLabels.length - 1].width = dayX - currentMonthStartX;
        }
        // 新しい月のラベルを追加
        monthLabels.push({
          name: format(date, 'MMMM'), // 例: April
          number: format(date, 'MM'), // 月番号を追加 (例: '04')
          year: currentYear, // 月ラベルにも年情報を持たせる
          x: dayX,
          width: 0, // 幅は次の月が始まるまで不明
        });
        currentMonthStartX = dayX;
        prevMonth = currentMonth;
      }

      // 日付ラベルの生成 (日次表示のみ)
      if (mode === 'daily') {
        dateLabels.push({
          date,
          x: dayX,
          yearLabel: showYear ? currentYear : '', // 年ラベルは日次では使わないかも
          dayLabel: format(date, 'dd'), // 日のみ表示
        });
      }
    }

    // 最後の月の幅を計算
    if (monthLabels.length > 0) {
      monthLabels[monthLabels.length - 1].width = containerWidth - currentMonthStartX;
    }

    // 週次表示用の日付ラベル（月の初日のみ）
    if (mode === 'biWeekly') {
        monthLabels.forEach(month => {
            // 月番号を使って正しいISO形式の文字列を生成
            const monthStartDate = parseISO(`${month.year}-${month.number}-01`);
             // 月の初日がstartDate以降かチェック
            // startDate も Date オブジェクトであることを確認 (calculateChartDimensions で parseISO 済み)
            if (differenceInDays(monthStartDate, startDate) >= 0) {
                 // dateLabels に追加する前に monthStartDate が有効か確認 (念のため)
                 if (!isNaN(monthStartDate.getTime())) {
                    dateLabels.push({
                        date: monthStartDate,
                        x: month.x,
                        yearLabel: '', // 年は月ラベルで表示
                        dayLabel: '01', // 月の初日
                    });
                 } else {
                    console.warn(`Invalid date generated for month: ${month.name}, year: ${month.year}`);
                 }
            }
        });
    }


    return { dateLabels, monthLabels };
  };


  // イベントの描画
  const renderEvents = () => {
    // dayWidth をここで取得
    const { eventHeight, eventMargin, headerHeight, dayWidth } = calculateChartDimensions();

    return events.map((event, index) => {
      const startX = dateToX(event.startDate);
      // 終了日の翌日のX座標を計算して幅を正確にする
      // date-fns の addDays をインポートに追加する必要がある
      const endX = event.endDate
        ? dateToX(addDays(event.endDate, 1)) // 終了日の翌日
        : dateToX(addDays(event.startDate, 1)); // 単一日イベントも1日分の幅を持たせる

      const y = headerHeight + (index * (eventHeight + eventMargin));
      // 幅の計算は startX と endX の差分でOK、最小幅を1日分にする
      const width = Math.max(endX - startX, dayWidth);
      const eventColor = '#E5E7EB'; // イベントバーの色を統一 (明るいグレー)
      const textColor = '#374151'; // テキストの色を統一 (濃いグレー)

      // 単一日イベントもバーで表示するように統一
      return (
        <g key={event.id.toString()} className="event-bar">
          {/* バー */}
          <rect
            x={startX}
            y={y}
            width={width}
            height={eventHeight}
            rx={4}
            fill={eventColor} // 統一した色を使用
            // opacity={0.8} // Opacity を削除
          />
          {/* イベント名 */}
          <text
            x={startX + width / 2} // バーの中央に配置
            y={y + eventHeight / 2 + 2} // 垂直中央揃え (微調整 +2px)
            fontSize="12"
            fill={textColor} // 統一したテキスト色を使用
            dominantBaseline="middle"
            textAnchor="middle" // 中央揃えにする
          >
            {event.title}
          </text>
        </g>
      );
    });
  };

  // 今日のマーカー描画 (縦線形式)
  const renderTodayMarker = () => {
    const { headerHeight, eventHeight, eventMargin, dayWidth } = calculateChartDimensions();
    const x = dateToX(today);
    const chartHeight = Math.max(
      containerHeight,
      headerHeight + (events.length * (eventHeight + eventMargin)) + 20
    ); // チャート全体の高さを再計算

    // 今日が日付範囲内にあるかチェック
    const { startDate, endDate } = getDateRange();
    if (!isWithinInterval(today, { start: parseISO(startDate), end: parseISO(endDate) })) {
      return null; // 範囲外なら何も描画しない
    }

    return (
      <g className="today-marker">
        <line
          x1={x + dayWidth / 2}
          y1={headerHeight} // ヘッダーの下から開始
          x2={x + dayWidth / 2}
          y2={chartHeight} // チャートの最下部まで
          stroke="#8b0000" // 色を変更
          strokeWidth={2}
          strokeDasharray="4 4" // 点線にする
        />
        <circle
          cx={x + dayWidth / 2}
          cy={headerHeight- 5} // ヘッダーの上に配置
          r={5}
          fill="#8b0000" // 色を変更
          />
      </g>
    );
  };

  // ガントチャート全体の描画
  const renderChart = () => {
    const { headerHeight, eventHeight, eventMargin } = calculateChartDimensions();
    const totalHeight = Math.max(
      containerHeight,
      headerHeight + (events.length * (eventHeight + eventMargin)) + 20
    );

    // 日付と月ラベルを生成
    const { dateLabels, monthLabels } = generateDateAndMonthLabels(viewMode);

    const { dayWidth, startDate, totalDays } = calculateChartDimensions();

    return (
      <svg width={containerWidth} height={totalHeight} className="gantt-chart">
        {/* 背景 */}
        <rect
          x={0}
          y={0}
          width={containerWidth}
          height={totalHeight}
          fill="white" // 背景を白に
        />

        {/* 日付グリッド (背景色と区切り線) */}
        <g className="date-grid">
          {Array.from({ length: totalDays }).map((_, i) => {
            const currentDate = addDays(startDate, i);
            const x = i * dayWidth;
            const dayOfWeek = getDay(currentDate);
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const fillColor = isWeekend ? '#edf2f7' : '#f7fafc'; // 土日は薄いグレー、平日はさらに薄いグレー

            return (
              <React.Fragment key={`day-grid-${i}`}>
                {viewMode === 'daily' && (
                <>
                  <rect
                    x={x}
                    y={headerHeight}
                    width={dayWidth}
                    height={totalHeight - headerHeight}
                    fill={fillColor}
                  />
                    <line
                      x1={x + dayWidth}
                      y1={headerHeight}
                    x2={x + dayWidth}
                    y2={totalHeight}
                      stroke="#e2e8f0" // 薄いグレーの線
                      strokeWidth={1}
                    />
                  </>
                )}
              </React.Fragment>
            );
          })}
        </g>

        {/* ヘッダー背景 (ラベルの後ろに描画) */}
        <rect x={0} y={0} width={containerWidth} height={headerHeight} fill="white" />


        {/* 月ラベル (ヘッダー上部) */}
        <g className="month-labels">
          {monthLabels.map((month, index) => (
            <g key={`month-${index}`}>
              <text
                x={month.x + month.width / 2} // 月の範囲の中央に配置
                y={headerHeight - 45} // 上部に配置 (65 - 45 = 20px from top)
                fontSize="14"
                fontWeight="bold" // 太字にする
                textAnchor="middle"
                fill="#1a202c" // 濃い色
              >
                {month.name} {/* 例: April */}
              </text>
              {/* 月の区切り線 */}
              {index > 0 && ( // 最初の線は不要
                <line
                  x1={month.x}
                  y1={0} // ヘッダーの上端から
                  x2={month.x}
                  y2={headerHeight - 30} // 日付ラベルの上まで
                  stroke="#cbd5e0"
                  strokeWidth={1}
                />
              )}
            </g>
          ))}
        </g>

        {/* 日付ラベル (ヘッダー下部) */}
        <g className="date-labels">
          {dateLabels.map((label, index) => (
             <g key={`label-${index}`} className="date-label">
               {/* 日付テキスト */}
               <text
                 // x座標: 日次なら中央、週次なら左寄せ
                 x={label.x + (viewMode === 'daily' ? dayWidth / 2 : 5)}
                 y={headerHeight - 15} // 下部に配置 (65 - 15 = 50px from top)
                 fontSize="12"
                 textAnchor={viewMode === 'daily' ? "middle" : "start"} // 日次なら中央、週次なら左寄せ
                 fill="#4a5568"
               >
                 {label.dayLabel} {/* 例: 03 */}
               </text>
               {/* 日付区切り線 (日次表示のみ) */}
               {viewMode === 'daily' && index < dateLabels.length -1 && ( // 最後の線は不要
                 <line
                   x1={label.x + dayWidth}
                   y1={headerHeight - 30} // 月ラベルの下から
                   x2={label.x + dayWidth}
                   y2={headerHeight} // ヘッダーの下端まで
                   stroke="#e2e8f0"
                   strokeWidth={1}
                 />
               )}
             </g>
          ))}
        </g>

        {/* イベント */}
        {renderEvents()}

        {/* 今日のマーカー (イベントの上に描画) */}
        {renderTodayMarker()}
      </svg>
    );
  }; // renderChart 関数の正しい終了位置

  return (
    <div className={`study-gantt-chart ${className}`}>
      {/* 外部から viewType が提供されていない場合のみ表示モード切り替えボタンを表示 */}
      {!viewType && (
        <div className="flex mb-4 space-x-2">
          <button
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'daily' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
            onClick={() => setViewMode('daily')}
          >
            日次表示
          </button>
          <button
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'biWeekly' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
            onClick={() => setViewMode('biWeekly')}
          >
            月次表示
          </button>
        </div>
      )}
      
      {/* ローディング状態 */}
      {loading && (
        <div className="flex justify-center items-center h-40">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      )}
      
      {/* エラー表示 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      )}
      
      {/* ガントチャート */}
      {!loading && !error && events.length > 0 && renderChart()}
      
      {/* データがない場合 */}
      {!loading && !error && events.length === 0 && (
        <div className="flex justify-center items-center h-40 bg-gray-50 rounded">
          <p className="text-gray-500">表示するイベントがありません</p>
        </div>
      )}
  </div>
  );
};

export default StudyGanttChartComponent;
