export interface DailyState {
  dailyThrough: string;
  backfillThrough: string;
  dailyStart: string;
  [key: string]: unknown;
}

export interface DateWindow {
  from: string;
  to: string;
}

export interface DailyWindows {
  daily: DateWindow | null;
  backfill: DateWindow | null;
}

export function nextWindows(today: string, state: DailyState): DailyWindows;
