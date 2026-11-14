#!/usr/bin/env node
import { dispatchCommand } from './actual-daily-dispatcher.ts';
import { cleanupTemporaryClients, commandHandlers } from '../actual-daily-operations.mjs';

try {
  const result = await dispatchCommand(process.argv.slice(2), commandHandlers);
  // Preserve successful-run cleanup only after all operation checks have completed.
  await cleanupTemporaryClients();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
