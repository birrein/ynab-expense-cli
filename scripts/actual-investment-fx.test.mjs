import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyInvestmentFx, recordInvestmentFx } from './actual-investment-fx.mjs';

const p = {
  investmentFxConversion: true,
  date: '2026-07-08',
  reference: 'FX-INVESTMENT-2026-07-08-RACIONAL',
  statementFileIds: ['stockstatement123', 'cashstatement456'],
  gmailMessageIds: ['19f4a298376e9042'],
  evidence: 'Both verified provider statements show the same dated conversion and exact cash movements.',
  reportingEvidence: 'Operator verified named income and expense widgets exclude opening balance and direction-specific transfer categories.',
  usd: { account: 'usd-account', amount: -21663, category: 'out-usd', sourceId: 'bank:racional:fx:20260708:usd' },
  clp: { account: 'clp-account', amount: 20036200, category: 'in-clp', sourceId: 'bank:racional:fx:20260708:clp' },
};
const snap = c => ({
  accounts: [{ id: c + '-account', closed: false, offbudget: false }],
  balances: { [c + '-account']: 0 },
  categories: [c === 'usd'
    ? { id: 'out-usd', name: 'Transferencias entre monedas / Salida USD', is_income: false, hidden: false }
    : { id: 'in-clp', name: 'Transferencias entre monedas / Entrada CLP', is_income: true, hidden: false }],
  transactions: [], payees: [], rules: [], schedules: [],
});
const snapshots = () => ({ usd: snap('usd'), clp: snap('clp') });
const copy = structuredClone;

test('previews the exact USD-out and CLP-in without calculating a rate', () => {
  const result = classifyInvestmentFx(p, snapshots(), {});
  assert.equal(result.action, 'create');
  assert.equal(result.usd, -21663);
  assert.equal(result.clp, 20036200);
});
test('rejects unsupported evidence, inconsistent directions and reused identities', () => {
  for (const patch of [
    { date: '2026-02-30' }, { reference: 'invalid' }, { statementFileIds: ['same', 'same'] },
    { gmailMessageIds: ['not-a-message'] }, { gmailMessageIds: ['19f4a298376e9042','19f4a298376e9042'] },
    { evidence: '' }, { reportingEvidence: '' }, { usd: { ...p.usd, amount: 21663 } },
    { clp: { ...p.clp, amount: -20036200 } }, { clp: { ...p.clp, sourceId: p.usd.sourceId } },
  ]) assert.throws(() => classifyInvestmentFx({ ...p, ...patch }, snapshots(), {}));
  const s = snapshots(); s.usd.categories[0].is_income = true;
  assert.throws(() => classifyInvestmentFx(p, s, {}), /categor/i);
});
test('refuses nearby matches or an interrupted pending audit', () => {
  const s = snapshots(); s.clp.transactions.push({ id: 'x', account: p.clp.account, amount: p.clp.amount, date: '2026-07-09' });
  assert.throws(() => classifyInvestmentFx(p, s, {}), /duplicate/i);
  assert.throws(() => classifyInvestmentFx(p, snapshots(), { investmentFxConversions: { [p.reference]: { status: 'pending' } } }), /pending/i);
  assert.throws(() => classifyInvestmentFx(p, snapshots(), { records: { '19f4a298376e9042': { transactionId:'foreign' } } }), /source/i);
});
test('refuses a bank source already owned in the opposite budget or a previous conversion', () => {
  const s = snapshots();
  s.usd.transactions.push({ id:'other', account:p.usd.account, amount:-500, date:'2025-01-01', imported_id:p.clp.sourceId });
  assert.throws(() => classifyInvestmentFx(p, s, {}), /source/i);
  const prior = { status:'complete', candidate:{clp:{sourceId:p.clp.sourceId},usd:{sourceId:'bank:other:usd'}} };
  assert.throws(() => classifyInvestmentFx(p, snapshots(), { investmentFxConversions:{ 'FX-OTHER':prior } }), /source/i);
});
function fixture(failSecond = false) {
  let budgets = snapshots(), ledger = {}, events = [];
  const d = {
    budgets: { CLP: { syncId: 'clp-id' }, USD: { syncId: 'usd-id' } },
    async connect(id) {
      const c = id === 'clp-id' ? 'clp' : 'usd';
      return { api: { _currency: c, async shutdown() {}, async sync() {}, async addTransactions(account, rows) {
        events.push('write:' + c); if (failSecond && c === 'usd') throw Error('second write failed');
        const t = rows[0]; budgets[c].transactions.push({ ...t, id: c + '-id', account, transfer_id: null, is_parent: false, is_child: false });
        budgets[c].balances[account] += t.amount;
      } } };
    },
    async snapshot(api) { return copy(budgets[api._currency]); },
    async backup(api, c) { events.push('backup:' + c); return '/backup/' + c; },
    async readState() { return copy(ledger); }, async requireRun() { return copy(ledger); },
    async save(x) { ledger = copy(x); }, async json() {},
  };
  return { d, events, get ledger() { return ledger; }, get budgets() { return budgets; } };
}
test('backs up both budgets and verifies once; exact retry never rewrites', async () => {
  const f = fixture(); const r = await recordInvestmentFx(p, true, f.d);
  assert.equal(r.verified, true); assert.equal(f.ledger.investmentFxConversions[p.reference].status, 'complete');
  assert.equal(f.ledger.records[p.gmailMessageIds[0]].transactionId, 'clp-id');
  assert.deepEqual(f.events, ['backup:CLP', 'backup:USD', 'write:clp', 'write:usd']);
  assert.equal((await recordInvestmentFx(p, true, f.d)).verified, true);
  assert.equal(f.events.filter(x => x.startsWith('write:')).length, 2);
});
test('partial write retains pending audit and refuses blind retry', async () => {
  const f = fixture(true); await assert.rejects(recordInvestmentFx(p, true, f.d), /second write failed/);
  assert.equal(f.ledger.investmentFxConversions[p.reference].status, 'pending');
  await assert.rejects(recordInvestmentFx(p, true, f.d), /pending/i);
  assert.deepEqual(f.events.filter(x => x.startsWith('write:')), ['write:clp', 'write:usd']);
});
test('backup failure blocks every write', async () => {
  const f = fixture(), backup = f.d.backup;
  f.d.backup = async (a, c) => { if (c === 'USD') throw Error('backup failed'); return backup(a, c); };
  await assert.rejects(recordInvestmentFx(p, true, f.d), /backup failed/);
  assert.equal(f.events.filter(x => x.startsWith('write:')).length, 0);
});
test('concurrent change to either budget prevents completion', async () => {
  const f = fixture(), save = f.d.save;
  f.d.save = async l => { await save(l); if (l.investmentFxConversions?.[p.reference]?.status === 'pending') f.budgets.usd.balances['usd-account'] = 3; };
  await assert.rejects(recordInvestmentFx(p, true, f.d), /budget changed before write/i);
  assert.equal(f.ledger.investmentFxConversions[p.reference].status, 'pending');
});
test('a Gmail source claimed during a write is never overwritten', async () => {
  const f = fixture(), save = f.d.save;
  let reads = 0; const requireRun = f.d.requireRun;
  f.d.requireRun = async () => {
    const current = await requireRun();
    if (current.investmentFxConversions?.[p.reference]?.status === 'pending' && ++reads === 3) {
      current.records = { [p.gmailMessageIds[0]]: { transactionId:'other' } };
      await save(current);
    }
    return current;
  };
  await assert.rejects(recordInvestmentFx(p, true, f.d), /source.*owned/i);
  assert.equal(f.ledger.records[p.gmailMessageIds[0]].transactionId, 'other');
  assert.equal(f.ledger.investmentFxConversions[p.reference].status, 'pending');
});
