import test from 'node:test';
import assert from 'node:assert/strict';
import { getStatus } from './application/get-status.ts';

const stateFixture = () => ({
  dailyThrough: '2026-10-09',
  backfillThrough: '2026-08-07',
  dailyStart: '2026-10-10',
  futureState: { retained: true },
});

test('getStatus reads state before the Santiago date and preserves unknown keys', async () => {
  const state = stateFixture();
  const events = [];

  const result = await getStatus({
    stateReader: {
      read: async () => {
        events.push('state');
        return state;
      },
    },
    clock: {
      today: () => {
        events.push('clock');
        return '2026-10-11';
      },
    },
  });

  assert.deepEqual(events, ['state', 'clock']);
  assert.deepEqual(result, {
    state,
    windows: {
      daily: { from: '2026-10-10', to: '2026-10-10' },
      backfill: { from: '2026-08-08', to: '2026-08-14' },
    },
  });
  assert.strictEqual(result.state, state);
  assert.deepEqual(state, stateFixture());
});

test('getStatus does not read the clock after the state reader fails', async () => {
  let clockRead = false;

  await assert.rejects(
    getStatus({
      stateReader: { read: async () => { throw new Error('fixture state unavailable'); } },
      clock: { today: () => { clockRead = true; return '2026-10-11'; } },
    }),
    /fixture state unavailable/,
  );

  assert.equal(clockRead, false);
});
