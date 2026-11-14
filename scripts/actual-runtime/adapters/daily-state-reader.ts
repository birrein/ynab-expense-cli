import { readFile } from 'node:fs/promises';
import type { DailyState } from '../../actual-daily-policy.mjs';
import type { StateReader } from '../application/get-status.ts';

export const dailyRoot = process.env.ACTUAL_DAILY_DIR || '/Users/birrein/Actual-pilot/daily';
export const dailyStatePath = `${dailyRoot}/state.json`;

async function readState(path: string): Promise<DailyState> {
  return JSON.parse(await readFile(path, 'utf8')) as DailyState;
}

export const readDailyState = (): Promise<DailyState> => readState(dailyStatePath);

export function createDailyStateReader(path: string = dailyStatePath): StateReader {
  return { read: () => readState(path) };
}
