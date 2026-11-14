import type { CommandHandlers } from './actual-runtime/actual-daily-dispatcher.ts';

export const commandHandlers: CommandHandlers;
export function cleanupTemporaryClients(): Promise<void>;
