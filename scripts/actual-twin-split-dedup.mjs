import assert from 'node:assert/strict';
import {BUDGETS} from './actual-daily-policy.mjs';
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const eq=(a,b,m)=>assert.deepEqual(canon(a),canon(b),m);
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
function hasReference(value,ids){
 if(typeof value==='string')return ids.has(value)||[...ids].some(id=>id.length>=32&&value.includes(id));
 if(Array.isArray(value))return value.some(x=>hasReference(x,ids));
 if(value&&typeof value==='object')return Object.entries(value).some(([k,v])=>ids.has(k)||hasReference(v,ids));
 return false;
}

export function classifyTwinSplitDedup(p,s,ledger){
 assert(p&&p.confirmedTwinSplitDedup===true,'Twin split operation required');
 eq(Object.keys(p).sort(),['confirmedTwinSplitDedup','currency','evidence','oldParent','retainedParent','statementFileId','userConfirmation'].sort(),'Unexpected fields');
 assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported currency');
 assert(typeof p.statementFileId==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(p.statementFileId),'Invalid statement');
 for(const key of ['userConfirmation','evidence'])assert(typeof p[key]==='string'&&p[key].trim().length>=25,'Confirmation and evidence required');
 const old=p.oldParent,keep=p.retainedParent;
 for(const t of [old,keep]){
  assert(t&&typeof t.id==='string'&&t.id&&typeof t.account==='string'&&validDate(t.date),'Invalid parent');
  assert(t.is_parent===true&&!t.is_child&&!t.parent_id&&!t.transfer_id&&!t.reconciled&&!t.cleared&&!t.schedule&&!t.imported_id&&!t.tombstone&&!t.starting_balance_flag,'Unsupported parent');
  assert(Number.isSafeInteger(t.amount)&&t.amount<0&&t.category===null,'Invalid split amount');
  assert(Array.isArray(t.subtransactions)&&t.subtransactions.length>=2,'Missing children');
  const cats=new Set(),ids=new Set();let total=0;
  for(const c of t.subtransactions){assert(c&&typeof c.id==='string'&&!ids.has(c.id)&&c.is_child===true&&c.parent_id===t.id&&c.account===t.account&&c.date===t.date&&Number.isSafeInteger(c.amount)&&c.amount<0&&typeof c.category==='string'&&c.category&&!cats.has(c.category)&&!c.transfer_id&&!c.reconciled&&!c.cleared&&!c.schedule&&!c.imported_id&&!c.tombstone&&!c.starting_balance_flag,'Invalid or ambiguous child');ids.add(c.id);cats.add(c.category);total+=c.amount;}
  assert.equal(total,t.amount,'Split total differs');
 }
 assert(old.id!==keep.id&&old.account===keep.account&&old.amount===keep.amount,'Different splits');
 const delta=Date.parse(old.date+'T12:00:00Z')-Date.parse(keep.date+'T12:00:00Z');assert(delta>=0&&delta<=86400000,'Dates differ by more than one day or retained date is later');
 assert(!/(https?:\/\/|\bsource\s*=|#[\p{L}\p{N}_])/iu.test(old.notes??''),'Old note contains source or tag');
 for(const c of old.subtransactions)assert(!/(https?:\/\/|\bsource\s*=|#[\p{L}\p{N}_])/iu.test(c.notes??''),'Old child note contains source or tag');
 const allocations=t=>t.subtransactions.map(c=>({category:c.category,amount:c.amount})).sort((a,b)=>a.category.localeCompare(b.category));
 eq(allocations(old),allocations(keep),'Split allocations differ');
 assert(s.accounts.some(a=>a.id===old.account&&!a.closed&&!a.offbudget),'Account unavailable');
 const ids=new Set([old.id,keep.id,...old.subtransactions.map(x=>x.id),...keep.subtransactions.map(x=>x.id)]);assert.equal(ids.size,2+old.subtransactions.length+keep.subtransactions.length,'Overlapping IDs');
 for(const rec of Object.values(ledger.records??{}))assert(!ids.has(rec.transactionId),'Ledger-owned split');
 for(const rec of Object.values(ledger.cashflows??{}))assert(!ids.has(rec.id)&&!ids.has(rec.counterpartId),'Ledger-owned split');
 for(const [key,value] of Object.entries(ledger)){
  const check=key==='historicalTwinSplitDeduplications'?Object.fromEntries(Object.entries(value??{}).filter(([id])=>id!==old.id)):value;
  assert(!hasReference(check,ids),'Split referenced by existing ledger or audit');
 }
 const audit=ledger.historicalTwinSplitDeduplications?.[old.id];
 if(audit?.status==='pending')throw Error('Pending twin split retirement requires investigation');
 const kept=s.transactions.filter(t=>t.id===keep.id);assert.equal(kept.length,1,'Retained split missing');eq(kept[0],keep,'Retained split changed');
 const found=s.transactions.filter(t=>t.id===old.id);
 if(audit){assert.equal(audit.status,'complete','Invalid audit status');eq(audit.candidate,p,'Audit mismatch');assert.equal(found.length,0,'Retired split present');return {action:'existing',id:old.id,retainedId:keep.id};}
 assert.equal(found.length,1,'Absent split without completed audit');eq(found[0],old,'Old split changed');
 assert(!s.transactions.some(t=>!ids.has(t.id)&&t.account===old.account&&t.is_parent&&t.amount===old.amount&&validDate(t.date)&&Math.abs(Date.parse(t.date+'T12:00:00Z')-Date.parse(keep.date+'T12:00:00Z'))<=86400000),'Third matching split');
 return {action:'retire',id:old.id,retainedId:keep.id,balanceDelta:-old.amount};
}

export async function retireTwinSplitDedup(p,commit,d){
 assert(p&&Object.hasOwn(BUDGETS,p.currency),'Unsupported currency');
 let ledger=commit?await d.requireRun():await d.readState(),{api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir;
 try{
  before=await d.snapshot(api);action=classifyTwinSplitDedup(p,before,ledger);
  if(!commit)return {...action,candidate:p};
  if(action.action==='existing')return {...action,verified:true,backup:ledger.historicalTwinSplitDeduplications[p.oldParent.id].backup};
  dir=await d.backup(api,p.currency,before);await d.json(dir+'/twin-split-dedup.json',{candidate:p});await api.sync();eq(await d.snapshot(api),before,'Budget changed before retirement');
  ledger=await d.requireRun();classifyTwinSplitDedup(p,before,ledger);ledger.historicalTwinSplitDeduplications??={};assert(!ledger.historicalTwinSplitDeduplications[p.oldParent.id],'Audit appeared concurrently');ledger.historicalTwinSplitDeduplications[p.oldParent.id]={status:'pending',candidate:p,backup:dir};await d.save(ledger);
  await d.requireRun();await api.deleteTransaction(p.oldParent.id);await api.sync();
 }finally{await api.shutdown();}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));
 try{
  const after=await d.snapshot(api),old=p.oldParent;assert(!after.transactions.some(t=>t.id===old.id),'Old split remains');
  const expected={...before,transactions:before.transactions.filter(t=>t.id!==old.id),balances:{...before.balances,[old.account]:before.balances[old.account]-old.amount}};
  const {transactions:at,...ar}=after,{transactions:bt,...br}=expected;eq(ar,br,'Unrelated state changed');assert.equal(at.length,bt.length);const byId=new Map(at.map(t=>[t.id,t]));assert.equal(byId.size,at.length);for(const t of bt)eq(byId.get(t.id),t,'Unrelated transaction changed');
  await d.json(dir+'/after.json',after);ledger=await d.requireRun();const audit=ledger.historicalTwinSplitDeduplications?.[old.id];assert.equal(audit?.status,'pending');eq(audit.candidate,p,'Pending audit changed');audit.status='complete';audit.verifiedAt=new Date().toISOString();await d.save(ledger);
  return {...action,verified:true,backup:dir};
 }finally{await api.shutdown();}
}
