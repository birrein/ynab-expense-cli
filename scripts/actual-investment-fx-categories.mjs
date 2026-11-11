import assert from 'node:assert/strict';
import { BUDGETS } from './actual-daily-policy.mjs';

const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const eq = (a, b, message) => assert.deepEqual(canon(a), canon(b), message);
const key = p => `${p.currency}:${p.name}`;
const groupMetadata = g => { const { categories, ...rest } = g; return rest; };

export function classifyFxCategory(p, snapshot, groups, ledger) {
  assert.equal(p?.investmentFxCategory, true);
  eq(Object.keys(p).sort(), ['currency','evidence','groupName','investmentFxCategory','isIncome','name'].sort(), 'Unexpected fields');
  const usd = p.currency === 'USD' && p.name === 'Transferencias entre monedas / Salida USD' &&
    p.groupName === 'Transferencias entre monedas' && p.isIncome === false;
  const clp = p.currency === 'CLP' && p.name === 'Transferencias entre monedas / Entrada CLP' &&
    p.groupName === 'Income' && p.isIncome === true;
  assert(usd || clp, 'Wrong currency, category or direction');
  assert(typeof p.evidence === 'string' && p.evidence.trim().length >= 40, 'Evidence missing');
  const candidates = groups.filter(g => g.name?.trim().toLocaleLowerCase() === p.groupName.toLocaleLowerCase());
  assert(candidates.length <= 1, 'Ambiguous group');
  const group = candidates[0];
  if (group) assert(!group.hidden && group.is_income === p.isIncome, 'Wrong or hidden group');
  else assert(!p.isIncome, 'Income group missing');
  const cats = snapshot.categories.filter(c => c.name?.trim().toLocaleLowerCase() === p.name.toLocaleLowerCase());
  const audit = ledger.investmentFxCategories?.[key(p)];
  if (audit?.status === 'pending') throw Error('Pending category operation requires investigation');
  if (audit) {
    assert.equal(audit.status, 'complete'); eq(audit.candidate, p, 'Audit candidate changed');
    assert.equal(cats.length, 1, 'Audited category missing or ambiguous');
    const category = cats[0];
    assert(category.id === audit.categoryId && group?.id === audit.groupId && !category.hidden &&
      category.name === p.name && category.group_id === group.id && category.is_income === p.isIncome, 'Audited category changed');
    return { action: 'existing', categoryId: category.id, groupId: group.id };
  }
  assert.equal(cats.length, 0, 'Category already exists without audit');
  return { action: 'create', groupAction: group ? 'existing' : 'create', groupId: group?.id ?? null };
}

export async function ensureFxCategory(p, commit, d) {
  assert(Object.hasOwn(d.budgets ?? BUDGETS, p.currency), 'Unsupported currency');
  let ledger = commit ? await d.requireRun() : await d.readState();
  if (ledger.investmentFxCategories?.[key(p)]?.status === 'pending') throw Error('Pending category operation requires investigation');
  let { api } = await d.connect((d.budgets ?? BUDGETS)[p.currency].syncId);
  let before, groups, action, backup, groupId, categoryId;
  try {
    before = await d.snapshot(api); groups = await api.getCategoryGroups();
    action = classifyFxCategory(p, before, groups, ledger);
    if (!commit) return { ...action, candidate: p };
    if (action.action === 'existing') return { ...action, verified: true, backup: ledger.investmentFxCategories[key(p)].backup };
    backup = await d.backup(api, p.currency, before); await d.json(backup + '/fx-category.json', { candidate: p, groups });
    await api.sync(); eq(await d.snapshot(api), before, 'Budget changed before category');
    eq(await api.getCategoryGroups(), groups, 'Groups changed before category');
    ledger = await d.requireRun(); classifyFxCategory(p, before, groups, ledger);
    ledger.investmentFxCategories ??= {}; ledger.investmentFxCategories[key(p)] = { status:'pending', candidate:p, backup };
    await d.save(ledger);
    eq(await d.snapshot(api), before, 'Budget changed before category write');
    eq(await api.getCategoryGroups(), groups, 'Groups changed before category write');
    await d.requireRun();
    groupId = action.groupId ?? await api.createCategoryGroup({ name:p.groupName });
    categoryId = await api.createCategory({ name:p.name, group_id:groupId, is_income:p.isIncome });
    assert(typeof groupId === 'string' && groupId && typeof categoryId === 'string' && categoryId, 'Missing created identifiers');
    await api.sync();
  } finally { await api.shutdown(); }
  ({ api } = await d.connect((d.budgets ?? BUDGETS)[p.currency].syncId));
  try {
    const after = await d.snapshot(api), freshGroups = await api.getCategoryGroups();
    for (const k of Object.keys(before).filter(k => k !== 'categories')) eq(after[k], before[k], `Unrelated ${k} changed`);
    const categories = new Map(after.categories.map(c => [c.id,c]));
    assert.equal(categories.size, after.categories.length); assert.equal(after.categories.length, before.categories.length + 1);
    for (const old of before.categories) eq(categories.get(old.id), old, 'Existing category changed');
    const cat = categories.get(categoryId);
    assert(cat && cat.name === p.name && cat.group_id === groupId && cat.is_income === p.isIncome && !cat.hidden, 'Category mismatch');
    const groupMap = new Map(freshGroups.map(g => [g.id,g]));
    assert.equal(groupMap.size, freshGroups.length);
    assert.equal(freshGroups.length, groups.length + (action.groupAction === 'create' ? 1 : 0));
    for (const old of groups) eq(groupMetadata(groupMap.get(old.id)), groupMetadata(old), 'Existing group changed');
    const createdGroup = groupMap.get(groupId);
    assert(createdGroup && createdGroup.name === p.groupName && createdGroup.is_income === p.isIncome && !createdGroup.hidden, 'Group mismatch');
    await d.json(backup + '/after.json', after); await d.json(backup + '/groups-after.json', freshGroups);
    ledger = await d.requireRun(); const audit = ledger.investmentFxCategories?.[key(p)];
    assert.equal(audit?.status, 'pending'); eq(audit.candidate, p, 'Pending audit changed');
    ledger.investmentFxCategories[key(p)] = { ...audit, status:'complete', groupId, categoryId, verifiedAt:new Date().toISOString() };
    await d.save(ledger); assert.equal(classifyFxCategory(p, after, freshGroups, ledger).action, 'existing');
    return { action:'create', groupId, categoryId, backup, verified:true };
  } finally { await api.shutdown(); }
}
