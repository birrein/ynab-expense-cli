import { nextWindows } from '../../actual-daily-policy.mjs';
import type { DailyState, DailyWindows } from '../../actual-daily-policy.mjs';

export interface StateReader {
  read(): Promise<DailyState>;
}

export interface CalendarClock {
  today(): string;
}

export interface StatusResult {
  state: DailyState;
  windows: DailyWindows;
}

export interface GetStatusPorts {
  stateReader: StateReader;
  clock: CalendarClock;
}

export async function getStatus({ stateReader, clock }: GetStatusPorts): Promise<StatusResult> {
  const state = await stateReader.read();
  const today = clock.today();
  return { state, windows: nextWindows(today, state) };
}
