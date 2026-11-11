import assert from 'node:assert/strict';
import {BUDGETS} from './actual-daily-policy.mjs';
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const eq=(a,b,m)=>assert.deepEqual(canon(a),canon(b),m);
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const corrected=p=>({...structuredClone(p.oldParent),date:p.newDate,subtransactions:p.oldParent.subtransactions.map(c=>({...structuredClone(c),date:p.newDate}))});
export function classifySplitDate(p,s,ledger){
 assert(p&&p.historicalSplitDateCorrection===true,'Expected split date correction');
 eq(Object.keys(p).sort(),['currency','evidence','historicalSplitDateCorrection','newDate','oldParent','preserveCleared','purchaseMessageId','statementFileId'].sort(),'Unexpected candidate fields');
 assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported currency');
 assert(typeof p.purchaseMessageId==='string'&&/^[a-f0-9]+$/.test(p.purchaseMessageId),'Invalid purchase message');
 assert(typeof p.statementFileId==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(p.statementFileId),'Invalid statement');
 assert(typeof p.evidence==='string'&&p.evidence.trim().length>=30,'Missing evidence');
 const old=p.oldParent;assert(old&&typeof old.id==='string'&&old.account&&validDate(old.date)&&validDate(p.newDate),'Invalid split identity or date');
 const difference=Math.abs(Date.parse(old.date+'T12:00:00Z')-Date.parse(p.newDate+'T12:00:00Z'))/86400000;
 assert(old.date.slice(0,7)===p.newDate.slice(0,7)&&difference>=1&&difference<=7,'Date must differ by at most seven days in the same month');
 assert(old.is_parent===true&&old.is_child===false&&!old.parent_id&&!old.transfer_id&&!old.schedule&&!old.imported_id&&old.reconciled===false&&typeof p.preserveCleared==='boolean'&&old.cleared===p.preserveCleared,'Split status must be explicitly preserved and unreconciled');
 assert(Number.isSafeInteger(old.amount)&&old.amount<0&&Array.isArray(old.subtransactions)&&old.subtransactions.length>=2,'Invalid split amount or children');
 assert.equal(old.subtransactions.reduce((n,c)=>n+c.amount,0),old.amount,'Split total mismatch');
 const ids=new Set([old.id]);
 for(const c of old.subtransactions){assert(c&&c.id&&!ids.has(c.id)&&c.is_child===true&&!c.is_parent&&c.parent_id===old.id&&c.account===old.account&&c.date===old.date&&Number.isSafeInteger(c.amount)&&c.amount<0&&c.category&&!c.transfer_id&&!c.schedule&&c.reconciled===false&&c.cleared===p.preserveCleared,'Invalid split child');ids.add(c.id)}
 assert(s.accounts.some(a=>a.id===old.account&&!a.closed&&!a.offbudget),'Account unavailable');
 for(const r of Object.values(ledger.records??{}))assert(!ids.has(r.transactionId),'Split belongs to ledger');
 for(const r of Object.values(ledger.cashflows??{}))assert(![r.id,r.counterpartId,r.transactionId].some(id=>ids.has(id)),'Split belongs to ledger');
 const targets=s.transactions.filter(t=>t.id===old.id);assert.equal(targets.length,1,'Split absent or duplicated');
 const target=targets[0],audit=ledger.historicalSplitDateCorrections?.[old.id];
 if(audit?.status==='pending')throw Error('Pending split date correction requires investigation');
 if(target.date===p.newDate){assert(audit?.status==='complete','Changed date without completed audit');eq(audit.candidate,p,'Audit candidate differs');eq(target,corrected(p),'Corrected split differs');return {action:'existing',id:old.id,oldDate:old.date,newDate:p.newDate}}
 assert(!audit,'Existing audit conflicts');eq(target,old,'Split identity changed');
 assert(!s.transactions.some(t=>t.id!==old.id&&t.account===old.account&&t.date===p.newDate&&t.amount===old.amount),'Possible duplicate at destination date');
 return {action:'amend-date',id:old.id,oldDate:old.date,newDate:p.newDate};
}
export async function correctSplitDate(p,commit,d){
 assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported currency');let ledger=commit?await d.requireRun():await d.readState();let {api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir;
 try{
  before=await d.snapshot(api);action=classifySplitDate(p,before,ledger);if(!commit)return {...action,candidate:p};
  if(action.action==='existing')return {...action,verified:true,backup:ledger.historicalSplitDateCorrections[p.oldParent.id].backup};
  dir=await d.backup(api,p.currency,before);await d.json(dir+'/split-date-correction.json',{candidate:p});await api.sync();eq(await d.snapshot(api),before,'Budget changed before correction');
  ledger=await d.requireRun();classifySplitDate(p,before,ledger);ledger.historicalSplitDateCorrections??={};ledger.historicalSplitDateCorrections[p.oldParent.id]={status:'pending',candidate:p,backup:dir};await d.save(ledger);
  await api.updateTransaction(p.oldParent.id,{date:p.newDate});let ready=false;
  for(let i=0;i<30;i++){const target=(await d.snapshot(api)).transactions.find(t=>t.id===p.oldParent.id);if(target?.date===p.newDate){eq(target,corrected(p),'Split changed unexpectedly');ready=true;break}await new Promise(resolve=>setTimeout(resolve,200))}
  assert(ready,'Split date update incomplete; inspect source and backup');await api.sync();
 }finally{await api.shutdown()}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));try{
  const after=await d.snapshot(api),byId=new Map(after.transactions.map(t=>[t.id,t]));assert.equal(after.transactions.length,before.transactions.length,'Transaction count changed');assert.equal(byId.size,after.transactions.length,'Duplicate transaction IDs');
  for(const t of before.transactions)eq(byId.get(t.id),t.id===p.oldParent.id?corrected(p):t,'Transaction changed unexpectedly');
  for(const k of Object.keys(before).filter(k=>k!=='transactions'))eq(after[k],before[k],`Unrelated ${k} changed`);
  await d.json(dir+'/after.json',after);ledger=await d.requireRun();const audit=ledger.historicalSplitDateCorrections?.[p.oldParent.id];assert.equal(audit?.status,'pending');eq(audit.candidate,p,'Pending audit differs');audit.status='complete';audit.verifiedAt=new Date().toISOString();await d.save(ledger);
  assert.equal(classifySplitDate(p,after,ledger).action,'existing');return {...action,verified:true,backup:dir};
 }finally{await api.shutdown()}
}
