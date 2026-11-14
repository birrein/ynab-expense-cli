import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const entry = fileURLToPath(new URL('./actual-daily.ts', import.meta.url));
const stateFixture = () => ({
  dailyThrough: '2026-10-09',
  backfillThrough: '2026-08-07',
  dailyStart: '2026-10-10',
  futureState: { retained: true },
});
const expectedWindows = {
  daily: { from: '2026-10-10', to: '2026-10-10' },
  backfill: { from: '2026-08-08', to: '2026-08-14' },
};

async function fixture(t) {
  const parent = await mkdtemp(join(tmpdir(), 'actual-status-window-'));
  const root = join(parent, 'daily');
  await mkdir(root);
  const preload = join(parent, 'freeze-and-guard.mjs');
  await writeFile(preload, `
    import childProcess from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    const NativeDate = Date;
    const fixedTime = NativeDate.parse('2026-10-11T16:00:00.000Z');
    globalThis.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixedTime])); }
      static now() { return fixedTime; }
    };
    const execFileSync = childProcess.execFileSync;
    childProcess.execFileSync = (file, ...args) => {
      if (file === '/usr/bin/security') throw new Error('Keychain access is forbidden in this fixture');
      return execFileSync.call(childProcess, file, ...args);
    };
    syncBuiltinESMExports();
  `);
  t.after(() => rm(parent, { recursive: true, force: true }));

  return {
    root,
    preload,
    run(command) {
      return spawnSync(process.execPath, ['--import', preload, entry, command], {
        encoding: 'utf8',
        env: { ...process.env, ACTUAL_DAILY_DIR: root },
      });
    },
  };
}

test('status returns the dated windows without changing fixture state or files', async t => {
  const f = await fixture(t);
  const state = stateFixture();
  const stateBytes = `${JSON.stringify(state, null, 2)}\n`;
  const statePath = join(f.root, 'state.json');
  await writeFile(statePath, stateBytes, { mode: 0o600 });

  const result = f.run('status');

  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, `${JSON.stringify({ state, windows: expectedWindows }, null, 2)}\n`);
  assert.equal(await readFile(statePath, 'utf8'), stateBytes);
  assert.deepEqual(await readdir(f.root), ['state.json']);
});

test('begin-run keeps the same window policy and persists its lease', async t => {
  const f = await fixture(t);
  const state = stateFixture();
  const statePath = join(f.root, 'state.json');
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });

  const result = f.run('begin-run');

  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(result.stderr, '');
  const lease = JSON.parse(result.stdout);
  assert.equal(lease.startedAt, '2026-10-11T16:00:00.000Z');
  assert.deepEqual(lease.windows, expectedWindows);
  const persisted = JSON.parse(await readFile(statePath, 'utf8'));
  assert.deepEqual(persisted.activeRun, lease);
  assert.deepEqual(persisted.futureState, state.futureState);
  assert.deepEqual(await readdir(f.root), ['state.json']);
});
