export const COMMAND_USAGE =
  'Commands: inventory, adopt-budgets --commit, snapshot --currency CLP|USD, status, begin-run, plan --file JSON, apply --file JSON --run-id ID --commit, remove --file JSON [--run-id ID --commit], finish-run --file JSON --run-id ID';

export type CommandHandler = (args: readonly string[]) => Promise<unknown>;
export type CommandHandlers = Readonly<Record<string, CommandHandler>>;

export async function dispatchCommand(
  argv: readonly string[],
  handlers: CommandHandlers,
): Promise<unknown> {
  const [command, ...args] = argv;
  const handler = command && Object.hasOwn(handlers, command) ? handlers[command] : undefined;
  if (!handler) throw new Error(COMMAND_USAGE);
  return handler(args);
}
