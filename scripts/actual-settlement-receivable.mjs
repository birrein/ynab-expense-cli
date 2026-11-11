import assert from 'node:assert/strict';
import { BUDGETS } from './actual-daily-policy.mjs';

const fields = new Set(['settlementReceivableOpening','currency','name','date','bankDate','amount','sourceId','settlementFileId','bankStatementFileId','confirmationMessageId','evidence','reportingEvidence','limitations']);
const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const eq = (a, b, message) => assert.deepEqual(canon(a), canon(b), message);
const notesFor = c => `Liquidación por cobrar: punto inicial neto; historial de inversión, costo y promoción no reconstruidos.\nhttps://drive.google.com/file/d/${c.settlementFileId}/view\nhttps://drive.google.com/file/d/${c.bankStatementFileId}/view\nhttps://mail.google.com/mail/u/0/#all/${c.confirmationMessageId}\nsource=${c.sourceId}`;

export function classifySettlementReceivable(c, s, ledger) {
  assert.equal(c.settlementReceivableOpening, true);
  for (const k of Object.keys(c)) assert(fields.has(k), 'Unexpected field ' + k);
  assert(Object.hasOwn(BUDGETS, c.currency), 'Unsupported currency');
  assert(typeof c.name === 'string' && c.name.trim() === c.name && c.name.length > 0, 'Invalid account name');
  assert(typeof c.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(c.date) && Number.isFinite(Date.parse(c.date)) && new Date(c.date + 'T12:00:00Z').toISOString().slice(0,10) === c.date, 'Invalid date');
  assert(Number.isSafeInteger(c.amount) && c.amount > 0, 'Invalid opening amount');
  assert(typeof c.sourceId === 'string' && /^checkpoint:[A-Za-z0-9:_-]+$/.test(c.sourceId), 'Invalid source');
  assert(/(?:por cobrar|receivable)/i.test(c.name), 'Account name must identify receivable');
  assert(typeof c.bankDate === 'string' && /^\d{4}-\d\d-\d\d$/.test(c.bankDate) && Number.isFinite(Date.parse(c.bankDate)) && new Date(c.bankDate+'T12:00:00Z').toISOString().slice(0,10)===c.bankDate, 'Invalid bank date');
  const delta = (Date.parse(c.bankDate)-Date.parse(c.date))/86400000;
  assert(delta >= 0 && delta <= 7, 'Bank date must follow checkpoint within seven days');
  for (const k of ['settlementFileId','bankStatementFileId']) assert(typeof c[k] === 'string' && /^[A-Za-z0-9_-]{8,}$/.test(c[k]), 'Invalid document ' + k);
  assert.notEqual(c.settlementFileId,c.bankStatementFileId,'Settlement and bank documents must differ');
  assert(typeof c.confirmationMessageId === 'string' && /^[a-f0-9]{8,}$/.test(c.confirmationMessageId),'Invalid confirmation');
  for(const k of ['evidence','reportingEvidence','limitations']) assert(typeof c[k]==='string' && c[k].trim().length>=30,'Missing detailed '+k);
  for(const [key,a] of Object.entries(ledger.settlementReceivables??{})) if(key!==c.sourceId) assert(a.candidate?.settlementFileId!==c.settlementFileId,'Settlement document already used');
  const categories = s.categories.filter(x => x.name.toLowerCase() === 'starting balances' && x.is_income && !x.hidden);
  assert.equal(categories.length, 1, 'Expected one active Starting Balances category');
  const payees = s.payees.filter(x => x.name?.toLowerCase() === 'starting balance' && !x.transfer_acct);
  assert.equal(payees.length, 1, 'Expected one Starting Balance payee');
  const matches = s.accounts.filter(x => x.name.trim().toLocaleLowerCase() === c.name.toLocaleLowerCase());
  const audit = ledger.settlementReceivables?.[c.sourceId];
  if (audit) {
    assert.equal(audit.status, 'complete', 'Pending investment opening requires investigation');
    eq(audit.candidate, c, 'Audit candidate differs');
    assert.equal(matches.length, 1); const a = matches[0];
    assert.equal(a.id, audit.id); assert(!a.closed && !a.offbudget, 'Account unavailable');
    assert.equal(s.payees.filter(p => p.transfer_acct === a.id).length, 1);
    const t = s.transactions.find(t => t.id === audit.openingId);
    assert(t && t.account === a.id && t.date === c.date && t.amount === c.amount && t.starting_balance_flag === true && t.category === categories[0].id && t.payee === payees[0].id && t.notes === notesFor(c), 'Audited opening differs');
    return { action: 'existing', id: a.id, openingId: t.id };
  }
  assert.equal(matches.length, 0, 'Account name already exists without audit');
  assert(!ledger.records?.[c.sourceId] && !ledger.cashflows?.[c.sourceId], 'Source already used');
  assert(!s.transactions.some(t => String(t.notes ?? '').includes('source=' + c.sourceId)), 'Source already present');
  return { action: 'create', openingCategory: categories[0].id, startingPayee: payees[0].id, notes: notesFor(c) };
}

export async function settlementReceivable(c, commit, d) {
  assert(Object.hasOwn(BUDGETS, c.currency), 'Unsupported currency');
  let ledger = commit ? await d.requireRun() : await d.readState();
  let { api } = await d.connect(BUDGETS[c.currency]?.syncId), before, action, dir, id, openingId;
  try {
    before = await d.snapshot(api); action = classifySettlementReceivable(c, before, ledger);
    if (!commit) return { ...action, candidate: c, checkpointOnly: true,
      reporting: 'Starting Balances is an income category; exclude it from earned-income reports before applying. This is a partial receivable checkpoint, not historical cost, income or investment return.' };
    if (action.action === 'existing') return { ...action, verified: true, backup: ledger.settlementReceivables[c.sourceId].backup };
    dir = await d.backup(api, c.currency, before);
    await d.json(dir + '/settlement-receivable.json', { candidate: c }); await api.sync();
    eq(await d.snapshot(api), before, 'Budget changed before opening');
    ledger = await d.requireRun(); classifySettlementReceivable(c, before, ledger);
    ledger.settlementReceivables ??= {};
    ledger.settlementReceivables[c.sourceId] = { status: 'pending', candidate: c, backup: dir };
    await d.save(ledger);
    id = await api.createAccount({ name: c.name, offbudget: false, closed: false }, c.amount);
    assert(typeof id === 'string' && id, 'Missing created account ID');
    const interim = await d.snapshot(api), openings = interim.transactions.filter(t => t.account === id && t.starting_balance_flag === true);
    assert.equal(openings.length, 1, 'Expected exactly one starting balance');
    const opening = openings[0]; openingId = opening.id;
    assert.equal(opening.amount, c.amount); assert.equal(opening.category, action.openingCategory); assert.equal(opening.payee, action.startingPayee);
    await api.updateTransaction(openingId, { date: c.date, notes: action.notes });
    let updated = false;
    for (let i=0;i<50;i++) {
      const t = (await d.snapshot(api)).transactions.find(t => t.id === openingId);
      if (t?.date === c.date && t.notes === action.notes && t.starting_balance_flag === true) { updated = true; break; }
      await new Promise(r => setTimeout(r,100));
    }
    assert(updated, 'Opening update incomplete; inspect pending audit'); await api.sync();
  } finally { await api.shutdown(); }
  ({ api } = await d.connect(BUDGETS[c.currency].syncId));
  try {
    const after = await d.snapshot(api), account = after.accounts.find(a => a.id === id), t = after.transactions.find(t => t.id === openingId);
    assert(account && account.name === c.name && !account.closed && !account.offbudget);
    assert(t && t.account === id && t.date === c.date && t.amount === c.amount && t.category === action.openingCategory && t.payee === action.startingPayee && t.notes === action.notes && t.starting_balance_flag === true && t.cleared === true && !t.is_parent && !t.is_child && !t.transfer_id, 'Opening mismatch');
    assert.equal(after.balances[id], c.amount); assert.equal(after.accounts.length, before.accounts.length+1);
    assert.equal(after.transactions.length, before.transactions.length+1); assert.equal(after.payees.length, before.payees.length+1);
    const added = after.payees.filter(p => !before.payees.some(q => q.id === p.id));
    assert.equal(added.length,1); assert.equal(added[0].transfer_acct,id);
    for (const key of ['accounts','payees','transactions']) {
      const map = new Map(after[key].map(x => [x.id,x])); assert.equal(map.size,after[key].length);
      for (const old of before[key]) eq(map.get(old.id),old,'Existing '+key+' changed');
    }
    for (const key of ['categories','rules','schedules']) eq(after[key],before[key],'Unrelated '+key+' changed');
    for (const [key,value] of Object.entries(before.balances)) assert.equal(after.balances[key],value,'Other balance changed');
    assert.equal(Object.keys(after.balances).length,Object.keys(before.balances).length+1);
    await d.json(dir+'/after.json',after); ledger=await d.requireRun();
    const audit=ledger.settlementReceivables?.[c.sourceId]; assert.equal(audit?.status,'pending'); eq(audit.candidate,c,'Pending audit differs');
    ledger.settlementReceivables[c.sourceId]={...audit,status:'complete',id,openingId,verifiedAt:new Date().toISOString()}; await d.save(ledger);
    return { action:'create', id, openingId, verified:true, backup:dir };
  } finally { await api.shutdown(); }
}
