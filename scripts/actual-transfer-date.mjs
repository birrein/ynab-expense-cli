import assert from 'node:assert/strict';
import {classifyPostingDates} from './actual-transfer-posting-dates.mjs';
import {BUDGETS} from './actual-daily-policy.mjs';

const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const eq=(a,b,m)=>assert.deepEqual(canon(a),canon(b),m);
const keys=new Set(['historicalTransferDateCorrection','currency','oldOrigin','oldDestination','newDate','receiptId','statementFileId','postingDateEvidence','sameMonthEvidence','evidence']);
const validDate=d=>typeof d==='string'&&/^\d{4}-\d\d-\d\d$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const month=d=>Number(d.slice(0,4))*12+Number(d.slice(5,7));

export function classifyTransferDate(p,s,ledger){
 assert.equal(p.historicalTransferDateCorrection,true);for(const k of Object.keys(p))assert(keys.has(k),'Unexpected field '+k);assert(Object.hasOwn(BUDGETS,p.currency));const a=p.oldOrigin,b=p.oldDestination;assert(a&&b&&a.id&&b.id&&a.id!==b.id&&a.account!==b.account);assert(validDate(a.date)&&validDate(p.newDate)&&a.date===b.date,'Invalid date');
 assert(!(Object.hasOwn(p,'postingDateEvidence')&&Object.hasOwn(p,'sameMonthEvidence')),'Conflicting evidence modes');
 if(Object.hasOwn(p,'sameMonthEvidence')){
  const e=p.sameMonthEvidence;assert(e&&typeof e==='object'&&!Array.isArray(e),'Same-month evidence required');eq(Object.keys(e).sort(),['receiptDate','statementDate'].sort(),'Unexpected same-month evidence fields');
  assert.equal(e.receiptDate,p.newDate,'Receipt date must match operation date');assert.equal(e.statementDate,p.newDate,'Statement date must match operation date');
  const delta=Date.parse(a.date)-Date.parse(p.newDate);assert(a.date.slice(0,7)===p.newDate.slice(0,7)&&delta>=2*86400000&&delta<=4*86400000,'Invalid same-month transfer delay');
 }else if(Object.hasOwn(p,'postingDateEvidence')){
  const e=p.postingDateEvidence;assert(e&&typeof e==='object'&&!Array.isArray(e),'Posting evidence required');eq(Object.keys(e).sort(),['originStatementId','postingDate'].sort(),'Unexpected posting evidence fields');
  assert(typeof e.originStatementId==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(e.originStatementId)&&e.originStatementId!==p.statementFileId,'Distinct origin statement required');assert.equal(e.postingDate,a.date,'Posting date must match existing date');
  const delta=Date.parse(a.date)-Date.parse(p.newDate);assert(month(a.date)-month(p.newDate)===1&&delta>=86400000&&delta<=4*86400000,'Invalid cross-month operation date');
 }else assert(a.date.slice(0,7)===p.newDate.slice(0,7)&&Math.abs(Date.parse(a.date)-Date.parse(p.newDate))===86400000,'Invalid date');
 assert(Number.isSafeInteger(a.amount)&&a.amount<0&&b.amount===-a.amount&&a.transfer_id===b.id&&b.transfer_id===a.id);assert(typeof p.receiptId==='string'&&/^[a-f0-9]{16}$/.test(p.receiptId));assert(typeof p.statementFileId==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(p.statementFileId));assert(typeof p.evidence==='string'&&p.evidence.trim());
 for(const t of [a,b]){assert(!t.category&&!t.imported_id&&!t.reconciled&&!t.is_parent&&!t.is_child&&!t.parent_id&&!t.schedule&&!t.subtransactions?.length&&!t.starting_balance_flag&&!t.tombstone,'Invalid historical leg');assert(s.accounts.some(x=>x.id===t.account&&!x.closed&&!x.offbudget),'Account unavailable')}
 assert.equal(a.notes??null,b.notes??null,'Conflicting transfer notes');for(const [t,target] of [[a,b.account],[b,a.account]]){const ps=s.payees.filter(x=>x.transfer_acct===target);assert.equal(ps.length,1);assert.equal(t.payee,ps[0].id)}
 const audit=ledger.transferDateCorrections?.[a.id];if(audit){assert.equal(audit.status,'complete','Pending correction requires investigation');eq(audit.candidate,p,'Audit mismatch');const later=ledger.transferPostingDateCorrections?.[a.id];if(later){assert.equal(later.status,'complete','Pending later audit requires investigation');assert.equal(later.candidate?.priorTransferDateCorrection,true,'Later audit not linked');assert.equal(classifyPostingDates(later.candidate,s,ledger).action,'existing','Later audit not verified')}else for(const old of [a,b])eq(s.transactions.find(t=>t.id===old.id),{...old,date:p.newDate},'Corrected leg differs');return{action:'existing'}}
 for(const old of [a,b]){const matches=s.transactions.filter(t=>t.id===old.id);assert.equal(matches.length,1);eq(matches[0],old,'Historical snapshot changed')}
 for(const r of Object.values(ledger.records??{}))assert(![a.id,b.id].includes(r.transactionId),'Ledger ownership conflict');for(const r of Object.values(ledger.cashflows??{}))assert(![a.id,b.id].includes(r.id)&&![a.id,b.id].includes(r.counterpartId)&&!(r.sourceIds??[]).includes(p.receiptId),'Ledger source conflict');assert(!ledger.records?.[p.receiptId],'Receipt already owned');
 for(const t of s.transactions){if([a.id,b.id].includes(t.id))continue;assert(!String(t.notes??'').includes('https://mail.google.com/mail/u/0/#all/'+p.receiptId),'Receipt linked elsewhere');assert(!(Math.abs(Date.parse(t.date)-Date.parse(p.newDate))<=4*86400000&&((t.account===a.account&&t.amount===a.amount)||(t.account===b.account&&t.amount===b.amount))),'Possible duplicate transfer')}
 return{action:'correct'};
}

export async function correctTransferDate(p,commit,ctx){
 assert(Object.hasOwn(BUDGETS,p.currency));let ledger=commit?await ctx.requireRun():await ctx.readState(),{api}=await ctx.connect(BUDGETS[p.currency].syncId),before,dir,action;
 try{before=await ctx.snapshot(api);action=classifyTransferDate(p,before,ledger);if(!commit)return{...action,candidate:p};if(action.action==='existing')return{...action,verified:true,backup:ledger.transferDateCorrections[p.oldOrigin.id].backup};dir=await ctx.backup(api,p.currency,before);await ctx.json(dir+'/transfer-date-correction.json',{candidate:p});await api.sync();eq(await ctx.snapshot(api),before,'Budget changed before correction');ledger=await ctx.requireRun();classifyTransferDate(p,before,ledger);ledger.transferDateCorrections??={};ledger.transferDateCorrections[p.oldOrigin.id]={status:'pending',candidate:p,backup:dir};await ctx.save(ledger);
 for(const old of [p.oldOrigin,p.oldDestination]){await api.updateTransaction(old.id,{date:p.newDate});let done=false;for(let i=0;i<50;i++){const s=await ctx.snapshot(api);if(s.transactions.find(t=>t.id===old.id)?.date===p.newDate){done=true;break}await new Promise(r=>setTimeout(r,100))}assert(done,'Update incomplete: inspect audit and backup')};await api.sync();
 }finally{await api.shutdown()}
 ({api}=await ctx.connect(BUDGETS[p.currency].syncId));try{const after=await ctx.snapshot(api),expected={...before,transactions:before.transactions.map(t=>[p.oldOrigin.id,p.oldDestination.id].includes(t.id)?{...t,date:p.newDate}:t)};const {transactions:at,...ar}=after,{transactions:bt,...br}=expected;eq(ar,br,'Other state or balances changed');assert.equal(at.length,bt.length);const byId=new Map(at.map(t=>[t.id,t]));assert.equal(byId.size,at.length);for(const t of bt)eq(byId.get(t.id),t,'Transaction changed unexpectedly');await ctx.json(dir+'/after.json',after);ledger=await ctx.requireRun();const audit=ledger.transferDateCorrections?.[p.oldOrigin.id];assert.equal(audit?.status,'pending');eq(audit.candidate,p);ledger.transferDateCorrections[p.oldOrigin.id]={...audit,status:'complete',verifiedAt:new Date().toISOString()};await ctx.save(ledger);return{...action,verified:true,backup:dir};}finally{await api.shutdown()}
}
