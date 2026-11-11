import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFxCategory, ensureFxCategory } from './actual-investment-fx-categories.mjs';

const usd = { investmentFxCategory: true, currency: 'USD', name: 'Transferencias entre monedas / Salida USD', groupName: 'Transferencias entre monedas', isIncome: false, evidence: 'Category for an independently evidenced investment currency conversion.' };
const clp = { investmentFxCategory: true, currency: 'CLP', name: 'Transferencias entre monedas / Entrada CLP', groupName: 'Income', isIncome: true, evidence: 'Category for an independently evidenced investment currency conversion.' };
const snap = () => ({ accounts: [], transactions: [], categories: [], payees: [], rules: [], schedules: [], balances: {} });
const groups = [{ id: 'income', name: 'Income', is_income: true, hidden: false }];
const copy = structuredClone;

test('plans an expense group and an income category in the existing income group', () => {
  assert.deepEqual(classifyFxCategory(usd, snap(), groups, {}), { action: 'create', groupAction: 'create', groupId: null });
  assert.deepEqual(classifyFxCategory(clp, snap(), groups, {}), { action: 'create', groupAction: 'existing', groupId: 'income' });
});
test('rejects wrong direction, hidden or ambiguous categories, groups and pending audits', () => {
  assert.throws(() => classifyFxCategory({ ...usd, isIncome: true }, snap(), groups, {}));
  const duplicate = snap(); duplicate.categories = [{ id: 'existing', name: usd.name, group_id: 'different', is_income: false, hidden: true }];
  assert.throws(() => classifyFxCategory(usd, duplicate, groups, {}), /category/i);
  assert.throws(() => classifyFxCategory(usd, snap(), [...groups, { id: 'a', name: usd.groupName, is_income: false }, { id: 'b', name: usd.groupName, is_income: false }], {}), /group/i);
  assert.throws(() => classifyFxCategory(clp, snap(), [], {}), /income group/i);
  assert.throws(() => classifyFxCategory(usd, snap(), groups, { investmentFxCategories: { ['USD:' + usd.name]: { status: 'pending' } } }), /pending/i);
});

function fixture(failCategory = false) {
  let state = snap(), gs = copy(groups), ledger = {}, events = [];
  const api = { async shutdown() {}, async sync() {}, async getCategoryGroups() { return copy(gs); },
    async createCategoryGroup(o) { events.push('group'); gs.push({ id: 'new-group', name: o.name, is_income: false, hidden: false }); return 'new-group'; },
    async createCategory(o) { events.push('category'); if (failCategory) throw Error('category failed'); state.categories.push({ id: 'new-category', ...o, hidden: false }); return 'new-category'; } };
  const d = { budgets: { USD: { syncId: 'usd' }, CLP: { syncId: 'clp' } }, async connect() { return { api }; }, async snapshot() { return copy(state); },
    async readState() { return copy(ledger); }, async requireRun() { return copy(ledger); }, async save(x) { ledger = copy(x); },
    async backup() { events.push('backup'); return '/backup'; }, async json() {} };
  return { d, events, get ledger() { return ledger; }, get state() { return state; }, get groups() { return gs; } };
}
test('backs up, creates and independently verifies; completed retry is read-only', async () => {
  const f = fixture(), result = await ensureFxCategory(usd, true, f.d);
  assert.equal(result.verified, true); assert.deepEqual(f.events, ['backup','group','category']);
  assert.equal(f.ledger.investmentFxCategories['USD:' + usd.name].status, 'complete');
  assert.equal((await ensureFxCategory(usd, true, f.d)).action, 'existing');
  assert.deepEqual(f.events, ['backup','group','category']);
});
test('category failure after creating a group keeps pending audit and blocks retry', async () => {
  const f = fixture(true); await assert.rejects(ensureFxCategory(usd, true, f.d), /category failed/);
  assert.equal(f.ledger.investmentFxCategories['USD:' + usd.name].status, 'pending');
  await assert.rejects(ensureFxCategory(usd, true, f.d), /pending/i);
  assert.deepEqual(f.events, ['backup','group','category']);
});
test('concurrent unrelated change prevents a successful audit', async () => {
  const f = fixture(), save = f.d.save;
  f.d.save = async x => { await save(x); if (x.investmentFxCategories?.['USD:' + usd.name]?.status === 'pending') f.state.accounts.push({ id:'changed' }); };
  await assert.rejects(ensureFxCategory(usd, true, f.d), /changed/i);
  assert.equal(f.ledger.investmentFxCategories['USD:' + usd.name].status, 'pending');
});
