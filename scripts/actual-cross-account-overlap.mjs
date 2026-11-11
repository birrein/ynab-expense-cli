import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BUDGETS} from './actual-daily-policy.mjs';

const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const equal=(a,b,msg)=>assert.deepEqual(canon(a),canon(b),msg);
const digest=v=>createHash('sha256').update(JSON.stringify(canon(v))).digest('hex');
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;

export function classifyCrossAccountOverlap(p,s,ledger){
 equal(Object.keys(p).sort(),['crossAccountRefundOverlap','currency','migrationHash','gross','net','refundAmount','refundDate','purchaseReference','refundReference','orderId','statementFileId','messageIds','evidence'].sort(),'Unexpected candidate fields');
 assert.equal(p.crossAccountRefundOverlap,true);assert.equal(p.currency,'CLP');assert(Object.hasOwn(BUDGETS,p.currency));assert(/^[a-f0-9]{64}$/.test(p.migrationHash));
 assert(p.gross&&p.net&&p.gross.id!==p.net.id&&p.gross.account!==p.net.account,'Distinct records and accounts required');
 assert(Number.isSafeInteger(p.gross.amount)&&p.gross.amount<0&&Number.isSafeInteger(p.net.amount)&&p.net.amount<0&&Number.isSafeInteger(p.refundAmount)&&p.refundAmount>0&&p.gross.amount+p.refundAmount===p.net.amount,'Gross, refund and net mismatch');
 assert([p.gross.amount,p.net.amount,p.refundAmount].every(v=>v%100===0),'CLP requires whole pesos');
 assert(validDate(p.gross.date)&&validDate(p.net.date)&&validDate(p.refundDate)&&p.gross.date<=p.net.date&&p.gross.date<=p.refundDate,'Invalid dates');
 for(const k of ['purchaseReference','refundReference','orderId','statementFileId','evidence'])assert(typeof p[k]==='string'&&p[k].trim().length>=3,'Missing '+k);
 assert(p.purchaseReference!==p.refundReference);assert(/^[A-Za-z0-9_-]{8,}$/.test(p.statementFileId));assert(Array.isArray(p.messageIds)&&p.messageIds.length===3&&new Set(p.messageIds).size===3&&p.messageIds.every(x=>/^[a-f0-9]{8,}$/.test(x)),'Three distinct message IDs required');
 assert(p.gross.category&&p.gross.category===p.net.category,'Category mismatch');assert(p.gross.imported_id&&!p.net.imported_id,'Unexpected provenance');
 for(const t of [p.gross,p.net]){assert(s.accounts.some(a=>a.id===t.account&&!a.closed&&!a.offbudget),'Unavailable account');assert(!t.reconciled&&!t.transfer_id&&!t.is_parent&&!t.is_child&&!t.parent_id&&!t.schedule&&!t.starting_balance_flag&&!t.subtransactions?.length,'Unsupported transaction');const rows=s.transactions.filter(x=>x.id===t.id);assert.equal(rows.length,1,'Transaction unavailable');equal(rows[0],t,'Transaction changed');}
 assert((p.gross.notes??'').includes(p.orderId)&&(p.net.notes??'').includes(p.orderId),'Order identity absent');assert((p.gross.notes??'').includes(p.purchaseReference)&&(p.gross.notes??'').includes(p.refundReference),'Bank references absent');
 const migration=ledger.historicalAccountMigrations?.[p.migrationHash];assert(migration?.status==='complete'&&migration.planHash===p.migrationHash&&migration.backup&&migration.verifiedAt,'Completed migration required');assert.equal(migration.candidate?.sourceAccount,p.gross.account);assert.equal(migration.candidate?.destinationAccount,p.net.account);const matches=(migration.candidate.excluded??[]).filter(x=>x.id===p.gross.id);assert.equal(matches.length,1);equal(matches[0],p.gross,'Excluded snapshot differs');
 for(const x of Object.values(ledger.records??{}))assert(![p.gross.id,p.net.id].includes(x.transactionId),'Record belongs to ledger');for(const x of Object.values(ledger.cashflows??{}))assert(![p.gross.id,p.net.id].some(id=>[x.id,x.counterpartId].includes(id)),'Record belongs to cashflow ledger');
 for(const t of s.transactions){if([p.gross.id,p.net.id].includes(t.id))continue;assert(!(t.notes??'').includes(p.refundReference),'Refund already represented');assert(!(t.amount===p.refundAmount&&[p.gross.account,p.net.account].includes(t.account)&&Math.abs(Date.parse(t.date)-Date.parse(p.refundDate))<=3*86400000),'Possible separately represented refund');assert(t.imported_id!==p.gross.imported_id,'Gross source already represented');}
 for(const [key,value] of Object.entries(ledger)){if(['historicalAccountMigrations','activeRun'].includes(key))continue;const serialized=JSON.stringify(value);for(const id of [p.gross.id,p.net.id,p.gross.imported_id])assert(!serialized?.includes(id),'Unexpected ledger reference to transaction or source');}
 const stable=structuredClone(ledger);delete stable.activeRun;const planHash=digest({candidate:p,snapshot:s,ledger:stable});return {action:'retire',grossId:p.gross.id,netId:p.net.id,balanceDelta:-p.gross.amount,planHash};
}
export function verifyResolvedMigrationException(excluded,migrationHash,s,ledger){
 const candidates=Object.entries(ledger.crossAccountRefundOverlaps??{}).filter(([,a])=>a?.candidate?.gross?.id===excluded.id);
 assert.equal(candidates.length,1,'Missing or duplicate retirement audit');const [key,a]=candidates[0];
 assert(a.status==='complete'&&a.planHash===key&&a.backup&&a.verifiedAt,'Retirement audit incomplete');
 assert.equal(a.candidate.migrationHash,migrationHash,'Retirement migration mismatch');equal(a.candidate.gross,excluded,'Retired snapshot differs');const c=a.candidate;assert(c.crossAccountRefundOverlap===true&&c.currency==='CLP'&&typeof c.evidence==='string'&&c.evidence.trim().length>=3,'Retirement evidence missing');assert(typeof c.statementFileId==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(c.statementFileId)&&Array.isArray(c.messageIds)&&c.messageIds.length===3&&new Set(c.messageIds).size===3&&c.messageIds.every(x=>/^[a-f0-9]{8,}$/.test(x)),'Retirement sources missing');assert(Number.isSafeInteger(c.refundAmount)&&c.refundAmount>0&&c.gross.amount+c.refundAmount===c.net.amount,'Retirement refund mismatch');assert(validDate(c.refundDate)&&typeof c.purchaseReference==='string'&&typeof c.refundReference==='string'&&c.purchaseReference!==c.refundReference&&typeof c.orderId==='string'&&c.orderId.length>=3,'Retirement references missing');
 assert(!s.transactions.some(t=>t.id===excluded.id),'Retired gross reappeared');const net=s.transactions.filter(t=>t.id===a.candidate.net.id);assert.equal(net.length,1,'Retained net missing');equal(net[0],a.candidate.net,'Retained net changed');
 return true;
}
export async function retireCrossAccountOverlap(p,commit,d){
 assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported currency');if(commit)assert(/^[a-f0-9]{64}$/.test(d.expectedPlan??''),'Exact plan digest required');
 let ledger=commit?await d.requireRun():await d.readState();assert(!Object.values(ledger.crossAccountRefundOverlaps??{}).some(a=>a?.status==='pending'),'Pending cross-account refund overlap requires investigation');
 const existing=commit?ledger.crossAccountRefundOverlaps?.[d.expectedPlan]:null;
 if(existing){equal(existing.candidate,p,'Completed retirement candidate differs');const {api}=await d.connect(BUDGETS[p.currency].syncId);try{const now=await d.snapshot(api);verifyResolvedMigrationException(p.gross,p.migrationHash,now,ledger);return {action:'existing',verified:true,backup:existing.backup,planHash:d.expectedPlan};}finally{await api.shutdown();}}
 let {api}=await d.connect(BUDGETS[p.currency].syncId),before,plan,dir;
 try{
  before=await d.snapshot(api);before.dashboards=await d.readDashboard(api);plan=classifyCrossAccountOverlap(p,before,ledger);if(!commit)return {...plan,candidate:p};assert.equal(plan.planHash,d.expectedPlan,'Plan digest changed');
  dir=await d.backup(api,p.currency,before);await d.json(dir+'/cross-account-overlap.json',{candidate:p,plan});await api.sync();const current=await d.snapshot(api);current.dashboards=await d.readDashboard(api);equal(current,before,'Budget changed before retirement');
  ledger=await d.requireRun();assert(!Object.values(ledger.crossAccountRefundOverlaps??{}).some(a=>a?.status==='pending'),'Pending overlap');assert.equal(classifyCrossAccountOverlap(p,current,ledger).planHash,d.expectedPlan,'Plan digest changed');
  ledger.crossAccountRefundOverlaps??={};assert(!ledger.crossAccountRefundOverlaps[d.expectedPlan],'Existing audit');ledger.crossAccountRefundOverlaps[d.expectedPlan]={status:'pending',candidate:p,planHash:d.expectedPlan,backup:dir};await d.save(ledger);
  await api.deleteTransaction(p.gross.id);await api.sync();
 }finally{await api.shutdown();}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));try{
  const after=await d.snapshot(api);after.dashboards=await d.readDashboard(api);const expected=structuredClone(before);expected.transactions=expected.transactions.filter(t=>t.id!==p.gross.id);expected.balances[p.gross.account]-=p.gross.amount;
  const {transactions:actualRows,...actualRest}=after,{transactions:expectedRows,...expectedRest}=expected;equal(actualRest,expectedRest,'Unrelated budget state changed');assert.equal(actualRows.length,expectedRows.length,'Transaction count changed');const map=new Map(actualRows.map(t=>[t.id,t]));assert.equal(map.size,actualRows.length,'Duplicate transaction ID');for(const t of expectedRows)equal(map.get(t.id),t,'Unrelated transaction changed');
  await d.json(dir+'/after.json',after);ledger=await d.requireRun();const audit=ledger.crossAccountRefundOverlaps?.[d.expectedPlan];assert.equal(audit?.status,'pending');equal(audit.candidate,p,'Pending candidate changed');ledger.crossAccountRefundOverlaps[d.expectedPlan]={...audit,status:'complete',verifiedAt:new Date().toISOString()};await d.save(ledger);return {...plan,verified:true,backup:dir};
 }finally{await api.shutdown();}
}
