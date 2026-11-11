import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as actual from './actual-runtime/node_modules/@actual-app/api/dist/index.js';
import { registerStatementCredit, resolveStatementCredit } from './actual-statement-credit.mjs';

test('official API verifies a pending statement credit and exact-source dashboard filter offline', async () => {
  const root = await mkdtemp(join(tmpdir(), 'actual-statement-credit-'));
  let ledger = {};
  try {
    let rt = await actual.init({ dataDir: root });
    await rt.send('create-budget', { budgetName: 'Credit offline', avoidUpload: true });
    const budgetId = (await actual.getBudgets())[0].id;
    const account = await actual.createAccount({ name: 'Card' });
    const payee = await actual.createPayee({ name: 'Bank' });
    const group = await actual.createCategoryGroup({ name: 'Expense', is_income: false });
    const category = await actual.createCategory({ name: 'Groceries', group_id: group, is_income: false });
    const incomeGroup = await actual.createCategoryGroup({ name: 'Verified income group', is_income: true });
    const incomeCategory = await actual.createCategory({ name: 'Verified income', group_id: incomeGroup, is_income: true });
    await actual.shutdown();
    const candidate = { statementCredit: true, currency: 'CLP', account, payee, date: '2024-09-27',
      amount: 2000000, sourceId: 'bank:test:credit:20000', statementId: 'statementId123',
      description: 'Descuento bancario confirmado.', categoryReason: 'Compra y categoría no identificadas.',
      evidence: 'La cartola acredita fecha, cuenta, abono y monto único del descuento bancario.' };
    const snapshot = async api => {
      const accounts = await api.getAccounts(), transactions = [], balances = {};
      for (const a of accounts) {
        transactions.push(...await api.getTransactions(a.id, '1900-01-01', '2100-01-01'));
        balances[a.id] = await api.getAccountBalance(a.id, '2100-01-01');
      }
      return { accounts, transactions, balances, categories: await api.getCategories(), payees: await api.getPayees(),
        rules: await api.getRules(), schedules: await api.getSchedules() };
    };
    const d = {
      async connect() { rt = await actual.init({ dataDir: root }); await actual.loadBudget(budgetId);
        return { api: { ...actual, sync: async () => {} }, rt }; }, snapshot,
      async readDashboard() { return (await actual.runQuery(actual.q('dashboard').select('*'))).data; },
      async updateWidget(runtime, w) { return runtime.send('dashboard-update-widget', w); },
      async readState() { return structuredClone(ledger); }, async requireRun() { return structuredClone(ledger); },
      async save(x) { ledger = structuredClone(x); }, async json() {},
      async backup(api) { const dir = join(root, 'backup'); await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'budget.zip'), await api.exportBudget()); return dir; },
    };
    const plan = await registerStatementCredit(candidate, false, d);
    assert(plan.widgetIds.length > 0, 'Synthetic dashboard must contain a protected income or cash-flow widget');
    d.expectedPlan = plan.planHash;
    const result = await registerStatementCredit(candidate, true, d);
    assert.equal(result.verified, true);
    assert.equal((await registerStatementCredit(candidate, true, d)).action, 'existing');
    const { api } = await d.connect();
    const rows = await api.getTransactions(account, '2024-09-01', '2024-09-30');
    assert.equal(rows.length, 1); assert.equal(rows[0].category, null);
    assert.equal(await api.getAccountBalance(account, '2100-01-01'), 2000000);
    await api.shutdown();
    const resolution = { statementCreditResolution: true, currency: 'CLP', sourceId: candidate.sourceId,
      oldTransaction: rows[0], category, nature: 'rebate',
      evidence: 'La boleta identifica inequívocamente la compra de alimentos y el descuento aplicado.',
      oldText: 'Categoría pendiente: Compra y categoría no identificadas.',
      newText: 'Descuento aplicado a la compra de alimentos.' };
    d.expectedPlan = (await resolveStatementCredit(resolution, false, d)).planHash;
    assert.equal((await resolveStatementCredit(resolution, true, d)).verified, true);
    assert.equal((await resolveStatementCredit(resolution, true, d)).action, 'existing');
    assert.equal((await registerStatementCredit(candidate, true, d)).action, 'existing');
    const second = { ...candidate, date: '2023-09-27', sourceId: 'bank:test:credit:income', amount: 1000000 };
    d.expectedPlan = (await registerStatementCredit(second, false, d)).planHash;
    await registerStatementCredit(second, true, d);
    const session = await d.connect();
    const secondRow = (await session.api.getTransactions(account, second.date, second.date))[0];
    await session.api.shutdown();
    const incomeResolution = { ...resolution, sourceId: second.sourceId, oldTransaction: secondRow,
      category: incomeCategory, nature: 'income', evidence: 'El comprobante identifica el abono como ingreso independiente del consumo.' };
    d.expectedPlan = (await resolveStatementCredit(incomeResolution, false, d)).planHash;
    assert.equal((await resolveStatementCredit(incomeResolution, true, d)).verified, true);
    assert.equal((await resolveStatementCredit(incomeResolution, true, d)).action, 'existing');
    assert.equal((await registerStatementCredit(second, true, d)).action, 'existing');
  } finally {
    try { await actual.shutdown(); } catch {}
    await rm(root, { recursive: true, force: true });
  }
});
