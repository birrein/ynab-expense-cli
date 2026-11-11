import assert from 'node:assert/strict';
import {BUDGETS} from './actual-daily-policy.mjs';
const canon=x=>Array.isArray(x)?x.map(canon):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canon(x[k])])):x;
const eq=(a,b,m)=>assert.deepEqual(canon(a),canon(b),m);
const valid=d=>typeof d==='string'&&/^\d{4}-\d\d-\d\d$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const month=d=>Number(d.slice(0,4))*12+Number(d.slice(5,7));
const target=row=>({...row.oldTransaction,date:row.newDate});
export function classifySeriesDates(p,s,l){
 eq(Object.keys(p).sort(),['historicalInstallmentSeriesDateCorrection','currency','seriesLabel','purchaseMessageId','preserveCleared','evidence','installments'].sort());
 assert.equal(p.historicalInstallmentSeriesDateCorrection,true);assert(BUDGETS[p.currency]);assert(typeof p.seriesLabel==='string'&&p.seriesLabel.trim().length>=8);
 assert(typeof p.evidence==='string'&&p.evidence.trim().length>=30);assert(/^[a-f0-9]{16}$/i.test(p.purchaseMessageId));assert.equal(p.preserveCleared,true);
 const rows=p.installments;assert(Array.isArray(rows)&&rows.length>=3&&rows.length<=24);const ids=new Set(),docs=new Set(),newDates=new Set();let first;
 for(let i=0;i<rows.length;i++){
  const r=rows[i],t=r.oldTransaction;eq(Object.keys(r).sort(),['number','oldTransaction','newDate','statementFileId'].sort());assert.equal(r.number,i+1);
  assert(t?.id&&!ids.has(t.id)&&valid(t.date)&&valid(r.newDate)&&r.newDate!==t.date);ids.add(t.id);assert(!newDates.has(r.newDate));newDates.add(r.newDate);
  assert(/^[A-Za-z0-9_-]{8,}$/.test(r.statementFileId)&&!docs.has(r.statementFileId));docs.add(r.statementFileId);
  assert(typeof t.notes==='string'&&t.notes.toLowerCase().includes(p.seriesLabel.toLowerCase())&&/#cuotas\b/i.test(t.notes));assert(new RegExp(`(?<!\\d)0?${i+1}/0?${rows.length}(?!\\d)`).test(t.notes));
  assert(Number.isSafeInteger(t.amount)&&t.amount<0&&!t.is_parent&&!t.is_child&&!t.parent_id&&!t.transfer_id&&!t.schedule&&t.reconciled===false&&!t.imported_id&&!t.subtransactions?.length&&typeof t.cleared==='boolean');
  if(!first)first=t;else {assert.equal(t.account,first.account);assert.equal(t.payee,first.payee);assert.equal(t.category,first.category);assert.equal(month(r.newDate),month(rows[i-1].newDate)+1);assert(t.date>rows[i-1].oldTransaction.date)}
 }
 assert(s.accounts.some(a=>a.id===first.account&&!a.closed&&!a.offbudget));assert(s.payees.some(a=>a.id===first.payee&&!a.transfer_acct));assert(s.categories.some(a=>a.id===first.category&&!a.hidden&&!a.is_income));
 for(const r of Object.values(l.records??{}))assert(!ids.has(r.transactionId),'Series belongs to source ledger');for(const r of Object.values(l.cashflows??{}))assert(!ids.has(r.id)&&!ids.has(r.counterpartId),'Series belongs to cashflow ledger');
 const audit=l.historicalInstallmentSeriesDateCorrections?.[p.purchaseMessageId];if(audit?.status==='pending')throw Error('Pending series correction requires manual investigation');
 const found=rows.map(r=>{let x=s.transactions.filter(t=>t.id===r.oldTransaction.id);assert.equal(x.length,1,'Missing series item');return x[0]});
 if(audit){assert.equal(audit.status,'complete');eq(audit.candidate,p,'Audit conflict');rows.forEach((r,i)=>eq(found[i],target(r),'Completed series changed'));return{action:'existing',ids:[...ids]}}
 rows.forEach((r,i)=>eq(found[i],r.oldTransaction,'Series snapshot changed'));
 for(const r of rows)assert(!s.transactions.some(t=>!ids.has(t.id)&&t.account===first.account&&t.payee===first.payee&&t.date===r.newDate&&typeof t.notes==='string'&&t.notes.toLowerCase().includes(p.seriesLabel.toLowerCase())&&new RegExp(`(?<!\\d)0?${r.number}/0?${rows.length}(?!\\d)`).test(t.notes)),'Conflicting target installment');
 return{action:'amend-series-dates',items:rows.map(r=>({id:r.oldTransaction.id,from:r.oldTransaction.date,to:r.newDate,amount:r.oldTransaction.amount,cleared:r.oldTransaction.cleared}))};
}
export async function amendSeriesDates(p,commit,d){
 assert(BUDGETS[p.currency]);let ledger=commit?await d.requireRun():await d.readState(),{api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir;
 try{before=await d.snapshot(api);action=classifySeriesDates(p,before,ledger);if(!commit)return{...action,candidate:p};if(action.action==='existing')return{...action,verified:true,backup:ledger.historicalInstallmentSeriesDateCorrections[p.purchaseMessageId].backup};
  dir=await d.backup(api,p.currency,before);await d.json(dir+'/installment-series-dates.json',{candidate:p});await api.sync();eq(await d.snapshot(api),before,'Budget changed before correction');ledger=await d.requireRun();classifySeriesDates(p,before,ledger);ledger.historicalInstallmentSeriesDateCorrections??={};ledger.historicalInstallmentSeriesDateCorrections[p.purchaseMessageId]={status:'pending',candidate:p,backup:dir};await d.save(ledger);
  for(const row of [...p.installments].reverse()){
   await api.updateTransaction(row.oldTransaction.id,{date:row.newDate});let ready=false;
   for(let i=0;i<30;i++){const snap=await d.snapshot(api),actual=snap.transactions.find(t=>t.id===row.oldTransaction.id);if(actual?.date===row.newDate){eq(actual,target(row),'Transaction changed unexpectedly');ready=true;break}await new Promise(resolve=>setTimeout(resolve,200))}assert(ready,'Date update incomplete; inspect backup and pending audit');
  }await api.sync();
 }finally{await api.shutdown()}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));try{const after=await d.snapshot(api),byId=new Map(after.transactions.map(t=>[t.id,t]));assert.equal(after.transactions.length,before.transactions.length);assert.equal(byId.size,after.transactions.length);const changes=new Map(p.installments.map(r=>[r.oldTransaction.id,target(r)]));for(const t of before.transactions)eq(byId.get(t.id),changes.get(t.id)??t,'Unexpected transaction change');for(const k of Object.keys(before).filter(k=>k!=='transactions'))eq(after[k],before[k],'Unexpected nontransaction change');await d.json(dir+'/after.json',after);ledger=await d.requireRun();const audit=ledger.historicalInstallmentSeriesDateCorrections?.[p.purchaseMessageId];assert.equal(audit?.status,'pending');eq(audit.candidate,p);audit.status='complete';audit.verifiedAt=new Date().toISOString();await d.save(ledger);return{...action,verified:true,backup:dir};}finally{await api.shutdown()}
}

// A pending audit can be finalized only after an independent full-budget comparison.
// This path deliberately never calls an Actual transaction mutation API.
export async function recoverSeriesAudit(c,commit,d){
 eq(Object.keys(c).sort(),['recoverInstallmentSeriesAudit','currency','purchaseMessageId','originalCandidate'].sort());
 assert.equal(c.recoverInstallmentSeriesAudit,true);assert(BUDGETS[c.currency]);
 const p=c.originalCandidate;assert.equal(p?.currency,c.currency);assert.equal(p?.purchaseMessageId,c.purchaseMessageId);
 let ledger=commit?await d.requireRun():await d.readState();
 const audit=ledger.historicalInstallmentSeriesDateCorrections?.[c.purchaseMessageId];
 assert(audit&&['pending','complete'].includes(audit.status),'Matching series audit missing');eq(audit.candidate,p,'Original candidate differs from audit');
 const {before,candidate}=await d.readSeriesBackup(audit.backup,c.currency);eq(candidate,p,'Backup candidate differs from audit');
 const initialLedger=structuredClone(ledger);delete initialLedger.historicalInstallmentSeriesDateCorrections[c.purchaseMessageId];
 assert.equal(classifySeriesDates(p,before,initialLedger).action,'amend-series-dates','Backup is not the original series');
 const {api}=await d.connect(BUDGETS[c.currency].syncId);let after;
 try{after=await d.snapshot(api)}finally{await api.shutdown()}
 const prior=new Map(before.transactions.map(t=>[t.id,t])),live=new Map(after.transactions.map(t=>[t.id,t]));
 assert.equal(prior.size,before.transactions.length,'Duplicate original transaction IDs');assert.equal(live.size,after.transactions.length,'Duplicate current transaction IDs');assert.equal(live.size,prior.size,'Transaction count changed');
 const expected=new Map(p.installments.map(r=>[r.oldTransaction.id,target(r)]));
 for(const [id,t] of prior){assert(live.has(id),'Transaction missing');eq(live.get(id),expected.get(id)??t,'Unexpected transaction change')}
 eq(Object.keys(after).sort(),Object.keys(before).sort(),'Budget structure changed');
 for(const k of Object.keys(before).filter(k=>k!=='transactions'))eq(after[k],before[k],'Unexpected nontransaction change');
 if(audit.status==='complete'){assert(audit.recovered===true&&audit.verifiedAt,'Audit was not recovered');return{action:'existing',verified:true,backup:audit.backup}}
 if(!commit)return{action:'recover-series-audit',purchaseMessageId:c.purchaseMessageId,ids:p.installments.map(r=>r.oldTransaction.id),backup:audit.backup};
 await d.writeRecoverySnapshot(audit.backup,after);
 ledger=await d.requireRun();eq(ledger.historicalInstallmentSeriesDateCorrections?.[c.purchaseMessageId],audit,'Pending audit changed during recovery');
 ledger.historicalInstallmentSeriesDateCorrections[c.purchaseMessageId]={...audit,status:'complete',verifiedAt:new Date().toISOString(),recovered:true};await d.save(ledger);
 return{action:'recovered-series-audit',verified:true,ids:p.installments.map(r=>r.oldTransaction.id),backup:audit.backup};
}
