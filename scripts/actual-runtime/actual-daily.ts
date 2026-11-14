#!/usr/bin/env node
import { dispatchCommand } from './actual-daily-dispatcher.ts';
import { getStatus } from './application/get-status.ts';
import { createDailyStateReader, dailyStatePath } from './adapters/daily-state-reader.ts';
import { santiagoCalendarClock } from './adapters/santiago-calendar-clock.ts';
import { cleanupTemporaryClients, commandHandlers } from '../actual-daily-operations.mjs';

const handlers = {
  ...commandHandlers,
  status: () => getStatus({
    stateReader: createDailyStateReader(dailyStatePath),
    clock: santiagoCalendarClock,
  }),
};

try {
  const result = await dispatchCommand(process.argv.slice(2), handlers);
  // Preserve successful-run cleanup only after all operation checks have completed.
  await cleanupTemporaryClients();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
