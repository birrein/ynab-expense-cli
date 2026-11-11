import assert from 'node:assert/strict';
import { BUDGETS } from './actual-daily-policy.mjs';

const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const eq=(a,b,m)=>assert.deepEqual(canon(a),canon(b),m);
const keys=['historicalTransferOriginCorrection','currency','oldOrigin','oldDestination','newOrigin','receiptId','originStatementId','destinationStatementId','evidence'].sort();

export function classifyTransferOrigin(p,s,ledger){
 eq(Object.keys(p).sort(),keys,'Unexpected or missing field');assert.equal(p.historicalTransferOriginCorrection,true);assert(Object.hasOwn(BUDGETS,p.currency));
 const a=p.oldOrigin,b=p.oldDestination;assert(a&&b&&a.id&&b.id&&a.id!==b.id);assert.equal(new Set([a.account,b.account,p.newOrigin]).size,3,'Distinct accounts required');
 assert(/^\d{4}-\d{2}-\d{2}$/.test(a.date)&&Number.isFinite(Date.parse(a.date))&&new Date(a.date+'T12:00:00Z').toISOString().slice(0,10)===a.date&&a.date===b.date,'Invalid date');
 assert(Number.isSafeInteger(a.amount)&&a.amount<0&&b.amount===-a.amount&&a.transfer_id===b.id&&b.transfer_id===a.id,'Invalid reciprocal pair');
 assert(typeof p.receiptId==='string'&&/^[a-f0-9]{16}$/.test(p.receiptId),'Receipt ID required');for(const id of [p.originStatementId,p.destinationStatementId])assert(typeof id==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(id),'Statement ID required');assert.notEqual(p.originStatementId,p.destinationStatementId);assert(typeof p.evidence==='string'&&p.evidence.trim().length>=30,'Evidence required');
 for(const t of [a,b])assert(!t.category&&!t.imported_id&&!t.notes&&!t.reconciled&&!t.is_parent&&!t.is_child&&!t.parent_id&&!t.schedule&&!t.subtransactions?.length&&!t.starting_balance_flag&&!t.tombstone,'Invalid historical leg');
 for(const id of [a.account,b.account,p.newOrigin])assert(s.accounts.some(x=>x.id===id&&!x.closed&&!x.offbudget),'Account unavailable');
 const payee=id=>{const found=s.payees.filter(x=>x.transfer_acct===id);assert.equal(found.length,1,'Ambiguous transfer payee');return found[0].id};
 assert.equal(a.payee,payee(b.account));assert.equal(b.payee,payee(a.account));const newPayee=payee(p.newOrigin);
 const audit=ledger.transferOriginCorrections?.[a.id];if(audit){assert.equal(audit.status,'complete','Pending correction requires investigation');eq(audit.candidate,p,'Audit mismatch');eq(s.transactions.find(t=>t.id===a.id),{...a,account:p.newOrigin},'Corrected origin differs');eq(s.transactions.find(t=>t.id===b.id),{...b,payee:newPayee},'Corrected destination differs');return{action:'existing',newPayee}}
 for(const old of [a,b]){const found=s.transactions.filter(t=>t.id===old.id);assert.equal(found.length,1,'Missing or duplicate leg');eq(found[0],old,'Historical snapshot changed')}
 for(const r of Object.values(ledger.records??{}))assert(![a.id,b.id].includes(r.transactionId),'Ledger ownership conflict');assert(!ledger.records?.[p.receiptId],'Receipt already owned');
 for(const r of Object.values(ledger.cashflows??{}))assert(![a.id,b.id].includes(r.id)&&![a.id,b.id].includes(r.counterpartId)&&!(r.sourceIds??[]).includes(p.receiptId),'Ledger source conflict');
 for(const t of s.transactions){if([a.id,b.id].includes(t.id))continue;assert(!String(t.notes??'').includes('https://mail.google.com/mail/u/0/#all/'+p.receiptId),'Receipt linked elsewhere');if(!t.date)continue;const near=Math.abs(Date.parse(t.date)-Date.parse(a.date))<=4*86400000;assert(!(near&&(([a.account,p.newOrigin].includes(t.account)&&t.amount===a.amount)||(t.account===b.account&&t.amount===b.amount))),'Possible duplicate transfer')}
 return{action:'correct',newPayee};
}

export async function correctTransferOrigin(p,commit,ctx){
 assert(Object.hasOwn(BUDGETS,p.currency));let ledger=commit?await ctx.requireRun():await ctx.readState(),{api}=await ctx.connect(BUDGETS[p.currency].syncId),before,dir,action;
 try{before=await ctx.snapshot(api);action=classifyTransferOrigin(p,before,ledger);if(!commit)return{...action,candidate:p};if(action.action==='existing')return{...action,verified:true,backup:ledger.transferOriginCorrections[p.oldOrigin.id].backup};
  dir=await ctx.backup(api,p.currency,before);await ctx.json(dir+'/transfer-origin-correction.json',{candidate:p});await api.sync();eq(await ctx.snapshot(api),before,'Budget changed before correction');ledger=await ctx.requireRun();classifyTransferOrigin(p,before,ledger);ledger.transferOriginCorrections??={};ledger.transferOriginCorrections[p.oldOrigin.id]={status:'pending',candidate:p,backup:dir};await ctx.save(ledger);
  await api.updateTransaction(p.oldDestination.id,{payee:action.newPayee});let done=false;for(let i=0;i<50;i++){const s=await ctx.snapshot(api),a=s.transactions.find(t=>t.id===p.oldOrigin.id),b=s.transactions.find(t=>t.id===p.oldDestination.id);if(a?.account===p.newOrigin&&b?.payee===action.newPayee){done=true;break}await new Promise(r=>setTimeout(r,100))}assert(done,'Update incomplete: inspect pending audit and backup');await api.sync();
 }finally{await api.shutdown()}
 ({api}=await ctx.connect(BUDGETS[p.currency].syncId));try{const after=await ctx.snapshot(api),expected={...before,transactions:before.transactions.map(t=>t.id===p.oldOrigin.id?{...t,account:p.newOrigin}:t.id===p.oldDestination.id?{...t,payee:action.newPayee}:t),balances:{...before.balances}};expected.balances[p.oldOrigin.account]-=p.oldOrigin.amount;expected.balances[p.newOrigin]+=p.oldOrigin.amount;
  const {transactions:at,...ar}=after,{transactions:bt,...br}=expected;eq(ar,br,'Other state or balances changed');assert.equal(at.length,bt.length);const byId=new Map(at.map(t=>[t.id,t]));assert.equal(byId.size,at.length);for(const t of bt)eq(byId.get(t.id),t,'Transaction changed unexpectedly');await ctx.json(dir+'/after.json',after);ledger=await ctx.requireRun();const audit=ledger.transferOriginCorrections?.[p.oldOrigin.id];assert.equal(audit?.status,'pending');eq(audit.candidate,p);ledger.transferOriginCorrections[p.oldOrigin.id]={...audit,status:'complete',verifiedAt:new Date().toISOString()};await ctx.save(ledger);return{...action,verified:true,backup:dir};
 }finally{await api.shutdown()}
}
