import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const rootFields = new Set(['cardRefinancing', 'currency', 'cardAccount', 'debtAccountName',
  'openingDate', 'principal', 'rateBps', 'interestCategory', 'payeeId', 'contractSourceId',
  'sourceKey', 'evidence', 'installments']);
const itemFields = new Set(['number', 'total', 'date', 'amount', 'principal', 'interest',
  'balance', 'days', 'statementId', 'cutoff']);
const cutoffFields = new Set(['used', 'billed', 'unbilledAdjustment', 'adjustmentStatementId', 'adjustmentEvidence']);
const review = reason => ({ action: 'review', reason });
const validDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
const amount = n => Number.isSafeInteger(n) && n >= 0 && n % 100 === 0;
const only = (obj, fields) => obj && typeof obj === 'object' && !Array.isArray(obj) &&
  Object.keys(obj).every(key => fields.has(key));
const normalized = value => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
const monthIndex = date => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));

export function classifyRefinancing(c, snapshot, ledger) {
  assert(only(c, rootFields) && c.cardRefinancing === true, 'Invalid or mixed refinancing fields');
  assert.equal(c.currency, 'CLP', 'Unsupported currency');
  for (const key of ['cardAccount', 'debtAccountName', 'interestCategory', 'payeeId', 'contractSourceId', 'sourceKey', 'evidence'])
    assert(typeof c[key] === 'string' && c[key].trim() === c[key] && c[key], `Missing ${key}`);
  assert(/^[a-f0-9]+$/.test(c.contractSourceId), 'Invalid contract source');
  assert(/^bank:[A-Za-z0-9:_-]+$/.test(c.sourceKey), 'Invalid source key');
  assert(!/[\u0000-\u001f\u007f]/u.test(c.debtAccountName), 'Invalid account name');
  assert(validDate(c.openingDate) && amount(c.principal) && c.principal > 0, 'Invalid principal or date');
  assert(Number.isInteger(c.rateBps) && c.rateBps > 0 && c.rateBps <= 10000, 'Invalid rate');
  assert(snapshot.accounts.some(a => a.id === c.cardAccount && !a.closed && !a.offbudget), 'Card unavailable');
  assert(snapshot.categories.some(x => x.id === c.interestCategory && !x.hidden && !x.is_income), 'Interest category unavailable');
  assert(snapshot.payees.some(x => x.id === c.payeeId && !x.transfer_acct), 'Bank payee unavailable');
  assert(snapshot.payees.filter(x => x.transfer_acct === c.cardAccount).length === 1, 'Card transfer payee missing or ambiguous');
  assert(Array.isArray(c.installments) && c.installments.length > 0 && c.installments.length <= 120, 'Invalid installments');
  const statements = new Set();
  let previous = c.principal, totalInterest = 0, previousDate = c.openingDate;
  for (const [index, i] of c.installments.entries()) {
    assert(only(i, itemFields) && only(i.cutoff, cutoffFields), 'Invalid installment fields');
    assert(i.number === index + 1 && Number.isInteger(i.total) && i.total >= c.installments.length && i.total <= 120 &&
      i.total === c.installments[0].total, 'Invalid installment sequence');
    assert(validDate(i.date) && i.date > previousDate, 'Invalid installment date');
    if (index > 0) assert.equal(monthIndex(i.date) - monthIndex(previousDate), 1, 'Nonconsecutive billing month');
    assert(typeof i.statementId === 'string' && /^[A-Za-z0-9_-]+$/.test(i.statementId) &&
      !statements.has(i.statementId), 'Invalid or duplicate statement');
    statements.add(i.statementId);
    for (const key of ['amount', 'principal', 'interest', 'balance']) assert(amount(i[key]), `Invalid ${key}`);
    for (const key of ['used', 'billed', 'unbilledAdjustment']) assert(amount(i.cutoff[key]), `Invalid cutoff ${key}`);
    if (i.cutoff.unbilledAdjustment) {
      assert(typeof i.cutoff.adjustmentStatementId === 'string' && /^[A-Za-z0-9_-]+$/.test(i.cutoff.adjustmentStatementId), 'Missing cutoff adjustment statement');
      assert(typeof i.cutoff.adjustmentEvidence === 'string' && i.cutoff.adjustmentEvidence.trim(), 'Missing cutoff adjustment evidence');
    } else assert(!i.cutoff.adjustmentStatementId && !i.cutoff.adjustmentEvidence, 'Unexpected cutoff adjustment evidence');
    assert(Number.isInteger(i.days) && i.days >= 1 && i.days <= 62, 'Invalid interest period');
    const numerator = BigInt(previous / 100) * BigInt(c.rateBps) * BigInt(i.days);
    const denominator = 300000n;
    const expectedInterest = Number((numerator + denominator / 2n) / denominator) * 100;
    assert.equal(i.interest, expectedInterest, 'Interest does not match disclosed rate and period');
    assert(i.principal > 0 && i.amount === i.principal + i.interest, 'Installment allocation mismatch');
    assert.equal(i.balance, previous - i.principal, 'Principal balance mismatch');
    assert.equal(i.cutoff.used - i.cutoff.billed - i.cutoff.unbilledAdjustment, i.balance, 'Cutoff balance mismatch');
    previous = i.balance; previousDate = i.date; totalInterest += i.interest;
    assert(Number.isSafeInteger(totalInterest), 'Interest total overflow');
  }
  const prior = ledger.cardRefinancings?.[c.sourceKey];
  if (prior) return review('Existing refinancing audit requires verification or recovery');
  if (snapshot.accounts.some(a => normalized(a.name) === normalized(c.debtAccountName)))
    return review('Debt account exists without matching audit');
  const sourcePrefix = c.sourceKey + ':';
  if (snapshot.transactions.some(t => typeof t.imported_id === 'string' && t.imported_id.startsWith(sourcePrefix)))
    return review('Partial refinancing sources exist without matching audit');
  const targets = [{ date: c.openingDate, amount: c.principal },
    ...c.installments.map(i => ({ date: i.date, amount: -i.amount }))];
  if (snapshot.transactions.some(t => t.account === c.cardAccount && !t.is_child &&
    targets.some(x => x.amount === t.amount && Math.abs(Date.parse(x.date) - Date.parse(t.date)) <= 4 * 86400000)))
    return review('Potential existing refinancing transaction');
  return { action: 'create', principalRemaining: previous, totalInterest,
    totalBilled: c.installments.reduce((sum, i) => sum + i.amount, 0),
    allocation: c.installments.map(({ number, date, amount, principal, interest, balance, statementId }) =>
      ({ number, date, amount, principal, interest, balance, statementId, confidence: 'inferred' })) };
}

const canonical = value => Array.isArray(value) ? value.map(canonical) :
  value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const equal = (a, b, message) => assert.deepEqual(canonical(a), canonical(b), message);
const openingSource = c => `${c.sourceKey}:opening`;
const installmentSource = (c, i) => `${c.sourceKey}:installment:${String(i.number).padStart(2, '0')}`;
const openingNotes = c => `Refinanciación: capital transferido desde la tarjeta a la deuda.\nhttps://mail.google.com/mail/u/0/#all/${c.contractSourceId}\nsource=${openingSource(c)}`;
const installmentNotes = (c, i) => `#cuotas\nRefinanciación ${i.number}/${i.total}; reparto de capital e interés inferido a partir de contrato y cartolas.\nhttps://mail.google.com/mail/u/0/#all/${c.contractSourceId}\nhttps://drive.google.com/file/d/${i.statementId}/view\nsource=${installmentSource(c, i)}`;
const sourceEntry = (snapshot, id) => {
  const matches = snapshot.transactions.filter(t => t.imported_id === id);
  assert.equal(matches.length, 1, `Source ${id} missing or duplicated`);
  return matches[0];
};

function verifyPosted(c, s, debtId) {
  const debt = s.accounts.filter(a => a.id === debtId && a.name === c.debtAccountName && !a.closed && !a.offbudget);
  assert.equal(debt.length, 1, 'Debt account mismatch');
  const toDebt = s.payees.filter(p => p.transfer_acct === debtId);
  const toCard = s.payees.filter(p => p.transfer_acct === c.cardAccount);
  assert.equal(toDebt.length, 1, 'Debt transfer payee mismatch');
  assert.equal(toCard.length, 1, 'Card transfer payee mismatch');
  const opening = sourceEntry(s, openingSource(c));
  assert.equal(opening.account, debtId); assert.equal(opening.date, c.openingDate);
  assert.equal(opening.amount, -c.principal); assert.equal(opening.payee, toCard[0].id);
  assert.equal(opening.category, null); assert.equal(opening.notes, openingNotes(c));
  const openingPair = s.transactions.find(t => t.id === opening.transfer_id);
  assert(openingPair && openingPair.transfer_id === opening.id && openingPair.account === c.cardAccount &&
    openingPair.amount === c.principal && openingPair.date === c.openingDate && openingPair.payee === toDebt[0].id,
  'Opening transfer pair mismatch');
  const entries = [];
  for (const i of c.installments) {
    const parent = sourceEntry(s, installmentSource(c, i));
    assert.equal(parent.account, c.cardAccount); assert.equal(parent.date, i.date);
    assert.equal(parent.amount, -i.amount); assert.equal(parent.payee, c.payeeId);
    assert(parent.is_parent && !parent.is_child && parent.category == null, 'Installment parent mismatch');
    assert.equal(parent.notes, installmentNotes(c, i));
    assert.equal(parent.subtransactions?.length, 2, 'Installment must have two children');
    const principal = parent.subtransactions.filter(t => t.amount === -i.principal && t.payee === toDebt[0].id && !t.category);
    const interest = parent.subtransactions.filter(t => t.amount === -i.interest && t.category === c.interestCategory && !t.transfer_id);
    assert.equal(principal.length, 1, 'Principal child mismatch');
    assert.equal(interest.length, 1, 'Interest child mismatch');
    const counterpart = s.transactions.find(t => t.id === principal[0].transfer_id);
    assert(counterpart && counterpart.account === debtId && counterpart.amount === i.principal &&
      counterpart.date === i.date && counterpart.transfer_id === principal[0].id && counterpart.payee === toCard[0].id,
    'Installment principal counterpart mismatch');
    entries.push({ number: i.number, parentId: parent.id, principalId: principal[0].id,
      interestId: interest[0].id, counterpartId: counterpart.id });
  }
  assert.equal(s.balances[debtId], -c.installments.at(-1).balance, 'Debt principal balance mismatch');
  return { openingId: opening.id, openingCounterpartId: openingPair.id, installments: entries };
}

export async function createRefinancing(c, commit, ctx) {
  assert(ctx.budgets[c.currency], 'Unsupported budget');
  let ledger = commit ? await ctx.requireRun() : await ctx.readState();
  let { api } = await ctx.connect(ctx.budgets[c.currency].syncId);
  let before, preview, debtId, dir;
  try {
    before = await ctx.snapshot(api);
    const prior = ledger.cardRefinancings?.[c.sourceKey];
    if (prior?.status === 'complete') {
      assert.equal(prior.candidateDigest, digest(c), 'Existing audit conflicts with candidate');
      const verified = verifyPosted(c, before, prior.debtAccount);
      equal(verified, prior.entries, 'Existing refinancing entries changed');
      return { action: 'existing', verified: true, debtAccount: prior.debtAccount, entries: verified, backup: prior.backup };
    }
    preview = classifyRefinancing(c, before, ledger);
    if (!commit || preview.action === 'review') return { ...preview, candidate: c };
    assert(c.installments.every(i => i.date <= ctx.today()), 'Future installments cannot be posted');
    dir = await ctx.backup(api, c.currency, before);
    await ctx.json(dir + '/card-refinancing.json', { candidate: c, preview });
    await api.sync();
    equal(await ctx.snapshot(api), before, 'Budget changed before refinancing');
    ledger = await ctx.requireRun();
    equal(classifyRefinancing(c, before, ledger), preview, 'Preview changed before refinancing');
    ledger.cardRefinancings ??= {};
    ledger.cardRefinancings[c.sourceKey] = { status: 'pending', candidateDigest: digest(c), backup: dir,
      stage: 'before-account', startedAt: new Date().toISOString() };
    await ctx.save(ledger);
    debtId = await api.createAccount({ name: c.debtAccountName, offbudget: false, closed: false }, 0);
    assert(typeof debtId === 'string' && debtId, 'Debt account creation returned no ID');
    const payees = await api.getPayees();
    const toDebt = payees.filter(p => p.transfer_acct === debtId), toCard = payees.filter(p => p.transfer_acct === c.cardAccount);
    assert.equal(toDebt.length, 1); assert.equal(toCard.length, 1);
    ledger = await ctx.requireRun();
    ledger.cardRefinancings[c.sourceKey].debtAccount = debtId;
    ledger.cardRefinancings[c.sourceKey].stage = 'before-opening';
    await ctx.save(ledger);
    await api.addTransactions(debtId, [{ date: c.openingDate, amount: -c.principal, payee: toCard[0].id,
      category: null, imported_id: openingSource(c), notes: openingNotes(c), cleared: false }],
    { runTransfers: true, learnCategories: false });
    for (const i of c.installments) {
      ledger = await ctx.requireRun();
      ledger.cardRefinancings[c.sourceKey].stage = `before-installment-${i.number}`;
      await ctx.save(ledger);
      await api.addTransactions(c.cardAccount, [{ date: i.date, amount: -i.amount, payee: c.payeeId,
        is_parent: true, imported_id: installmentSource(c, i), notes: installmentNotes(c, i), cleared: false,
        subtransactions: [{ amount: -i.principal, payee: toDebt[0].id, notes: 'Amortización de capital inferida.' },
          { amount: -i.interest, category: c.interestCategory, notes: 'Interés inferido.' }] }],
      { runTransfers: true, learnCategories: false });
    }
    await api.sync();
  } finally { await api.shutdown(); }
  ({ api } = await ctx.connect(ctx.budgets[c.currency].syncId));
  try {
    const after = await ctx.snapshot(api), entries = verifyPosted(c, after, debtId);
    for (const key of ['categories', 'rules', 'schedules']) equal(after[key], before[key], `Unrelated ${key} changed`);
    for (const key of ['accounts', 'payees', 'transactions']) {
      const byId = new Map(after[key].map(x => [x.id, x]));
      for (const old of before[key]) equal(byId.get(old.id), old, `Existing ${key} changed`);
    }
    assert.equal(after.accounts.length, before.accounts.length + 1, 'Unexpected account count');
    assert.equal(after.payees.length, before.payees.length + 1, 'Unexpected payee count');
    assert.equal(after.transactions.length, before.transactions.length + 2 + 2 * c.installments.length, 'Unexpected transaction count');
    for (const [id, oldBalance] of Object.entries(before.balances)) {
      const expected = id === c.cardAccount ? oldBalance + c.principal - preview.totalBilled : oldBalance;
      assert.equal(after.balances[id], expected, 'Existing account balance changed unexpectedly');
    }
    await ctx.json(dir + '/after.json', after);
    ledger = await ctx.requireRun();
    assert.equal(ledger.cardRefinancings?.[c.sourceKey]?.candidateDigest, digest(c), 'Pending audit changed');
    ledger.cardRefinancings[c.sourceKey] = { ...ledger.cardRefinancings[c.sourceKey], status: 'complete',
      stage: 'verified', debtAccount: debtId, entries, verifiedAt: new Date().toISOString() };
    await ctx.save(ledger);
    return { action: 'create', verified: true, debtAccount: debtId, entries, backup: dir };
  } finally { await api.shutdown(); }
}
