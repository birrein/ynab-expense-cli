import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BUDGETS } from './actual-daily-policy.mjs';

const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const equal = (a, b, message) => assert.deepEqual(canonical(a), canonical(b), message);
const dateOK = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && Number.isFinite(Date.parse(`${s}T00:00:00Z`))
  && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const textOK = (s, min) => typeof s === 'string' && s.trim().length >= min && !/[\r\n]/.test(s);

export function pendingStatementCreditConflict(ledger) {
  return [ledger.statementCredits, ledger.statementCreditResolutions].some(group =>
    Object.values(group ?? {}).some(x => x?.status === 'pending'));
}

export function reservedStatementCreditConflict(candidate, ledger) {
  const serialized = JSON.stringify(candidate);
  return Object.entries(ledger.statementCredits ?? {}).some(([source, audit]) =>
    serialized.includes(source) || (audit?.id && serialized.includes(audit.id)));
}

const marker = p => `source=${p.sourceId}`;
const notes = p => `${p.description}\nCategoría pendiente: ${p.categoryReason}\nhttps://drive.google.com/file/d/${p.statementId}/view\n${marker(p)}`;
const exclusion = p => ({ field: 'notes', op: 'doesNotContain', value: marker(p) });
const filteredWidget = (w, p) => ({ ...w, meta: { ...w.meta, conditionsOp: 'and',
  conditions: [...(w.meta?.conditions ?? []), exclusion(p)] } });
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

function verifyCredit(p, t) {
  assert(t && !t.is_parent && !t.is_child && !t.transfer_id && !t.reconciled && !t.schedule
    && !t.tombstone && !t.subtransactions?.length, 'Unexpected credit structure');
  for (const [key, value] of Object.entries({ account: p.account, payee: p.payee, date: p.date,
    amount: p.amount, category: null, imported_id: p.sourceId, notes: notes(p), cleared: false })) {
    assert.equal(t[key] ?? null, value, `Credit field changed: ${key}`);
  }
}

function verifyWidgetExclusions(p, widgets, ids) {
  for (const id of ids) {
    const w = widgets.find(x => x.id === id);
    assert(w && w.meta?.conditionsOp === 'and', 'Protected widget unavailable');
    assert.equal((w.meta.conditions ?? []).filter(c => JSON.stringify(c) === JSON.stringify(exclusion(p))).length, 1,
      'Credit widget exclusion missing or duplicated');
  }
}

export async function registerStatementCredit(p, commit, d) {
  assert(BUDGETS[p.currency], 'Unsupported currency');
  let ledger = commit ? await d.requireRun() : await d.readState();
  let { api, rt } = await d.connect(BUDGETS[p.currency].syncId);
  let before, beforeWidgets, action, backup, afterWidgets;
  try {
    before = await d.snapshot(api);
    beforeWidgets = await d.readDashboard(api);
    const prior = ledger.statementCredits?.[p.sourceId];
    if (prior) {
      assert.equal(prior.status, 'complete', 'Pending credit requires investigation');
      equal(prior.candidate, p, 'Credit candidate conflicts with audit');
      const matches = before.transactions.filter(t => t.imported_id === p.sourceId);
      assert.equal(matches.length, 1, 'Audited credit missing or duplicated');
      assert.equal(matches[0].id, prior.id);
      const resolution = ledger.statementCreditResolutions?.[p.sourceId];
      if (resolution) {
        assert.equal(resolution.status, 'complete', 'Pending credit resolution requires investigation');
        equal(matches[0], resolvedTransaction(resolution.candidate), 'Resolved credit changed');
      } else verifyCredit(p, matches[0]);
      const record = ledger.cashflows?.[p.sourceId];
      assert(record && record.type === 'credit' && record.id === prior.id && record.status === (resolution ? 'registered' : 'review')
        && record.account === p.account && record.date === p.date && record.amount === p.amount
        && record.category === (resolution ? resolution.candidate.category : null) && record.verifiedAt && record.backup === prior.backup,
      'Credit ledger changed');
      if (!resolution || resolution.candidate.nature === 'rebate') verifyWidgetExclusions(p, beforeWidgets, prior.widgetIds);
      return { action: 'existing', id: prior.id, label: resolution ? 'Actual/Registered' : 'Actual/Review', verified: true, backup: prior.backup };
    }
    action = classifyStatementCredit(p, before, ledger, beforeWidgets);
    const planHash = hash({ candidate: p, budget: before, widgets: beforeWidgets, action });
    if (!commit) return { ...action, candidate: p, planHash };
    assert.equal(d.expectedPlan, planHash, 'Preview missing or changed');
    backup = await d.backup(api, p.currency, before);
    await d.json(`${backup}/statement-credit.json`, { candidate: p, action, beforeWidgets });
    await api.sync();
    equal(await d.snapshot(api), before, 'Budget changed before credit');
    equal(await d.readDashboard(api), beforeWidgets, 'Dashboard changed before credit');
    ledger = await d.requireRun();
    equal(classifyStatementCredit(p, before, ledger, beforeWidgets), action, 'Credit preview changed');
    ledger.statementCredits ??= {};
    ledger.statementCredits[p.sourceId] = { status: 'pending', stage: 'before-widgets', candidate: p, backup,
      widgetIds: action.widgetIds };
    await d.save(ledger);
    const targetIds = new Set(action.widgetIds);
    afterWidgets = beforeWidgets.map(w => targetIds.has(w.id) ? filteredWidget(w, p) : w);
    for (const w of afterWidgets.filter(w => targetIds.has(w.id))) {
      await d.requireRun();
      await d.updateWidget(rt, w);
    }
    equal(await d.readDashboard(api), afterWidgets, 'Widget exclusions changed');
    ledger = await d.requireRun();
    ledger.statementCredits[p.sourceId].stage = 'before-credit';
    await d.save(ledger);
    await d.requireRun();
    await api.addTransactions(p.account, [{ date: p.date, amount: p.amount, payee: p.payee,
      category: null, imported_id: p.sourceId, notes: notes(p), cleared: false }],
    { runTransfers: false, learnCategories: false });
    await api.sync();
  } finally { await api.shutdown(); }
  ({ api } = await d.connect(BUDGETS[p.currency].syncId));
  try {
    const after = await d.snapshot(api);
    const matches = after.transactions.filter(t => t.imported_id === p.sourceId);
    assert.equal(matches.length, 1, 'Credit missing or duplicated');
    verifyCredit(p, matches[0]);
    for (const key of ['accounts', 'categories', 'payees', 'rules', 'schedules']) equal(after[key], before[key], `Unrelated ${key} changed`);
    assert.equal(after.transactions.length, before.transactions.length + 1, 'Unexpected transaction count');
    const byId = new Map(after.transactions.map(t => [t.id, t]));
    assert.equal(byId.size, after.transactions.length, 'Duplicate IDs');
    for (const old of before.transactions) equal(byId.get(old.id), old, 'Unrelated transaction changed');
    equal(Object.keys(after.balances).sort(), Object.keys(before.balances).sort(), 'Accounts changed');
    for (const [id, balance] of Object.entries(before.balances)) {
      assert.equal(after.balances[id], balance + (id === p.account ? p.amount : 0), 'Unexpected balance');
    }
    equal(await d.readDashboard(api), afterWidgets, 'Dashboard changed');
    verifyWidgetExclusions(p, afterWidgets, action.widgetIds);
    await d.json(`${backup}/after.json`, after);
    ledger = await d.requireRun();
    assert.equal(ledger.statementCredits?.[p.sourceId]?.status, 'pending');
    assert.equal(ledger.statementCredits[p.sourceId].stage, 'before-credit');
    equal(ledger.statementCredits[p.sourceId].candidate, p, 'Credit intent changed');
    ledger.statementCredits[p.sourceId] = { ...ledger.statementCredits[p.sourceId], status: 'complete',
      stage: 'verified', id: matches[0].id, verifiedAt: new Date().toISOString() };
    ledger.cashflows ??= {};
    ledger.cashflows[p.sourceId] = { type: 'credit', id: matches[0].id, currency: p.currency,
      account: p.account, date: p.date, amount: p.amount, category: null, categoryReason: p.categoryReason,
      status: 'review', sourceIds: [], driveFileIds: [p.statementId], evidence: p.evidence,
      verifiedAt: new Date().toISOString(), backup };
    await d.save(ledger);
    return { action: 'create', id: matches[0].id, label: 'Actual/Review', verified: true, backup };
  } finally { await api.shutdown(); }
}

function resolutionNotes(p) {
  assert(textOK(p.oldText, 1) && textOK(p.newText, 1), 'Invalid note text');
  assert(!/https?:|source=|refundOf=|#/i.test(p.oldText + p.newText), 'Protected provenance');
  const n = p.oldTransaction.notes, i = typeof n === 'string' ? n.indexOf(p.oldText) : -1;
  assert(i >= 0 && i === n.lastIndexOf(p.oldText), 'Expected note text must occur once');
  return n.slice(0, i) + p.newText + n.slice(i + p.oldText.length);
}
const resolvedTransaction = p => ({ ...p.oldTransaction, category: p.category, notes: resolutionNotes(p) });

export async function resolveStatementCredit(p, commit, d) {
  equal(Object.keys(p).sort(), ['statementCreditResolution', 'currency', 'sourceId', 'oldTransaction',
    'category', 'nature', 'evidence', 'oldText', 'newText'].sort(), 'Unexpected fields');
  assert.equal(p.statementCreditResolution, true);
  assert(BUDGETS[p.currency] && ['rebate', 'income'].includes(p.nature) && textOK(p.evidence, 30), 'Incomplete evidence');
  let ledger = commit ? await d.requireRun() : await d.readState();
  let { api, rt } = await d.connect(BUDGETS[p.currency].syncId);
  let before, beforeWidgets, afterWidgets, action, dir;
  const inspect = (s, widgets, l) => {
    const original = l.statementCredits?.[p.sourceId], record = l.cashflows?.[p.sourceId];
    assert(original?.status === 'complete' && original.id === p.oldTransaction?.id, 'Original credit audit missing');
    assert(original.candidate.currency === p.currency && original.candidate.sourceId === p.sourceId, 'Credit source mismatch');
    verifyCredit(original.candidate, p.oldTransaction);
    assert(s.accounts.some(a => a.id === p.oldTransaction.account && !a.closed && !a.offbudget), 'Account unavailable');
    assert(s.categories.some(c => c.id === p.category && !c.hidden && Boolean(c.is_income) === (p.nature === 'income')), 'Category conflicts with nature');
    const prior = l.statementCreditResolutions?.[p.sourceId];
    if (prior) {
      assert.equal(prior.status, 'complete', 'Pending credit resolution requires investigation');
      equal(prior.candidate, p, 'Resolution audit conflict');
      equal(s.transactions.find(t => t.id === original.id), resolvedTransaction(p), 'Resolved credit changed');
      assert(record?.status === 'registered' && record.category === p.category && record.id === original.id, 'Resolution ledger changed');
      if (p.nature === 'rebate') verifyWidgetExclusions(original.candidate, widgets, original.widgetIds);
      else for (const id of original.widgetIds) {
        const w = widgets.find(x => x.id === id);
        assert(w && !(w.meta?.conditions ?? []).some(c => JSON.stringify(c) === JSON.stringify(exclusion(original.candidate))), 'Income widget unavailable or remains excluded');
      }
      return { action: 'existing', id: original.id };
    }
    assert(!pendingStatementCreditConflict(l), 'Pending credit requires investigation');
    assert(record?.status === 'review' && record.id === original.id && record.category === null
      && record.backup === original.backup && record.verifiedAt, 'Credit ledger changed');
    equal(s.transactions.filter(t => t.id === original.id), [p.oldTransaction], 'Credit changed');
    verifyWidgetExclusions(original.candidate, widgets, original.widgetIds);
    resolutionNotes(p);
    return { action: 'resolve', id: original.id, category: p.category, nature: p.nature, widgetIds: original.widgetIds };
  };
  try {
    before = await d.snapshot(api); beforeWidgets = await d.readDashboard(api);
    action = inspect(before, beforeWidgets, ledger);
    if (action.action === 'existing') return { ...action, verified: true, backup: ledger.statementCreditResolutions[p.sourceId].backup };
    const planHash = hash({ candidate: p, budget: before, widgets: beforeWidgets, action });
    if (!commit) return { ...action, candidate: p, planHash };
    assert.equal(d.expectedPlan, planHash, 'Preview missing or changed');
    dir = await d.backup(api, p.currency, before);
    await d.json(`${dir}/statement-credit-resolution.json`, { candidate: p, action, beforeWidgets });
    await api.sync(); equal(await d.snapshot(api), before, 'Budget changed before resolution');
    equal(await d.readDashboard(api), beforeWidgets, 'Dashboard changed before resolution');
    ledger = await d.requireRun(); equal(inspect(before, beforeWidgets, ledger), action, 'Resolution preview changed');
    ledger.statementCreditResolutions ??= {};
    ledger.statementCreditResolutions[p.sourceId] = { status: 'pending', candidate: p, backup: dir, stage: 'before-transaction' };
    await d.save(ledger);
    await d.requireRun();
    await api.updateTransaction(p.oldTransaction.id, { category: p.category, notes: resolutionNotes(p) });
    const creditCandidate = ledger.statementCredits[p.sourceId].candidate;
    afterWidgets = p.nature === 'rebate' ? beforeWidgets : beforeWidgets.map(w => action.widgetIds.includes(w.id)
      ? { ...w, meta: { ...w.meta, conditions: w.meta.conditions.filter(c => JSON.stringify(c) !== JSON.stringify(exclusion(creditCandidate))) } } : w);
    ledger = await d.requireRun(); ledger.statementCreditResolutions[p.sourceId].stage = 'before-widgets'; await d.save(ledger);
    if (p.nature === 'income') for (const w of afterWidgets.filter(w => action.widgetIds.includes(w.id))) {
      await d.requireRun(); await d.updateWidget(rt, w);
    }
    await api.sync();
  } finally { await api.shutdown(); }
  ({ api } = await d.connect(BUDGETS[p.currency].syncId));
  try {
    const after = await d.snapshot(api);
    equal(after.transactions.find(t => t.id === p.oldTransaction.id), resolvedTransaction(p), 'Resolved transaction differs');
    const { transactions: a, ...ar } = after, { transactions: b, ...br } = before;
    equal(ar, br, 'Unrelated budget state or balance changed'); assert.equal(a.length, b.length);
    const byId = new Map(a.map(t => [t.id, t])); assert.equal(byId.size, a.length);
    for (const t of b) if (t.id !== p.oldTransaction.id) equal(byId.get(t.id), t, 'Unrelated transaction changed');
    equal(await d.readDashboard(api), afterWidgets, 'Dashboard changed');
    await d.json(`${dir}/after.json`, after);
    ledger = await d.requireRun(); const intent = ledger.statementCreditResolutions?.[p.sourceId];
    assert(intent?.status === 'pending' && intent.stage === 'before-widgets', 'Resolution intent changed');
    equal(intent.candidate, p, 'Resolution intent candidate changed');
    ledger.statementCreditResolutions[p.sourceId] = { ...intent, status: 'complete', stage: 'verified', verifiedAt: new Date().toISOString() };
    ledger.cashflows[p.sourceId] = { ...ledger.cashflows[p.sourceId], category: p.category, categoryReason: null,
      status: 'registered', categoryResolutionBackup: dir };
    await d.save(ledger);
    return { ...action, verified: true, backup: dir };
  } finally { await api.shutdown(); }
}

export function classifyStatementCredit(p, s, ledger, widgets) {
  equal(Object.keys(p).sort(), ['statementCredit', 'currency', 'account', 'payee', 'date',
    'amount', 'sourceId', 'statementId', 'description', 'categoryReason', 'evidence'].sort(), 'Unexpected fields');
  assert.equal(p.statementCredit, true);
  assert(BUDGETS[p.currency], 'Unsupported currency');
  assert(/^bank:[A-Za-z0-9:-]+$/.test(p.sourceId), 'Invalid source');
  assert(/^[A-Za-z0-9_-]{8,}$/.test(p.statementId), 'Invalid statement');
  assert(dateOK(p.date) && p.date <= new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), 'Invalid date');
  assert(Number.isSafeInteger(p.amount) && p.amount > 0, 'Invalid amount');
  assert(textOK(p.description, 10) && textOK(p.categoryReason, 10) && textOK(p.evidence, 30), 'Incomplete evidence');
  assert(!/https?:|source=|refundOf=|#/i.test(`${p.description} ${p.categoryReason} ${p.evidence}`), 'Protected metadata');
  assert(s.accounts.some(a => a.id === p.account && !a.closed && !a.offbudget), 'Account unavailable');
  assert(s.payees.some(x => x.id === p.payee && !x.transfer_acct), 'Payee unavailable');
  assert(Array.isArray(widgets) && new Set(widgets.map(x => x.id)).size === widgets.length, 'Invalid dashboard');
  const targets = widgets.filter(w => w.type === 'cash-flow-card' || (w.type === 'summary-card'
    && (w.meta?.conditions ?? []).some(c => c.field === 'amount' && ['gt', 'gte'].includes(c.op)
      && Number.isFinite(c.value) && c.value <= 0)));
  for (const w of targets) assert(!w.meta?.conditions?.length || !w.meta.conditionsOp
    || w.meta.conditionsOp === 'and', 'Unsupported dashboard conditions');
  assert(!pendingStatementCreditConflict(ledger), 'Pending credit requires investigation');
  assert(!JSON.stringify(ledger).includes(p.sourceId), 'Ledger source conflict');
  const day = s => Date.parse(`${s}T00:00:00Z`) / 86400000;
  for (const t of s.transactions) {
    assert(t.imported_id !== p.sourceId && !String(t.notes ?? '').includes(p.sourceId), 'Transaction source conflict');
    assert(!(t.account === p.account && t.amount === p.amount && dateOK(t.date)
      && Math.abs(day(t.date) - day(p.date)) <= 4), 'Nearby credit requires investigation');
  }
  return { action: 'create', category: null, label: 'Actual/Review', widgetIds: targets.map(w => w.id).sort() };
}
