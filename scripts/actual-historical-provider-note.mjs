import assert from 'node:assert/strict';
import {BUDGETS} from './actual-daily-policy.mjs';

const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const equal=(a,b,msg)=>assert.deepEqual(canonical(a),canonical(b),msg);
const protectedText=t=>/https?:\/\/|www\.|#|\b(?:source|refundOf)=|[\r\n]/i.test(t);
const corrected=p=>({...structuredClone(p.oldTransaction),notes:p.oldTransaction.notes.replace(p.oldText,p.newText)});

export function classifyHistoricalProviderNote(p,s,ledger){
 equal(Object.keys(p).sort(),['historicalProviderNote','currency','oldTransaction','oldText','newText','statementId','providerReceiptId','evidence'].sort(),'Unexpected candidate fields');
 assert.equal(p.historicalProviderNote,true,'Historical note operation required');
 assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported currency');
 for(const id of [p.statementId,p.providerReceiptId])assert(typeof id==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(id),'Invalid Drive evidence ID');
 assert.notEqual(p.statementId,p.providerReceiptId,'Distinct evidence required');
 assert(typeof p.evidence==='string'&&p.evidence.trim().length>=30,'Evidence required');
 const old=p.oldTransaction;
 assert(old&&typeof old.id==='string'&&typeof old.account==='string'&&typeof old.notes==='string'&&old.notes.trim(),'Historical expense and note required');
 assert(typeof p.oldText==='string'&&p.oldText.length>0&&typeof p.newText==='string'&&p.newText.length>0&&p.oldText!==p.newText,'Distinct nonempty text required');
 assert(!protectedText(old.notes)&&!protectedText(p.oldText)&&!protectedText(p.newText),'Protected note content');
 assert.equal(old.notes.split(p.oldText).length,2,'Old text must occur exactly once');
 assert(Number.isSafeInteger(old.amount)&&old.amount<0&&old.category&&old.payee&&typeof old.cleared==='boolean','Categorized historical expense required');
 assert(typeof old.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(old.date)&&Number.isFinite(Date.parse(old.date+'T12:00:00Z'))&&new Date(old.date+'T12:00:00Z').toISOString().slice(0,10)===old.date,'Invalid date');
 assert(!old.is_parent&&!old.is_child&&!old.parent_id&&!old.transfer_id&&!old.subtransactions?.length&&!old.reconciled&&!old.schedule&&!old.imported_id&&!old.starting_balance_flag&&!old.tombstone,'Unsupported historical transaction');
 assert(s.accounts.some(a=>a.id===old.account&&!a.closed&&!a.offbudget),'Account unavailable');
 assert(s.categories.some(c=>c.id===old.category),'Category unavailable');
 assert(s.payees.some(x=>x.id===old.payee&&!x.transfer_acct),'Payee unavailable');
 for(const x of Object.values(ledger.records??{}))assert(x.transactionId!==old.id,'Transaction belongs to source ledger');
 for(const x of Object.values(ledger.cashflows??{}))assert(x.id!==old.id&&x.counterpartId!==old.id,'Transaction belongs to cashflow ledger');
 const matches=s.transactions.filter(t=>t.id===old.id);assert.equal(matches.length,1,'Transaction is not unique');
 const audit=ledger.historicalProviderNotes?.[old.id];
 if(audit){equal(audit.candidate,p,'Audit conflict');equal(matches[0],corrected(p),'Audited transaction differs');return {action:'existing',id:old.id,oldNotes:old.notes,newNotes:corrected(p).notes};}
 equal(matches[0],old,'Transaction identity mismatch or unaudited previous write');
 return {action:'amend-note',id:old.id,oldNotes:old.notes,newNotes:corrected(p).notes};
}

export async function amendHistoricalProviderNote(p,commit,d){
 assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported currency');
 let ledger=commit?await d.requireRun():await d.readState(),{api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir;
 try{
  before=await d.snapshot(api);action=classifyHistoricalProviderNote(p,before,ledger);
  if(!commit)return {...action,candidate:p};
  if(action.action==='existing')return {...action,verified:true,backup:ledger.historicalProviderNotes[p.oldTransaction.id].backup};
  dir=await d.backup(api,p.currency,before);await d.json(dir+'/historical-provider-note.json',{candidate:p});
  await api.sync();const latest=await d.snapshot(api);equal(latest,before,'Budget changed before note correction');classifyHistoricalProviderNote(p,latest,await d.requireRun());
  await api.updateTransaction(p.oldTransaction.id,{notes:corrected(p).notes});await api.sync();
 }finally{await api.shutdown();}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));
 try{
  const after=await d.snapshot(api),expected=structuredClone(before);expected.transactions=expected.transactions.map(t=>t.id===p.oldTransaction.id?corrected(p):t);
  const {transactions:at,...ar}=after,{transactions:bt,...br}=expected;equal(ar,br,'Unrelated state or balances changed');assert.equal(at.length,bt.length,'Transaction count changed');
  const byId=new Map(at.map(t=>[t.id,t]));assert.equal(byId.size,at.length,'Duplicate transaction ID');for(const t of bt)equal(byId.get(t.id),t,'Transaction differs');
  await d.json(dir+'/after.json',after);ledger=await d.requireRun();ledger.historicalProviderNotes??={};assert(!ledger.historicalProviderNotes[p.oldTransaction.id],'Audit appeared concurrently');ledger.historicalProviderNotes[p.oldTransaction.id]={candidate:p,backup:dir,verifiedAt:new Date().toISOString()};await d.save(ledger);
  return {...action,verified:true,backup:dir};
 }finally{await api.shutdown();}
}
