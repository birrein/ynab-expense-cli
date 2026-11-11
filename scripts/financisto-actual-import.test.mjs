import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildImportPlan,
  parseFinancistoAmount,
  parseFinancistoCsv,
  ensureAccounts,
  resolveAuthentication,
} from './financisto-actual-import.mjs';

test('authentication prefers session token and never passes both credentials', () => {
  assert.deepEqual(resolveAuthentication({ ACTUAL_SESSION_TOKEN: 'test-token', ACTUAL_PASSWORD: 'test-password' }), { sessionToken: 'test-token' });
  assert.deepEqual(resolveAuthentication({ ACTUAL_PASSWORD: 'test-password' }), { password: 'test-password' });
  assert.throws(() => resolveAuthentication({}), /ACTUAL_SESSION_TOKEN/);
});

test('historical accounts support categories and reject existing off-budget accounts', async () => {
  const groups = [{ sourceAccount: 'Cash', targetAccount: 'Financisto histórico / Cash' }];
  const ids = await ensureAccounts({
    getAccounts: async () => [],
    createAccount: async account => {
      assert.equal(account.offbudget, false);
      return 'historical-account';
    },
  }, groups);
  assert.equal(ids.get('Cash'), 'historical-account');
  await assert.rejects(() => ensureAccounts({
    getAccounts: async () => [{ name: groups[0].targetAccount, offbudget: true }],
  }, groups), /fuera de presupuesto/);
});

test('parseFinancistoAmount converts Chilean decimal notation to Actual cents', () => {
  assert.equal(parseFinancistoAmount('-51.932,00'), -5193200);
  assert.equal(parseFinancistoAmount('1.234,56'), 123456);
  assert.equal(parseFinancistoAmount('0,50'), 50);
  assert.equal(parseFinancistoAmount(''), null);
});

test('parseFinancistoCsv handles BOM, semicolons, quotes, and embedded newlines', () => {
  const csv = '\ufeffdate;time;account;amount;currency;original amount;original currency;category;parent;payee;location;project;note\n'
    + '2022-02-18;12:00:00;Cash;1.234,56;CLP;;;;;"Tienda; Centro";;;"Línea 1\nLínea 2"\n';

  assert.deepEqual(parseFinancistoCsv(csv), [{
    date: '2022-02-18',
    time: '12:00:00',
    account: 'Cash',
    amount: '1.234,56',
    currency: 'CLP',
    'original amount': '',
    'original currency': '',
    category: '',
    parent: '',
    payee: 'Tienda; Centro',
    location: '',
    project: '',
    note: 'Línea 1\nLínea 2',
  }]);
});

test('buildImportPlan excludes future installments and preserves source semantics', () => {
  const rows = parseFinancistoCsv([
    'date;time;account;amount;currency;original amount;original currency;category;parent;payee;location;project;note',
    '2022-02-18;10:00:00;BCH Cta Cte;1.000,00;CLP;;;Sueldo;;AFP Modelo;;;',
    '2022-02-18;11:00:00;Cash;-500,00;CLP;;;;;Tienda;Casa;Compra;Nota',
    '2022-02-19;11:00:00;Cash;-500,00;CLP;;;;Tienda;Casa;Cuota futura',
    '2022-02-17;11:00:00;BCH Crédito USD;-10,25;USD;;;;NordVPN;;;Suscripción',
  ].join('\n'));

  const plan = buildImportPlan(rows, { cutoff: '2022-02-18' });

  assert.equal(plan.includedRows, 3);
  assert.equal(plan.excludedFutureRows, 1);
  assert.deepEqual(plan.byCurrency, { CLP: 2, USD: 1 });
  assert.deepEqual(plan.groups.map(group => [group.currency, group.sourceAccount, group.transactions.length]), [
    ['CLP', 'BCH Cta Cte', 1],
    ['CLP', 'Cash', 1],
    ['USD', 'BCH Crédito USD', 1],
  ]);

  const salary = plan.groups[0].transactions[0];
  assert.equal(salary.amount, 100000);
  assert.equal(salary.categoryLabel, 'Sueldo');
  assert.equal(salary.isIncome, true);
  assert.match(salary.imported_id, /^financisto-csv-/);
  const filtered = buildImportPlan(rows, { cutoff: '2022-02-18', excludedRecords: [2] });
  assert.equal(filtered.includedRows, 2);
  assert.equal(filtered.groups.flatMap(g => g.transactions).some(t => t.imported_id === plan.groups[1].transactions[0].imported_id), false);
  assert.equal(filtered.groups[0].transactions[0].imported_id, salary.imported_id);

  const cash = plan.groups[1].transactions[0];
  assert.equal(cash.notes, 'Nota\nProyecto: Compra\nLugar: Casa');
});
