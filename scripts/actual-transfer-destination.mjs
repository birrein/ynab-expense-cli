import assert from 'node:assert/strict';
import { BUDGETS } from './actual-daily-policy.mjs';
const fields=new Set(['transferDestinationAmendment','currency','originId','legId','downstreamId','downstreamLegId','originAccount','oldDestination','newDestination','date','amount','evidence','sourceIds']);
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const equal=(a,b,m)=>assert.deepEqual(canon(a),canon(b),m);
export function classifyTransferDestination(p,s,ledger){
 assert.equal(p.transferDestinationAmendment,true,'Expected transfer destination amendment');for(const k of Object.keys(p))assert(fields.has(k),`Unexpected field ${k}`);
 assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported budget');for(const k of ['originId','legId','downstreamId','downstreamLegId','originAccount','oldDestination','newDestination','date','evidence'])assert(typeof p[k]==='string'&&p[k].trim(),`Missing ${k}`);
 assert(/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&!Number.isNaN(Date.parse(p.date))&&new Date(p.date+'T12:00:00Z').toISOString().slice(0,10)===p.date,'Invalid date');
 assert(Number.isSafeInteger(p.amount)&&p.amount<0,'Invalid amount');assert.equal(new Set([p.originAccount,p.oldDestination,p.newDestination]).size,3,'Distinct accounts required');assert.equal(new Set([p.originId,p.legId,p.downstreamId,p.downstreamLegId]).size,4,'Distinct transactions required');
 assert(Array.isArray(p.sourceIds)&&p.sourceIds.length>=2&&new Set(p.sourceIds).size===p.sourceIds.length&&p.sourceIds.every(x=>typeof x==='string'&&/^[a-f0-9]+$/.test(x)),'Bank evidence source IDs required');
 for(const id of [p.originAccount,p.oldDestination,p.newDestination])assert(s.accounts.some(a=>a.id===id&&!a.closed&&!a.offbudget),'Account unavailable');
 const payee=id=>{const matches=s.payees.filter(x=>x.transfer_acct===id);assert.equal(matches.length,1,'Transfer payee unavailable or ambiguous');return matches[0].id};
 const [pa,pb,pc]=[p.originAccount,p.oldDestination,p.newDestination].map(payee);
 const get=id=>{let ts=s.transactions.filter(t=>t.id===id);assert.equal(ts.length,1,'Transaction missing or ambiguous');return ts[0]};const o=get(p.originId),l=get(p.legId),d=get(p.downstreamId),dl=get(p.downstreamLegId);
 for(const t of [o,l,d,dl]){assert(!t.is_parent&&!t.is_child&&!t.parent_id&&!t.subtransactions?.length&&!t.reconciled,'Only unreconciled simple transfers');assert.equal(t.category??null,null,'Transfer category mismatch');assert.equal(t.date,p.date,'Transfer date mismatch');}
 for(const t of [o,l]){assert.equal(t.imported_id??null,null,'Only historical unimported transfers supported');assert.equal(t.notes??null,null,'Historical transfer notes must be empty');}
 for(const x of Object.values(ledger.records??{}))assert(![p.originId,p.legId].includes(x.transactionId),'Transaction belongs to source ledger');
 for(const x of Object.values(ledger.cashflows??{}))assert(![p.originId,p.legId].includes(x.id)&&![p.originId,p.legId].includes(x.counterpartId),'Transfer belongs to cashflow ledger');
 assert.equal(o.account,p.originAccount);assert.equal(o.amount,p.amount);assert.equal(o.transfer_id,l.id);assert.equal(l.transfer_id,o.id);assert.equal(l.amount,-p.amount);assert.equal(l.payee,pa);
 assert.equal(d.account,p.newDestination);assert.equal(d.payee,pb);assert.equal(d.amount,p.amount);assert.equal(d.transfer_id,dl.id);assert.equal(dl.account,p.oldDestination);assert.equal(dl.payee,pc);assert.equal(dl.amount,-p.amount);assert.equal(dl.transfer_id,d.id);
 const before=o.payee===pb&&l.account===p.oldDestination,after=o.payee===pc&&l.account===p.newDestination;assert(before||after,'Transfer destination or payee mismatch');
 assert(!s.transactions.some(t=>t.id!==l.id&&t.account===p.newDestination&&t.date===p.date&&t.amount===-p.amount),'Possible duplicate destination credit');
 return {action:after?'existing':'change-destination',id:o.id,legId:l.id,oldDestination:p.oldDestination,newDestination:p.newDestination,newPayee:pc};
}
export async function correctTransferDestination(p,commit,d){
 assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported budget');let ledger=commit?await d.requireRun():await d.readState(),{api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir=null;
 try{before=await d.snapshot(api);action=classifyTransferDestination(p,before,ledger);if(!commit)return {...action,candidate:p};
  if(action.action!=='existing'){dir=await d.backup(api,p.currency,before);await d.json(dir+'/transfer-destination-amendment.json',{candidate:p});await api.sync();equal(await d.snapshot(api),before,'Budget changed before transfer correction');classifyTransferDestination(p,before,await d.requireRun());await api.updateTransaction(p.originId,{payee:action.newPayee});await api.sync();}
 }finally{await api.shutdown();}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));
 try{const after=await d.snapshot(api),lease=await d.requireRun();assert.equal(classifyTransferDestination(p,after,lease).action,'existing','Corrected transfer did not verify');
  const expected={...before,transactions:before.transactions.map(t=>t.id===p.originId?{...t,payee:action.newPayee}:t.id===p.legId?{...t,account:p.newDestination}:t),balances:{...before.balances}};
  if(action.action!=='existing'){expected.balances[p.oldDestination]+=p.amount;expected.balances[p.newDestination]-=p.amount;}
  const {transactions:afterTransactions,...afterRest}=after,{transactions:expectedTransactions,...expectedRest}=expected;equal(afterRest,expectedRest,'Unrelated budget data or balances changed');assert.equal(afterTransactions.length,expectedTransactions.length,'Transaction count changed');const byId=new Map(afterTransactions.map(t=>[t.id,t]));assert.equal(byId.size,afterTransactions.length,'Duplicate transaction IDs');for(const t of expectedTransactions)equal(byId.get(t.id),t,'Unrelated transaction changed '+t.id);if(dir)await d.json(dir+'/after.json',after);
  lease.historicalTransferAmendments??={};const h=lease.historicalTransferAmendments[p.originId]??=[];if(!h.some(x=>x.legId===p.legId&&x.oldDestination===p.oldDestination&&x.newDestination===p.newDestination))h.push({legId:p.legId,oldDestination:p.oldDestination,newDestination:p.newDestination,sourceIds:p.sourceIds,evidence:p.evidence,verifiedAt:new Date().toISOString(),backup:dir,recovered:!dir});lease.historicalTransferAmendments[p.originId]=h;await d.save(lease);return {...action,verified:true,backup:dir};
 }finally{await api.shutdown();}
}

const retirementFields=new Set(['historicalTransferRetirement','currency','originId','legId','originAccount','destination','date','amount','driveFileIds','evidence']);
export function classifyTransferRetirement(p,s,ledger){
 assert.equal(p.historicalTransferRetirement,true,'Expected historical transfer retirement');
 for(const k of Object.keys(p))assert(retirementFields.has(k),`Unexpected field ${k}`);
 assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported budget');
 for(const k of ['originId','legId','originAccount','destination','date','evidence'])assert(typeof p[k]==='string'&&p[k].trim(),`Missing ${k}`);
 assert(/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&!Number.isNaN(Date.parse(p.date))&&new Date(p.date+'T12:00:00Z').toISOString().slice(0,10)===p.date,'Invalid date');
 assert(Number.isSafeInteger(p.amount)&&p.amount<0,'Invalid amount');assert.notEqual(p.originId,p.legId);assert.notEqual(p.originAccount,p.destination);
 assert(Array.isArray(p.driveFileIds)&&p.driveFileIds.length===2&&new Set(p.driveFileIds).size===2&&p.driveFileIds.every(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(x)),'Two distinct verified statement IDs required');
 for(const id of [p.originAccount,p.destination])assert(s.accounts.some(a=>a.id===id&&!a.closed&&!a.offbudget),'Account unavailable');
 const legs=s.transactions.filter(t=>[p.originId,p.legId].includes(t.id));
 if(!legs.length){const audit=ledger.historicalTransferRetirements?.[p.originId];assert(audit,'Missing pair without completed audit');equal(audit.candidate,p,'Retirement audit mismatch');return {action:'existing',id:p.originId,legId:p.legId};}
 assert.equal(legs.length,2,'Transfer pair missing or ambiguous');
 const o=legs.find(t=>t.id===p.originId),l=legs.find(t=>t.id===p.legId);assert(o&&l,'Transfer pair missing');
 for(const t of [o,l]){assert(!t.is_parent&&!t.is_child&&!t.parent_id&&!t.subtransactions?.length&&!t.reconciled&&!t.schedule,'Only unreconciled unscheduled simple transfers');assert.equal(t.category??null,null);assert.equal(t.imported_id??null,null);assert.equal(t.notes??null,null);assert.equal(t.date,p.date);}
 for(const x of Object.values(ledger.records??{}))assert(![p.originId,p.legId].includes(x.transactionId),'Transaction belongs to source ledger');
 for(const x of Object.values(ledger.cashflows??{}))assert(![p.originId,p.legId].includes(x.id)&&![p.originId,p.legId].includes(x.counterpartId),'Transaction belongs to cashflow ledger');
 const payee=id=>{const a=s.payees.filter(x=>x.transfer_acct===id);assert.equal(a.length,1,'Transfer payee unavailable or ambiguous');return a[0].id};
 assert.equal(o.account,p.originAccount);assert.equal(o.amount,p.amount);assert.equal(o.payee,payee(p.destination));assert.equal(o.transfer_id,l.id);
 assert.equal(l.account,p.destination);assert.equal(l.amount,-p.amount);assert.equal(l.payee,payee(p.originAccount));assert.equal(l.transfer_id,o.id);
 return {action:'retire',id:o.id,legId:l.id};
}
export async function retireHistoricalTransfer(p,commit,d){
 assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported budget');let ledger=commit?await d.requireRun():await d.readState(),{api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir=null;
 try{
  before=await d.snapshot(api);action=classifyTransferRetirement(p,before,ledger);if(!commit)return {...action,candidate:p};
  if(action.action==='existing')return {...action,verified:true,backup:ledger.historicalTransferRetirements[p.originId].backup};
  dir=await d.backup(api,p.currency,before);await d.json(dir+'/historical-transfer-retirement.json',{candidate:p});
  await api.sync();equal(await d.snapshot(api),before,'Budget changed before transfer retirement');classifyTransferRetirement(p,before,await d.requireRun());
  await api.deleteTransaction(p.originId);await api.deleteTransaction(p.legId);await api.sync();
 }finally{await api.shutdown();}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));
 try{
  const after=await d.snapshot(api);assert(!after.transactions.some(t=>[p.originId,p.legId].includes(t.id)),'Both transfer legs must be absent after deletion');
  const expected={...before,transactions:before.transactions.filter(t=>![p.originId,p.legId].includes(t.id)),balances:{...before.balances}};
  expected.balances[p.originAccount]-=p.amount;expected.balances[p.destination]+=p.amount;
  const {transactions:actualTransactions,...actualRest}=after,{transactions:expectedTransactions,...expectedRest}=expected;
  equal(actualRest,expectedRest,'Unrelated budget data or balances changed');assert.equal(actualTransactions.length,expectedTransactions.length,'Unexpected transaction count');
  const byId=new Map(actualTransactions.map(t=>[t.id,t]));assert.equal(byId.size,actualTransactions.length,'Duplicate transaction IDs');for(const t of expectedTransactions)equal(byId.get(t.id),t,'Unrelated transaction changed '+t.id);
  await d.json(dir+'/after.json',after);ledger=await d.requireRun();ledger.historicalTransferRetirements??={};ledger.historicalTransferRetirements[p.originId]={candidate:p,legId:p.legId,backup:dir,verifiedAt:new Date().toISOString()};await d.save(ledger);
  return {...action,verified:true,backup:dir};
 }finally{await api.shutdown();}
}
