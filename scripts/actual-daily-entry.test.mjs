import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const entry = new URL('./actual-runtime/actual-daily.ts', import.meta.url).pathname;
const usage = 'Commands: inventory, adopt-budgets --commit, snapshot --currency CLP|USD, status, begin-run, plan --file JSON, apply --file JSON --run-id ID --commit, remove --file JSON [--run-id ID --commit], finish-run --file JSON --run-id ID';

async function fixture(t) {
  const parent = await mkdtemp(join(tmpdir(), 'actual-daily-entry-'));
  const root = join(parent, 'daily');
  t.after(() => rm(parent, { recursive: true, force: true }));
  return {
    root,
    run: (...args) => spawnSync(process.execPath, [entry, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ACTUAL_DAILY_DIR: root },
    }),
  };
}

test('native TypeScript entry preserves no-command failure and isolated initialization', async t => {
  const f = await fixture(t);
  const result = f.run();
  assert.equal(result.status, 1, result.stderr || result.error?.message);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, `${usage}\n`);
  assert.deepEqual(await readdir(f.root), []);
});

for (const command of ['unknown-command', 'constructor', 'toString', 'hasOwnProperty', '__proto__']) {
  test(`native TypeScript entry rejects unknown command ${command} exactly`, async t => {
    const f = await fixture(t);
    const result = f.run(command);
    assert.equal(result.status, 1, result.stderr || result.error?.message);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, `${usage}\n`);
    assert.deepEqual(await readdir(f.root), []);
  });
}
