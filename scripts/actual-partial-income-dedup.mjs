import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BUDGETS} from './actual-daily-policy.mjs';
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const eq=(a,b,m)=>assert.deepEqual(canon(a),canon(b),m);
export const partialIncomeHash=(p,s)=>createHash('sha256').update(JSON.stringify(canon({candidate:p,snapshot:s}))).digest('hex');
const simple=t=>!t.transfer_id&&!t.is_parent&&!t.is_child&&!t.parent_id&&!t.subtransactions?.length&&!t.reconciled&&!t.schedule&&!t.starting_balance_flag&&!t.tombstone;
const validDate=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const fields=['partialHistoricalIncomeDedup','currency','oldTransaction','components','residual','statementFileIds','evidence'];
export function pendingPartialIncomeConflict(c,l){const str=JSON.stringify(c);return Object.values(l.partialHistoricalIncomeDedups??{}).some(a=>a?.status==='pending'&&a.candidate&&[a.candidate.oldTransaction.id,...a.candidate.components.flatMap(x=>[x.transaction.id,x.transaction.imported_id])].some(v=>v&&str.includes(v)))}
export function classifyPartialIncomeDedup(p,s,l){
 eq(Object.keys(p).sort(),fields.sort(),'Unexpected fields');assert.equal(p.partialHistoricalIncomeDedup,true);assert(BUDGETS[p.currency]);
 const old=p.oldTransaction;assert(old?.id&&old.account&&validDate(old.date)&&Number.isSafeInteger(old.amount)&&old.amount>0&&simple(old),'Invalid historical aggregate');assert.equal(old.imported_id,null,'Aggregate has imported source');assert(typeof old.notes==='string'&&old.notes.trim(),'Missing historical notes');
 assert(s.accounts.some(a=>a.id===old.account&&!a.closed&&!a.offbudget),'Account unavailable');assert(Number.isSafeInteger(p.residual)&&p.residual>0&&p.residual<old.amount,'Invalid residual');
 assert(Number.isSafeInteger(s.balances?.[old.account]),'Account balance unavailable');
 assert(Array.isArray(p.statementFileIds)&&p.statementFileIds.length>=2&&new Set(p.statementFileIds).size===p.statementFileIds.length&&p.statementFileIds.every(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(x)),'Invalid statements');assert(typeof p.evidence==='string'&&p.evidence.trim().length>=40,'Missing evidence');
 assert(Array.isArray(p.components)&&p.components.length>=1&&p.components.length<=100,'Invalid components');let total=0;const ids=new Set(),sources=new Set();
 for(const x of p.components){eq(Object.keys(x).sort(),['record','transaction'],'Invalid component');const t=x.transaction,r=x.record;assert(t?.id&&t.id!==old.id&&!ids.has(t.id),'Duplicate component');ids.add(t.id);assert(typeof t.imported_id==='string'&&/^bank:[A-Za-z0-9:_-]+$/.test(t.imported_id)&&!sources.has(t.imported_id),'Invalid component source');sources.add(t.imported_id);assert(t.account===old.account&&validDate(t.date)&&t.date<=old.date&&Number.isSafeInteger(t.amount)&&t.amount>0&&simple(t),'Invalid component transaction');eq(s.transactions.filter(v=>v.id===t.id),[t],'Component snapshot mismatch');eq(l.cashflows?.[t.imported_id],r,'Component ledger changed');assert(r?.id===t.id&&r.type==='income'&&r.currency===p.currency&&r.account===t.account&&r.date===t.date&&r.amount===t.amount&&r.category===t.category&&r.status==='registered'&&typeof r.verifiedAt==='string'&&r.verifiedAt&&Array.isArray(r.driveFileIds)&&r.driveFileIds.some(id=>p.statementFileIds.includes(id)),'Component not verified');assert.equal(s.transactions.filter(v=>v.imported_id===t.imported_id).length,1,'Source not unique');total+=t.amount;assert(Number.isSafeInteger(total),'Overflow');}
 assert.equal(old.amount-total,p.residual,'Residual differs from component sum');
 const protectedIds=[old.id,...ids,...sources];
 for(const [group,map] of Object.entries(l)){
  if(!map||typeof map!=='object'||Array.isArray(map))continue;
  for(const [key,value] of Object.entries(map)){
   if(group==='partialHistoricalIncomeDedups'&&key===old.id)continue;
   if(group==='partialHistoricalIncomeDedups'&&['pending','complete'].includes(value?.status)){
    const used=[value.candidate?.oldTransaction?.id,...(value.candidate?.components??[]).flatMap(x=>[x.transaction?.id,x.transaction?.imported_id])];
    assert(!protectedIds.some(id=>used.includes(id)),'Component reserved by another adjustment');
   }else if(value?.status==='pending'){
    const encoded=JSON.stringify(value.candidate??{});assert(!protectedIds.some(id=>key===id||encoded.includes(id)),'Conflicting pending audit');
   }
  }
 }
 for(const v of Object.values(l.records??{}))assert(v?.transactionId!==old.id,'Aggregate ledger owned');for(const v of Object.values(l.cashflows??{}))assert(v?.id!==old.id&&v?.counterpartId!==old.id,'Aggregate ledger owned');
 const audit=l.partialHistoricalIncomeDedups?.[old.id];if(audit){assert.equal(audit.status,'complete','Pending adjustment requires investigation');eq(audit.candidate,p,'Candidate differs from completed audit');assert(audit.backup&&audit.verifiedAt,'Incomplete audit');}
 const target=s.transactions.filter(t=>t.id===old.id);assert.equal(target.length,1,'Aggregate missing or duplicate');eq(target[0],audit?{...old,amount:p.residual}:old,'Aggregate changed');
 return {action:audit?'existing':'adjust',id:old.id,oldAmount:old.amount,newAmount:p.residual,overlap:total};
}
export async function adjustPartialIncomeDedup(p,commit,d){
 let l=commit?await d.requireRun():await d.readState(),{api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir;
 try{before=await d.snapshot(api);action=classifyPartialIncomeDedup(p,before,l);if(!commit)return {...action,candidate:p,planHash:partialIncomeHash(p,before)};if(action.action==='existing')return {...action,verified:true,backup:l.partialHistoricalIncomeDedups[p.oldTransaction.id].backup};
 assert.equal(d.expectedPlan,partialIncomeHash(p,before),'Plan missing or changed');dir=await d.backup(api,p.currency,before);await d.json(dir+'/partial-income-dedup.json',{candidate:p});await api.sync();eq(await d.snapshot(api),before,'Budget changed before write');l=await d.requireRun();eq(classifyPartialIncomeDedup(p,before,l),action,'Candidate changed');l.partialHistoricalIncomeDedups??={};l.partialHistoricalIncomeDedups[p.oldTransaction.id]={status:'pending',candidate:p,backup:dir};await d.save(l);await d.requireRun();await api.updateTransaction(p.oldTransaction.id,{amount:p.residual});
 let ready=false;for(let i=0;i<50;i++){const now=await d.snapshot(api);if(now.transactions.find(t=>t.id===p.oldTransaction.id)?.amount===p.residual){ready=true;break}await new Promise(r=>setTimeout(r,100));}assert(ready,'Adjustment not visible; inspect pending intent and backup');await api.sync();
 }finally{await api.shutdown()}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));try{const after=await d.snapshot(api);for(const k of ['accounts','categories','payees','rules','schedules'])eq(after[k],before[k],'Unexpected '+k);assert.equal(after.transactions.length,before.transactions.length);const byId=new Map(after.transactions.map(t=>[t.id,t]));assert.equal(byId.size,after.transactions.length);for(const t of before.transactions)eq(byId.get(t.id),t.id===p.oldTransaction.id?{...t,amount:p.residual}:t,'Unexpected transaction change');eq(after.balances,{...before.balances,[p.oldTransaction.account]:before.balances[p.oldTransaction.account]-(p.oldTransaction.amount-p.residual)},'Unexpected balance change');await d.json(dir+'/after.json',after);l=await d.requireRun();eq(l.partialHistoricalIncomeDedups?.[p.oldTransaction.id],{status:'pending',candidate:p,backup:dir},'Pending intent changed');l.partialHistoricalIncomeDedups[p.oldTransaction.id]={status:'complete',candidate:p,backup:dir,verifiedAt:new Date().toISOString()};await d.save(l);return {...action,verified:true,backup:dir};}finally{await api.shutdown()}
}
