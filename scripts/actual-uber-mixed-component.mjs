import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BUDGETS} from './actual-daily-policy.mjs';

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equal = (a,b,message) => assert.deepEqual(canonical(a),canonical(b),message);

export function classifyMixedComponent(c,s,l) {
  equal(Object.keys(c).sort(), ['mixedUberCashComponent','currency','wallet','receipt','statementFileId','cardSourceKey','cardTransaction','cardRecord','amount','total','evidence'].sort(), 'Unexpected candidate fields');
  assert.equal(c.mixedUberCashComponent,true); assert.equal(c.currency,'CLP');
  assert(/^[a-f0-9]{8,}$/.test(c.receipt)); assert(/^[A-Za-z0-9_-]{8,}$/.test(c.statementFileId));
  assert(typeof c.cardSourceKey==='string' && c.cardSourceKey.startsWith('bank:'));
  assert(typeof c.evidence==='string' && c.evidence.trim().length>=30);
  assert(Number.isSafeInteger(c.amount) && c.amount<0 && c.amount%100===0);
  assert(Number.isSafeInteger(c.total) && c.total<0 && c.total%100===0);
  const wallet=s.accounts.filter(a=>a.id===c.wallet);
  assert.equal(wallet.length,1); assert(!wallet[0].closed && !wallet[0].offbudget && /uber cash/i.test(wallet[0].name) && /parcial/i.test(wallet[0].name),'Partial wallet unavailable');
  const card=c.cardTransaction, record=c.cardRecord;
  assert(card && card.account!==c.wallet && card.amount<0 && card.amount+c.amount===c.total,'Mixed payment amounts do not match');
  assert(typeof card.date==='string' && /^\d{4}-\d\d-\d\d$/.test(card.date) && Number.isFinite(Date.parse(card.date+'T12:00:00Z')) && new Date(card.date+'T12:00:00Z').toISOString().slice(0,10)===card.date,'Invalid card date');
  assert.equal(card.imported_id,c.cardSourceKey,'Card source identity differs');
  assert(s.accounts.some(a=>a.id===card.account&&!a.closed&&!a.offbudget));
  assert(!card.transfer_id && !card.is_parent && !card.is_child && !card.parent_id && !card.starting_balance_flag && !card.schedule && !card.tombstone && !card.subtransactions?.length);
  const payee=s.payees.find(p=>p.id===card.payee&&!p.transfer_acct);
  const category=s.categories.find(x=>x.id===card.category&&!x.hidden&&!x.is_income);
  assert(payee && category && ((/^uber$/i.test(payee.name)&&/^(?:\S+\s+)?transportation$/i.test(category.name)) || (/^uber eats$/i.test(payee.name)&&/^eating out & delivery$/i.test(category.name))),'Unsupported mixed-payment payee/category');
  const existing=s.transactions.filter(t=>t.id===card.id);assert.equal(existing.length,1);equal(existing[0],card,'Card transaction changed');
  equal(l.cashflows?.[c.cardSourceKey],record,'Card ledger changed');
  assert(record?.status==='registered' && record.verifiedAt && record.type==='expense' && record.id===card.id && record.account===card.account && record.date===card.date && record.amount===card.amount && record.category===card.category && record.sourceIds?.includes(c.receipt) && record.driveFileIds?.includes(c.statementFileId),'Card source mismatch');
  assert(String(card.notes??'').includes('/'+c.receipt) && String(card.notes??'').includes('/'+c.statementFileId),'Card evidence links missing');
  assert(!l.records?.[c.receipt],'Receipt already owns another record');
  for(const [key,r] of Object.entries(l.cashflows??{})) if(key!==c.cardSourceKey) assert(!r.sourceIds?.includes(c.receipt),'Receipt belongs to another cashflow');
  for(const [key,value] of Object.entries(l)) if(!['activeRun','cashflows','records'].includes(key)) assert(!JSON.stringify(value)?.includes(c.receipt),'Receipt already reserved');
  for(const t of s.transactions) if(t.id!==card.id) {
    assert(!String(t.imported_id??'').includes(c.receipt) && !String(t.notes??'').includes('/'+c.receipt),'Receipt already in another transaction');
    if(!t.is_child && t.account===c.wallet && t.amount===c.amount && Math.abs(Date.parse(t.date)-Date.parse(card.date))<=86400000) assert.fail('Possible duplicate wallet expense');
  }
  const stable=structuredClone(l);delete stable.activeRun;
  return {action:'create',planHash:createHash('sha256').update(JSON.stringify(canonical({candidate:c,snapshot:s,ledger:stable}))).digest('hex')};
}

const note=c=>`Porción pagada con Uber Cash; historial de billetera parcial. Parte de tarjeta existente: ${c.cardTransaction.id}.\nhttps://mail.google.com/mail/u/0/#all/${c.receipt}\nhttps://drive.google.com/file/d/${c.statementFileId}/view`;
const source=c=>'gmail:'+c.receipt;
export const hasPendingMixedComponent=l=>[...Object.values(l.mixedUberCashComponents??{}),...Object.values(l.mixedUberCashNoteAmendments??{})].some(a=>a?.status==='pending');
export function mixedComponentSourceConflict(c,l) {
  const serialized=JSON.stringify(c);
  return Object.values(l.mixedUberCashComponents??{}).some(a=>['pending','complete'].includes(a?.status)&&[a.candidate?.receipt,a.id,a.candidate?.cardTransaction?.id].filter(Boolean).some(id=>serialized.includes(id)));
}

function noteReplacement(p,original) {
  equal(Object.keys(p).sort(),['mixedUberCashNoteAmendment','currency','receipt','oldText','newText','evidence'].sort(),'Unexpected amendment fields');
  assert.equal(p.mixedUberCashNoteAmendment,true);assert.equal(p.currency,'CLP');assert(/^[a-f0-9]{8,}$/.test(p.receipt));
  for(const key of ['oldText','newText','evidence'])assert(typeof p[key]==='string'&&p[key].trim(),'Missing '+key);
  assert(p.evidence.trim().length>=30);assert.notEqual(p.oldText,p.newText);
  for(const t of [p.oldText,p.newText])assert(!/[\r\n#]|https?:|source\s*=|refundOf\s*=/i.test(t),'Protected metadata');
  assert(typeof original==='string'&&original.split(p.oldText).length===2,'Old text must occur once');
  const start=original.indexOf(p.oldText),end=start+p.oldText.length;
  for(const pattern of [/https?:\/\/\S+/gi,/#[\p{L}\p{N}_-]+/gu,/^(?:source|refundOf)=.*$/gm])for(const m of original.matchAll(pattern))assert(end<=m.index||start>=m.index+m[0].length,'Edit overlaps protected metadata');
  return original.slice(0,start)+p.newText+original.slice(end);
}

function expectedCard(c,l,a) {
  const amendment=l.mixedUberCashNoteAmendments?.[c.receipt];if(!amendment)return c.cardTransaction;
  assert(amendment.status==='complete'&&amendment.backup&&amendment.verifiedAt,'Mixed note amendment incomplete');
  assert.equal(amendment.groupPlanHash,a.planHash,'Original group differs');assert.equal(amendment.walletId,a.id,'Wallet identity differs');assert.equal(amendment.candidate.receipt,c.receipt);
  assert.equal(amendment.oldNotes,c.cardTransaction.notes,'Original notes differ');const result=noteReplacement(amendment.candidate,amendment.oldNotes);assert.equal(amendment.newNotes,result,'Amended notes differ');
  return {...c.cardTransaction,notes:result};
}

function verifyPosted(c,s,l,a) {
  equal(l.cashflows?.[c.cardSourceKey],c.cardRecord,'Existing card ledger changed');
  const card=s.transactions.filter(t=>t.id===c.cardTransaction.id);assert.equal(card.length,1);equal(card[0],expectedCard(c,l,a),'Existing card transaction changed');
  const wallet=s.accounts.filter(x=>x.id===c.wallet);assert.equal(wallet.length,1);assert(!wallet[0].closed&&!wallet[0].offbudget&&/uber cash/i.test(wallet[0].name)&&/parcial/i.test(wallet[0].name),'Wallet changed');
  const found=s.transactions.filter(t=>t.imported_id===source(c));assert.equal(found.length,1,'Missing or duplicate wallet source');const t=found[0];
  for(const [k,v] of Object.entries({account:c.wallet,date:c.cardTransaction.date,amount:c.amount,payee:c.cardTransaction.payee,category:c.cardTransaction.category,notes:note(c),transfer_id:null,cleared:false}))assert.equal(t[k]??null,v,'Wallet component differs: '+k);
  assert(t.id&&!t.is_parent&&!t.is_child&&!t.parent_id&&!t.reconciled&&!t.schedule&&!t.tombstone&&!t.starting_balance_flag&&!t.subtransactions?.length,'Invalid wallet transaction');
  if(a?.id)assert.equal(t.id,a.id,'Wallet identity changed');
  return t.id;
}

function classifyMixedNote(p,s,l) {
  const group=l.mixedUberCashComponents?.[p.receipt];assert(group?.status==='complete'&&group.verifiedAt&&group.backup&&group.id&&/^[a-f0-9]{64}$/.test(group.planHash??''),'Original group incomplete');
  assert.equal(group.candidate.receipt,p.receipt);assert(!l.mixedUberCashNoteAmendments?.[p.receipt],'Note amendment already exists');
  const newNotes=noteReplacement(p,group.candidate.cardTransaction.notes);verifyPosted(group.candidate,s,l,group);
  const stable=structuredClone(l);delete stable.activeRun;
  return {action:'amend',id:group.candidate.cardTransaction.id,oldNotes:group.candidate.cardTransaction.notes,newNotes,planHash:createHash('sha256').update(JSON.stringify(canonical({candidate:p,snapshot:s,ledger:stable}))).digest('hex')};
}

export async function amendMixedComponentNote(p,commit,d) {
  assert.equal(p.currency,'CLP');if(commit)assert(/^[a-f0-9]{64}$/.test(d.expectedPlan??''),'Exact plan digest required');let l=commit?await d.requireRun():await d.readState();assert(!hasPendingMixedComponent(l),'Pending mixed Uber Cash component requires investigation');
  const prior=l.mixedUberCashNoteAmendments?.[p.receipt],group=l.mixedUberCashComponents?.[p.receipt];
  if(prior){assert(prior.status==='complete'&&prior.planHash===d.expectedPlan&&prior.verifiedAt&&prior.backup,'Incomplete amendment audit');equal(prior.candidate,p,'Amendment candidate differs');const {api}=await d.connect(BUDGETS[p.currency].syncId);try{verifyPosted(group.candidate,await d.snapshot(api),l,group);return {action:'existing',id:group.candidate.cardTransaction.id,backup:prior.backup,verified:true}}finally{await api.shutdown()}}
  let {api}=await d.connect(BUDGETS[p.currency].syncId),before,plan,dir;
  try{
    before=await d.snapshot(api);before.dashboards=await d.readDashboard(api);plan=classifyMixedNote(p,before,l);if(!commit)return {...plan,candidate:p};assert.equal(plan.planHash,d.expectedPlan,'Plan digest changed');
    dir=await d.backup(api,p.currency,before);await d.json(dir+'/mixed-note-amendment.json',{candidate:p,plan});await api.sync();const current=await d.snapshot(api);current.dashboards=await d.readDashboard(api);equal(current,before,'Budget changed before write');l=await d.requireRun();assert.equal(classifyMixedNote(p,current,l).planHash,d.expectedPlan,'Plan digest changed');
    const g=l.mixedUberCashComponents[p.receipt];l.mixedUberCashNoteAmendments??={};l.mixedUberCashNoteAmendments[p.receipt]={status:'pending',candidate:p,planHash:d.expectedPlan,groupPlanHash:g.planHash,walletId:g.id,oldNotes:plan.oldNotes,newNotes:plan.newNotes,backup:dir};await d.save(l);await d.requireRun();await api.updateTransaction(plan.id,{notes:plan.newNotes});await api.sync();
  }finally{await api.shutdown()}
  ({api}=await d.connect(BUDGETS[p.currency].syncId));try{
    const after=await d.snapshot(api);after.dashboards=await d.readDashboard(api);const expected={...before,transactions:before.transactions.map(t=>t.id===plan.id?{...t,notes:plan.newNotes}:t)};equal(after,expected,'Unrelated budget state changed');
    l=await d.requireRun();const a=l.mixedUberCashNoteAmendments?.[p.receipt];assert.equal(a?.status,'pending');equal(a.candidate,p,'Pending candidate changed');const completed={...a,status:'complete',verifiedAt:new Date().toISOString()};const check=structuredClone(l);check.mixedUberCashNoteAmendments[p.receipt]=completed;verifyPosted(check.mixedUberCashComponents[p.receipt].candidate,after,check,check.mixedUberCashComponents[p.receipt]);await d.json(dir+'/after.json',after);l.mixedUberCashNoteAmendments[p.receipt]=completed;await d.save(l);return {...plan,verified:true,backup:dir};
  }finally{await api.shutdown()}
}

function verifyUnrelated(c,before,after) {
  for(const key of ['accounts','payees','categories','rules','schedules','dashboards'])equal(after[key],before[key],`Unrelated ${key} changed`);
  assert.equal(after.transactions.length,before.transactions.length+1,'Unexpected transaction count');
  const map=new Map(after.transactions.map(x=>[x.id,x]));assert.equal(map.size,after.transactions.length,'Duplicate transaction ID');
  for(const row of before.transactions)equal(map.get(row.id),row,'Existing transaction changed');
  equal(Object.keys(after.balances).sort(),Object.keys(before.balances).sort(),'Balance accounts changed');
  for(const [id,balance] of Object.entries(before.balances))assert.equal(after.balances[id],balance+(id===c.wallet?c.amount:0),'Unexpected balance change');
}

export async function recordMixedComponent(c,commit,d) {
  assert.equal(c.currency,'CLP');if(commit)assert(/^[a-f0-9]{64}$/.test(d.expectedPlan??''),'Exact plan digest required');
  let ledger=commit?await d.requireRun():await d.readState();assert(!hasPendingMixedComponent(ledger),'Pending mixed Uber Cash component requires investigation');
  const prior=ledger.mixedUberCashComponents?.[c.receipt];
  if(prior){
    assert(prior.status==='complete'&&prior.planHash===d.expectedPlan&&prior.backup&&prior.verifiedAt,'Incomplete audit or different plan');equal(prior.candidate,c,'Completed candidate differs');
    const {api}=await d.connect(BUDGETS[c.currency].syncId);try{const current=await d.snapshot(api);verifyPosted(c,current,ledger,prior);return {action:'existing',id:prior.id,backup:prior.backup,verified:true}}finally{await api.shutdown()}
  }
  let {api}=await d.connect(BUDGETS[c.currency].syncId),before,plan,dir;
  try{
    before=await d.snapshot(api);before.dashboards=await d.readDashboard(api);plan=classifyMixedComponent(c,before,ledger);if(!commit)return {...plan,candidate:c};
    assert.equal(plan.planHash,d.expectedPlan,'Plan digest changed');dir=await d.backup(api,c.currency,before);await d.json(dir+'/mixed-uber-component.json',{candidate:c,plan});
    await api.sync();const current=await d.snapshot(api);current.dashboards=await d.readDashboard(api);equal(current,before,'Budget changed before write');ledger=await d.requireRun();assert.equal(classifyMixedComponent(c,current,ledger).planHash,d.expectedPlan,'Plan digest changed');
    ledger.mixedUberCashComponents??={};assert(!ledger.mixedUberCashComponents[c.receipt],'Audit already exists');ledger.mixedUberCashComponents[c.receipt]={status:'pending',candidate:c,planHash:d.expectedPlan,backup:dir};await d.save(ledger);await d.requireRun();
    await api.addTransactions(c.wallet,[{date:c.cardTransaction.date,amount:c.amount,payee:c.cardTransaction.payee,category:c.cardTransaction.category,notes:note(c),imported_id:source(c),cleared:false}],{runTransfers:false,learnCategories:false});await api.sync();
  }finally{await api.shutdown()}
  ({api}=await d.connect(BUDGETS[c.currency].syncId));try{
    const after=await d.snapshot(api);after.dashboards=await d.readDashboard(api);ledger=await d.requireRun();const a=ledger.mixedUberCashComponents?.[c.receipt];assert.equal(a?.status,'pending');equal(a.candidate,c,'Pending candidate changed');
    const id=verifyPosted(c,after,ledger,a);verifyUnrelated(c,before,after);await d.json(dir+'/after.json',after);ledger=await d.requireRun();assert.equal(ledger.mixedUberCashComponents?.[c.receipt]?.status,'pending');ledger.mixedUberCashComponents[c.receipt]={...a,id,status:'complete',verifiedAt:new Date().toISOString()};await d.save(ledger);return {...plan,id,backup:dir,verified:true};
  }finally{await api.shutdown()}
}
