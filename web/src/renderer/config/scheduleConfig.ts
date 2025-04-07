import { addDays, subDays, format } from 'date-fns';

/**
 * スケジュール表示に関する設定
 */
export const scheduleConfig = {
  /**
   * 日次表示 (daily) のデフォルト日付範囲設定
   */
  dailyView: {
    /** 開始日: 今日から何日前か */
    startDaysAgo: 7,
    /** 終了日: 今日から何日後か */
    endDaysLater: 60,
  },
  /**
   * 月次表示 (biWeekly/yearly) のデフォルト日付範囲設定
   */
  yearlyView: {
    /** 開始日 (YYYY-MM-DD) */
    startDate: '2025-04-01',
    /** 終了日 (YYYY-MM-DD) */
    endDate: '2026-03-31',
  },
};

/**
 * 現在の日付に基づいて日次表示の日付範囲を取得する関数
 * @returns { startDate: string, endDate: string }
 */
export const getDailyDateRange = (): { startDate: string; endDate: string } => {
  const today = new Date();
  return {
    startDate: format(subDays(today, scheduleConfig.dailyView.startDaysAgo), 'yyyy-MM-dd'),
    endDate: format(addDays(today, scheduleConfig.dailyView.endDaysLater), 'yyyy-MM-dd'),
  };
};

/**
 * 年次表示の固定日付範囲を取得する関数
 * @returns { startDate: string, endDate: string }
 */
export const getYearlyDateRange = (): { startDate: string; endDate: string } => {
  return {
    startDate: scheduleConfig.yearlyView.startDate,
    endDate: scheduleConfig.yearlyView.endDate,
  };
};
