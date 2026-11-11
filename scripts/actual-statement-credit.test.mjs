import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyStatementCredit, pendingStatementCreditConflict, registerStatementCredit, resolveStatementCredit, reservedStatementCreditConflict } from './actual-statement-credit.mjs';

function fixture() {
  const candidate = {
    statementCredit: true, currency: 'CLP', account: 'account', payee: 'bank',
    date: '2024-09-27', amount: 2000000, sourceId: 'bank:bch:visa:credit:20240927:20000',
    statementId: 'statementId123', description: 'Descuento bancario por compras.',
    categoryReason: 'Compra relacionada y categoría no identificadas.',
    evidence: 'Cartola bancaria revisada: crédito liquidado, tarjeta, fecha e importe verificados.',
  };
  const budget = {
    accounts: [{ id: 'account', closed: false, offbudget: false }],
    payees: [{ id: 'bank', transfer_acct: null }],
    categories: [], rules: [], schedules: [], transactions: [], balances: { account: 0 },
  };
  const widgets = [
    { id: 'income', type: 'summary-card', meta: { conditionsOp: 'and', conditions: [{ field: 'amount', op: 'gt', value: 0 }] } },
    { id: 'worth', type: 'net-worth-card', meta: null },
  ];
  return { candidate, budget, widgets, ledger: {} };
}

test('verified credit previews one uncategorized transaction and protects income widgets', () => {
  const { candidate, budget, widgets, ledger } = fixture();
  const result = classifyStatementCredit(candidate, budget, ledger, widgets);
  assert.equal(result.action, 'create');
  assert.equal(result.category, null);
  assert.equal(result.label, 'Actual/Review');
  assert.deepEqual(result.widgetIds, ['income']);
});

test('incomplete evidence, nearby credits, reused source and unsafe widgets refuse a write', () => {
  const f = fixture();
  for (const mutation of [
    x => { x.candidate.categoryReason = ''; },
    x => { x.candidate.statementId = ''; },
    x => { x.candidate.amount = -2000000; },
    x => { x.budget.transactions.push({ account: 'account', date: '2024-09-26', amount: 2000000 }); },
    x => { x.ledger.cashflows = { [x.candidate.sourceId]: { id: 'other' } }; },
    x => { x.widgets[0].meta.conditionsOp = 'or'; },
  ]) {
    const x = structuredClone(f); mutation(x);
    assert.throws(() => classifyStatementCredit(x.candidate, x.budget, x.ledger, x.widgets));
  }
});

test('a pending statement credit blocks further financial writes until investigated', () => {
  const { candidate } = fixture();
  const ledger = { statementCredits: { [candidate.sourceId]: { status: 'pending', candidate } } };
  assert.equal(pendingStatementCreditConflict(ledger), true);
  ledger.statementCredits[candidate.sourceId].status = 'complete';
  assert.equal(pendingStatementCreditConflict(ledger), false);
  ledger.statementCreditResolutions = { [candidate.sourceId]: { status: 'pending' } };
  assert.equal(pendingStatementCreditConflict(ledger), true);
  ledger.statementCredits[candidate.sourceId].id = 'specific-credit-id';
  assert(reservedStatementCreditConflict({ oldTransaction: { id: 'specific-credit-id' } }, ledger));
  assert(reservedStatementCreditConflict({ sourceId: candidate.sourceId }, ledger));
  assert(!reservedStatementCreditConflict({ sourceId: 'other-source' }, ledger));
});

test('commit reserves source, excludes exact credit from income widgets and verifies independently', async () => {
  const f = fixture();
  let budget = structuredClone(f.budget), widgets = structuredClone(f.widgets), ledger = {};
  let writes = 0, connects = 0;
  const api = {
    async sync() {}, async shutdown() {},
    async addTransactions(account, entries) {
      writes++;
      const t = { ...entries[0], id: 'credit-id', account, is_parent: false, is_child: false,
        transfer_id: null, reconciled: false, schedule: null, subtransactions: [] };
      budget.transactions.push(t); budget.balances[account] += t.amount;
    },
  };
  const deps = {
    async connect() { connects++; return { api, rt: {} }; },
    async snapshot() { return structuredClone(budget); },
    async readDashboard() { return structuredClone(widgets); },
    async updateWidget(_rt, widget) { widgets = widgets.map(x => x.id === widget.id ? structuredClone(widget) : x); },
    async readState() { return structuredClone(ledger); },
    async requireRun() { return structuredClone(ledger); },
    async save(value) { ledger = structuredClone(value); },
    async backup() { return '/private/backup'; }, async json() {},
  };
  const plan = await registerStatementCredit(f.candidate, false, deps);
  deps.expectedPlan = plan.planHash;
  const result = await registerStatementCredit(f.candidate, true, deps);
  assert.equal(result.verified, true);
  assert.equal(ledger.statementCredits[f.candidate.sourceId].status, 'complete');
  assert.equal(budget.balances.account, 2000000);
  assert.equal(budget.transactions[0].category, null);
  assert(widgets[0].meta.conditions.some(c => c.field === 'notes' && c.op === 'doesNotContain'
    && c.value === `source=${f.candidate.sourceId}`));
  assert.deepEqual(widgets[1], f.widgets[1]);
  assert.equal((await registerStatementCredit(f.candidate, true, deps)).action, 'existing');
  assert.equal(writes, 1);
  assert(connects >= 3);
});

test('a failed widget update leaves a durable pending intent and blocks a second write', async () => {
  const f = fixture();
  let ledger = {}, writes = 0;
  const api = { async sync() {}, async shutdown() {}, async addTransactions() { writes++; } };
  const deps = {
    async connect() { return { api, rt: {} }; },
    async snapshot() { return structuredClone(f.budget); },
    async readDashboard() { return structuredClone(f.widgets); },
    async updateWidget() { throw new Error('simulated widget failure'); },
    async readState() { return structuredClone(ledger); },
    async requireRun() { return structuredClone(ledger); },
    async save(value) { ledger = structuredClone(value); },
    async backup() { return '/private/backup'; }, async json() {},
  };
  deps.expectedPlan = (await registerStatementCredit(f.candidate, false, deps)).planHash;
  await assert.rejects(registerStatementCredit(f.candidate, true, deps), /simulated widget failure/);
  assert.equal(ledger.statementCredits[f.candidate.sourceId].status, 'pending');
  assert.equal(pendingStatementCreditConflict(ledger), true);
  await assert.rejects(registerStatementCredit(f.candidate, true, deps), /Pending credit requires investigation/);
  assert.equal(writes, 0);
});

test('resolution preserves source and balance and retains the exclusion for an evidenced rebate', async () => {
  const f = fixture();
  f.budget.categories.push({ id: 'groceries', hidden: false, is_income: false });
  let budget = structuredClone(f.budget), widgets = structuredClone(f.widgets), ledger = {};
  const api = {
    async sync() {}, async shutdown() {},
    async addTransactions(account, entries) {
      const t = { ...entries[0], id: 'credit-id', account, is_parent: false, is_child: false,
        transfer_id: null, reconciled: false, schedule: null, subtransactions: [] };
      budget.transactions.push(t); budget.balances[account] += t.amount;
    },
    async updateTransaction(id, fields) { Object.assign(budget.transactions.find(t => t.id === id), fields); },
  };
  const d = {
    async connect() { return { api, rt: {} }; }, async snapshot() { return structuredClone(budget); },
    async readDashboard() { return structuredClone(widgets); },
    async updateWidget(_rt, w) { widgets = widgets.map(x => x.id === w.id ? structuredClone(w) : x); },
    async readState() { return structuredClone(ledger); }, async requireRun() { return structuredClone(ledger); },
    async save(v) { ledger = structuredClone(v); }, async backup() { return '/private/backup'; }, async json() {},
  };
  d.expectedPlan = (await registerStatementCredit(f.candidate, false, d)).planHash;
  await registerStatementCredit(f.candidate, true, d);
  const oldTransaction = structuredClone(budget.transactions[0]);
  const resolution = { statementCreditResolution: true, currency: 'CLP', sourceId: f.candidate.sourceId,
    oldTransaction, category: 'groceries', nature: 'rebate',
    evidence: 'El comprobante identifica la compra de alimentos y el descuento aplicado a ella.',
    oldText: 'Categoría pendiente: Compra relacionada y categoría no identificadas.',
    newText: 'Descuento de compra de alimentos según comprobante.' };
  const plan = await resolveStatementCredit(resolution, false, d);
  assert.equal(plan.action, 'resolve');
  d.expectedPlan = plan.planHash;
  widgets[0].meta.conditions.push({ field: 'account', op: 'onBudget', value: '' });
  await assert.rejects(resolveStatementCredit(resolution, true, d), /Preview missing or changed/);
  widgets[0].meta.conditions.pop();
  assert.equal((await resolveStatementCredit(resolution, true, d)).verified, true);
  assert.equal(budget.transactions[0].category, 'groceries');
  assert.equal(budget.balances.account, 2000000);
  assert(budget.transactions[0].notes.includes(`source=${f.candidate.sourceId}`));
  assert(widgets[0].meta.conditions.some(c => c.value === `source=${f.candidate.sourceId}`));
  assert.equal(ledger.cashflows[f.candidate.sourceId].status, 'registered');
  assert.equal((await resolveStatementCredit(resolution, true, d)).action, 'existing');
  assert.equal((await registerStatementCredit(f.candidate, true, d)).action, 'existing');
});

test('interruption after the bank credit was written reserves its original source', async () => {
  const f = fixture(); let budget = structuredClone(f.budget), widgets = structuredClone(f.widgets), ledger = {}, writes = 0;
  const api = { async sync() {}, async shutdown() {}, async addTransactions(account, entries) {
    writes++; budget.transactions.push({ ...entries[0], id: 'credit-id', account });
    budget.balances[account] += entries[0].amount;
    throw new Error('simulated lost write response');
  } };
  const d = { async connect() { return { api, rt: {} }; }, async snapshot() { return structuredClone(budget); },
    async readDashboard() { return structuredClone(widgets); },
    async updateWidget(_rt, w) { widgets = widgets.map(x => x.id === w.id ? structuredClone(w) : x); },
    async readState() { return structuredClone(ledger); }, async requireRun() { return structuredClone(ledger); },
    async save(v) { ledger = structuredClone(v); }, async backup() { return '/private/backup'; }, async json() {} };
  d.expectedPlan = (await registerStatementCredit(f.candidate, false, d)).planHash;
  await assert.rejects(registerStatementCredit(f.candidate, true, d), /lost write response/);
  assert.equal(ledger.statementCredits[f.candidate.sourceId].stage, 'before-credit');
  assert(pendingStatementCreditConflict(ledger));
  await assert.rejects(registerStatementCredit(f.candidate, true, d), /Pending credit requires investigation/);
  assert.equal(writes, 1);
  assert.equal(budget.transactions[0].imported_id, f.candidate.sourceId);
});
