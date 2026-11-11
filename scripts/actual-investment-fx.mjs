import assert from 'node:assert/strict';
import { BUDGETS } from './actual-daily-policy.mjs';

const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const eq = (a, b, message) => assert.deepEqual(canon(a), canon(b), message);
const validDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) &&
  Number.isFinite(Date.parse(d + 'T12:00:00Z')) && new Date(d + 'T12:00:00Z').toISOString().slice(0, 10) === d;
const notes = p => [p.reference, 'Conversión de fondos propios entre presupuestos; no es gasto ni ingreso económico.',
  ...p.statementFileIds.map(id => `https://drive.google.com/file/d/${id}/view`),
  ...p.gmailMessageIds.map(id => `https://mail.google.com/mail/u/0/#all/${id}`)].join('\n');
const matches = (t, leg, p) => t.account === leg.account && t.date === p.date && t.amount === leg.amount &&
  t.category === leg.category && t.imported_id === leg.sourceId && t.notes === notes(p) &&
  !t.transfer_id && !t.is_parent && !t.is_child && !t.parent_id;

export function classifyInvestmentFx(p, snapshots, ledger) {
  assert.equal(p?.investmentFxConversion, true, 'Expected investment conversion');
  eq(Object.keys(p).sort(), ['clp','date','evidence','gmailMessageIds','investmentFxConversion','reference','reportingEvidence','statementFileIds','usd'].sort(), 'Unexpected fields');
  assert(validDate(p.date), 'Invalid date');
  assert(typeof p.reference === 'string' && p.reference.startsWith(`FX-INVESTMENT-${p.date}-`) && /^FX-INVESTMENT-[A-Z0-9-]+$/.test(p.reference), 'Invalid reference');
  assert(Array.isArray(p.statementFileIds) && p.statementFileIds.length >= 2 && new Set(p.statementFileIds).size === p.statementFileIds.length && p.statementFileIds.every(x => typeof x === 'string' && /^[A-Za-z0-9_-]{8,}$/.test(x)), 'Invalid statement sources');
  assert(Array.isArray(p.gmailMessageIds) && p.gmailMessageIds.length > 0 && new Set(p.gmailMessageIds).size === p.gmailMessageIds.length && p.gmailMessageIds.every(x => typeof x === 'string' && /^[a-f0-9]{16,32}$/.test(x)), 'Invalid Gmail sources');
  assert(typeof p.evidence === 'string' && p.evidence.trim().length >= 40, 'Evidence missing');
  assert(typeof p.reportingEvidence === 'string' && p.reportingEvidence.trim().length >= 40, 'Reporting evidence missing');
  for (const [currency, leg] of [['usd', p.usd], ['clp', p.clp]]) {
    assert(leg && typeof leg === 'object');
    eq(Object.keys(leg).sort(), ['account','amount','category','sourceId'].sort(), 'Unexpected leg fields');
    assert(typeof leg.account === 'string' && leg.account && typeof leg.category === 'string' && leg.category, 'Missing account/category');
    assert(Number.isSafeInteger(leg.amount) && (currency === 'usd' ? leg.amount < 0 : leg.amount > 0), 'Invalid direction');
    assert(typeof leg.sourceId === 'string' && /^bank:[A-Za-z0-9:_-]+$/.test(leg.sourceId), 'Invalid source');
    const s = snapshots[currency];
    assert(s?.accounts.some(a => a.id === leg.account && !a.closed && !a.offbudget), 'Account unavailable');
    const cat = s.categories.find(c => c.id === leg.category);
    assert(cat && !cat.hidden && (currency === 'usd'
      ? cat.is_income === false && cat.name === 'Transferencias entre monedas / Salida USD'
      : cat.is_income === true && cat.name === 'Transferencias entre monedas / Entrada CLP'), 'Wrong transfer category');
  }
  assert.notEqual(p.clp.sourceId, p.usd.sourceId, 'Source identities must differ');
  const audit = ledger.investmentFxConversions?.[p.reference];
  if (audit?.status === 'pending') throw Error('Pending investment conversion requires investigation');
  if (audit) {
    assert.equal(audit.status, 'complete'); eq(audit.candidate, p, 'Audit candidate differs');
    for (const [currency, leg] of [['clp', p.clp], ['usd', p.usd]]) {
      const found = snapshots[currency].transactions.filter(t => t.imported_id === leg.sourceId);
      assert.equal(found.length, 1, 'Completed leg missing or duplicated');
      assert(matches(found[0], leg, p), 'Completed leg differs'); assert.equal(found[0].id, audit.ids[currency]);
    }
    for (const id of p.gmailMessageIds) assert.equal(ledger.records?.[id]?.transactionId, audit.ids.clp, 'Completed Gmail source changed');
    return { action: 'existing', ids: audit.ids };
  }
  for (const id of p.gmailMessageIds) {
    assert(!ledger.records?.[id], 'Gmail source already owned');
    for (const currency of ['clp','usd']) assert(!snapshots[currency].transactions.some(t => String(t.notes ?? '').includes(id) || t.imported_id === `gmail:${id}`), 'Gmail source already present');
  }
  for (const leg of [p.clp, p.usd]) {
    for (const currency of ['clp','usd'])
      assert(!snapshots[currency].transactions.some(t => t.imported_id === leg.sourceId || String(t.notes ?? '').includes(`source=${leg.sourceId}`)), 'Bank source already present');
    for (const prior of Object.values(ledger.investmentFxConversions ?? {}))
      assert(![prior?.candidate?.clp?.sourceId, prior?.candidate?.usd?.sourceId].includes(leg.sourceId), 'Bank source already owned');
  }
  for (const [currency, leg] of [['clp', p.clp], ['usd', p.usd]]) {
    assert(!ledger.records?.[leg.sourceId] && !ledger.cashflows?.[leg.sourceId], 'Source already in ledger');
    const ts = snapshots[currency].transactions;
    assert(!ts.some(t => t.imported_id === leg.sourceId || String(t.notes ?? '').includes(p.reference)), 'Duplicate source or reference');
    assert(!ts.some(t => t.account === leg.account && t.amount === leg.amount && Math.abs(Date.parse(t.date + 'T12:00:00Z') - Date.parse(p.date + 'T12:00:00Z')) <= 4 * 86400000), 'Possible duplicate on account');
  }
  return { action: 'create', reference: p.reference, clp: p.clp.amount, usd: p.usd.amount };
}
async function withBudget(d, currency, fn) {
  const { api } = await d.connect((d.budgets ?? BUDGETS)[currency].syncId);
  try { return await fn(api); } finally { await api.shutdown(); }
}
async function getSnapshots(d) {
  const out = {};
  for (const c of ['CLP','USD']) out[c.toLowerCase()] = await withBudget(d, c, api => d.snapshot(api));
  return out;
}
function verifyNew(before, after, p, currency) {
  const leg = p[currency], found = after.transactions.filter(t => t.imported_id === leg.sourceId);
  assert.equal(found.length, 1, 'New source missing or duplicated'); const t = found[0];
  assert(matches(t, leg, p), 'New leg differs');
  assert.equal(after.transactions.length, before.transactions.length + 1, 'Transaction count changed');
  const byId = new Map(after.transactions.map(x => [x.id, x])); assert.equal(byId.size, after.transactions.length);
  for (const old of before.transactions) eq(byId.get(old.id), old, 'Other transaction changed');
  for (const key of Object.keys(before).filter(k => !['transactions','balances'].includes(k))) eq(after[key], before[key], `Unrelated ${key} changed`);
  const balances = structuredClone(before.balances); balances[leg.account] += leg.amount;
  eq(after.balances, balances, 'Unexpected balances'); return t.id;
}
export async function recordInvestmentFx(p, commit, d) {
  let ledger = commit ? await d.requireRun() : await d.readState();
  if (ledger.investmentFxConversions?.[p.reference]?.status === 'pending') throw Error('Pending investment conversion requires investigation');
  const before = await getSnapshots(d), action = classifyInvestmentFx(p, before, ledger);
  if (!commit) return { ...action, candidate: p, note: 'Separate budget entries; verify report filters independently.' };
  if (action.action === 'existing') return { ...action, verified: true, backups: ledger.investmentFxConversions[p.reference].backups };
  const backups = {};
  for (const c of ['CLP','USD']) backups[c.toLowerCase()] = await withBudget(d, c, async api => {
    eq(await d.snapshot(api), before[c.toLowerCase()], 'Budget changed before backup');
    const dir = await d.backup(api, c, before[c.toLowerCase()]); await d.json(dir + '/investment-fx.json', { candidate: p }); return dir;
  });
  eq(await getSnapshots(d), before, 'Budget changed before conversion');
  ledger = await d.requireRun(); classifyInvestmentFx(p, before, ledger);
  ledger.investmentFxConversions ??= {}; ledger.investmentFxConversions[p.reference] = { status: 'pending', candidate: p, backups }; await d.save(ledger);
  for (const c of ['CLP','USD']) await withBudget(d, c, async api => {
    const k = c.toLowerCase(), leg = p[k]; eq(await d.snapshot(api), before[k], `${c} budget changed before write`);
    await d.requireRun(); await api.addTransactions(leg.account, [{ date: p.date, amount: leg.amount, category: leg.category,
      payee: null, imported_id: leg.sourceId, notes: notes(p), cleared: false }], { runTransfers: false, learnCategories: false }); await api.sync();
  });
  const after = await getSnapshots(d), ids = {};
  for (const k of ['clp','usd']) { ids[k] = verifyNew(before[k], after[k], p, k); await d.json(backups[k] + '/after.json', after[k]); }
  ledger = await d.requireRun(); const audit = ledger.investmentFxConversions?.[p.reference];
  assert.equal(audit?.status, 'pending'); eq(audit.candidate, p, 'Pending audit changed');
  for (const id of p.gmailMessageIds) assert(!ledger.records?.[id], 'Gmail source already owned during conversion');
  audit.ids = ids; audit.status = 'complete'; audit.verifiedAt = new Date().toISOString();
  ledger.records ??= {};
  for (const id of p.gmailMessageIds) ledger.records[id] = { transactionId:ids.clp, currency:'CLP', account:p.clp.account,
    date:p.date, amount:p.clp.amount, category:p.clp.category, sourceIds:p.gmailMessageIds, status:'registered',
    reason:'Conversión propia documentada; no es ingreso económico.', verifiedAt:audit.verifiedAt, backup:backups.clp, investmentFxReference:p.reference };
  await d.save(ledger);
  assert.equal(classifyInvestmentFx(p, after, ledger).action, 'existing');
  return { ...action, ids, backups, verified: true };
}
