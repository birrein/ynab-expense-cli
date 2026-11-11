import {verifyResolvedMigrationException} from './actual-cross-account-overlap.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BUDGETS} from './actual-daily-policy.mjs';

const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const equal=(a,b,msg)=>assert.deepEqual(canonical(a),canonical(b),msg);
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const validDate=d=>typeof d==='string'&&/^\d{4}-\d\d-\d\d$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const ledgerStable=l=>{const x=structuredClone(l);delete x.activeRun;return x};

function buildPlan(c,s,ledger){
 equal(Object.keys(c).sort(),['historicalPartialAccountMigration','currency','sourceAccount','destinationAccount','opening','excluded','evidence'].sort(),'Unexpected candidate fields');
 assert.equal(c.historicalPartialAccountMigration,true,'Migration operation required');assert(Object.hasOwn(BUDGETS,c.currency),'Unsupported currency');
 assert(typeof c.sourceAccount==='string'&&typeof c.destinationAccount==='string'&&c.sourceAccount!==c.destinationAccount,'Distinct accounts required');
 for(const id of [c.sourceAccount,c.destinationAccount])assert(s.accounts.some(a=>a.id===id&&!a.closed&&!a.offbudget),'Account unavailable');
 assert(typeof c.evidence==='string'&&c.evidence.trim().length>=30,'Evidence required');
 assert(c.opening&&typeof c.opening.id==='string'&&c.opening.account===c.destinationAccount&&c.opening.imported_payee==='Starting Balance'&&Number.isSafeInteger(c.opening.amount)&&c.opening.amount<0&&validDate(c.opening.date)&&!c.opening.payee&&!c.opening.imported_id&&!c.opening.transfer_id&&!c.opening.is_parent&&!c.opening.is_child&&!c.opening.reconciled&&!c.opening.schedule&&!c.opening.subtransactions?.length,'Unsupported opening');
 assert(s.categories.some(x=>x.id===c.opening.category&&x.name==='Starting Balances'&&x.is_income),'Opening category unavailable');
 const byId=new Map(s.transactions.map(t=>[t.id,t]));assert.equal(byId.size,s.transactions.length,'Duplicate transaction ID');equal(byId.get(c.opening.id),c.opening,'Opening changed');
 assert(Array.isArray(c.excluded)&&c.excluded.length>0,'Explicit exceptions required');const excludedIds=new Set(c.excluded.map(t=>t?.id));assert.equal(excludedIds.size,c.excluded.length,'Duplicate exclusions');
 for(const t of c.excluded){assert(t&&t.account===c.sourceAccount&&byId.has(t.id),'Excluded source missing');equal(byId.get(t.id),t,'Excluded transaction changed');assert(!t.transfer_id&&!t.is_parent&&!t.is_child&&!t.parent_id&&!t.schedule&&!t.tombstone,'Unsupported excluded record');}
 const source=s.transactions.filter(t=>t.account===c.sourceAccount&&!t.tombstone);assert(source.length>c.excluded.length,'Nothing to move');const moved=source.filter(t=>!excludedIds.has(t.id)),movedIds=new Set(moved.map(t=>t.id));
 for(const t of moved){assert(Number.isSafeInteger(t.amount)&&validDate(t.date)&&t.date<c.opening.date&&!t.is_parent&&!t.is_child&&!t.parent_id&&!t.schedule&&!t.reconciled&&!t.subtransactions?.length,'Unsupported historical movement');}
 assert.equal(moved.reduce((a,t)=>a+t.amount,0),c.opening.amount,'Historical amount differs from opening');
 const oldPayees=s.payees.filter(p=>p.transfer_acct===c.sourceAccount),newPayees=s.payees.filter(p=>p.transfer_acct===c.destinationAccount);assert.equal(oldPayees.length,1,'Ambiguous historical transfer payee');assert.equal(newPayees.length,1,'Ambiguous target transfer payee');
 assert(Array.isArray(s.dashboards),'Dashboard snapshot required');const config=JSON.stringify({rules:s.rules,schedules:s.schedules,dashboards:s.dashboards});for(const id of [c.sourceAccount,oldPayees[0].id])assert(!config.includes(id),'Historical account referenced by configuration');
 const updates=moved.map(t=>({id:t.id,account:c.destinationAccount}));for(const t of moved.filter(t=>t.transfer_id)){
  const peer=byId.get(t.transfer_id);assert(peer&&peer.transfer_id===t.id&&peer.amount===-t.amount&&peer.account!==c.sourceAccount&&peer.account!==c.destinationAccount&&peer.payee===oldPayees[0].id&&!peer.is_parent&&!peer.is_child&&!peer.parent_id&&!peer.schedule&&!peer.tombstone,'Invalid reciprocal transfer');updates.push({id:peer.id,payee:newPayees[0].id});
 }
 const updateMap=new Map(updates.map(u=>[u.id,u]));assert.equal(updateMap.size,updates.length,'Overlapping transfer updates');
 const flatten=rows=>rows.flatMap(t=>[t,...flatten(t.subtransactions??[])]);for(const t of flatten(s.transactions))if(t.payee===oldPayees[0].id)assert(updateMap.has(t.id)&&t.transfer_id&&movedIds.has(t.transfer_id),'Unmatched historical payee reference');
 for(const t of moved)for(const other of s.transactions){if(other.account!==c.destinationAccount||other.id===c.opening.id||other.tombstone||other.is_child||!t.amount||!validDate(other.date))continue;assert(!(other.amount===t.amount&&Math.abs(Date.parse(other.date)-Date.parse(t.date))<=3*86400000),'Possible overlapping transaction');}
 const legacyLineMappings=[];const allowed=new Set();
 for(const [sourceId,record] of Object.entries(ledger.cashflows??{})){
  const d=record?.distinctLegacyLineMatch;if(!d||![d.priorTransaction?.id,d.priorCounterpart?.id].some(id=>updateMap.has(id)))continue;
  assert(record.status==='registered'&&record.verifiedAt&&d.priorTransaction&&d.priorCounterpart,'Unverified legacy audit');
  equal(byId.get(d.priorTransaction.id),d.priorTransaction,'Legacy prior transaction changed');equal(byId.get(d.priorCounterpart.id),d.priorCounterpart,'Legacy prior counterpart changed');
  assert(d.priorCounterpart.account===c.sourceAccount&&movedIds.has(d.priorCounterpart.id)&&updateMap.has(d.priorTransaction.id),'Unsupported legacy mapping');
  const newPrior={...d.priorTransaction,...updateMap.get(d.priorTransaction.id)},newCounterpart={...d.priorCounterpart,...updateMap.get(d.priorCounterpart.id)};
  legacyLineMappings.push({sourceId,oldPrior:d.priorTransaction,oldCounterpart:d.priorCounterpart,newPrior,newCounterpart});allowed.add(sourceId);
 }
 const touched=new Set([c.opening.id,...updates.map(x=>x.id)]);
 function inspect(v,path=[]){if(typeof v==='string'){assert(!touched.has(v),'Unknown ledger reference');return}if(Array.isArray(v)){for(let i=0;i<v.length;i++)inspect(v[i],[...path,i]);return}if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){assert(!touched.has(k),'Unknown ledger key reference');if(path.length===2&&path[0]==='cashflows'&&allowed.has(path[1])&&k==='distinctLegacyLineMatch')continue;inspect(x,[...path,k]);}}
 inspect(ledgerStable(ledger));
 const expected=s.transactions.filter(t=>t.id!==c.opening.id).map(t=>({...t,...(updateMap.get(t.id)||{})}));const expectedById=new Map(expected.map(t=>[t.id,t]));
 for(const t of expected.filter(t=>updateMap.has(t.id)&&t.transfer_id)){const peer=expectedById.get(t.transfer_id);assert(peer&&peer.transfer_id===t.id&&peer.amount===-t.amount&&peer.account!==t.account,'Transformed transfer is invalid');assert.equal(s.payees.find(p=>p.id===t.payee)?.transfer_acct,peer.account,'Transformed payee invalid');}
 const balance=(ts,id,date)=>ts.filter(t=>t.account===id&&!t.is_child&&!t.tombstone&&t.date<=date).reduce((a,t)=>a+t.amount,0);
 for(const date of new Set(s.transactions.filter(t=>t.account===c.destinationAccount&&t.date>=c.opening.date).map(t=>t.date)))assert.equal(balance(expected,c.destinationAccount,date),balance(s.transactions,c.destinationAccount,date),'Target date balance changed');
 const summary={action:'migrate',sourceAccount:c.sourceAccount,destinationAccount:c.destinationAccount,movedCount:moved.length,updatedCount:updates.length,retainedCount:c.excluded.length,openingId:c.opening.id,sourceDelta:-c.opening.amount,destinationDelta:0,legacyLineMappings};
 const planHash=hash({candidate:c,snapshot:s,ledger:ledgerStable(ledger),updates,summary});return {summary:{...summary,planHash},updates,expected,legacyLineMappings};
}

export function classifyPartialAccountMigration(c,s,ledger){return buildPlan(c,s,ledger).summary;}
export function hasPendingPartialMigration(ledger){return Object.values(ledger.historicalAccountMigrations??{}).some(a=>a?.status==='pending');}
export async function migratePartialAccount(c,commit,d){
 assert(Object.hasOwn(BUDGETS,c.currency),'Unsupported currency');if(commit)assert(typeof d.expectedPlan==='string'&&/^[a-f0-9]{64}$/.test(d.expectedPlan),'Exact plan digest required');
 let ledger=commit?await d.requireRun():await d.readState();assert(!hasPendingPartialMigration(ledger),'Pending migration requires investigation');
 const completed=commit?ledger.historicalAccountMigrations?.[d.expectedPlan]:null;
 if(completed){
  assert.equal(completed.status,'complete','Pending migration requires investigation');equal(completed.candidate,c,'Completed migration candidate differs');assert(completed.backup&&completed.verifiedAt&&Array.isArray(completed.updatedTransactions),'Incomplete migration audit');
  const {api}=await d.connect(BUDGETS[c.currency].syncId);try{const now=await d.snapshot(api),map=new Map(now.transactions.map(t=>[t.id,t]));assert(!map.has(c.opening.id),'Retired opening reappeared');for(const t of completed.updatedTransactions)equal(map.get(t.id),t,'Migrated transaction changed');for(const t of c.excluded){if(map.has(t.id))equal(map.get(t.id),t,'Excluded transaction changed');else verifyResolvedMigrationException(t,d.expectedPlan,now,ledger);}assert(now.accounts.some(a=>a.id===c.sourceAccount&&!a.closed),'Historical account unavailable');return {action:'existing',verified:true,backup:completed.backup,planHash:d.expectedPlan};}finally{await api.shutdown();}
 }
 let {api,rt}=await d.connect(BUDGETS[c.currency].syncId),before,plan,dir;
 try{
  before=await d.snapshot(api);before.dashboards=await d.readDashboard(api);plan=buildPlan(c,before,ledger);if(!commit)return {...plan.summary,candidate:c};assert.equal(plan.summary.planHash,d.expectedPlan,'Plan digest changed');
  dir=await d.backup(api,c.currency,before);await d.json(dir+'/partial-account-migration.json',{candidate:c,plan:plan.summary,updates:plan.updates});
  await api.sync();const latest=await d.snapshot(api);latest.dashboards=await d.readDashboard(api);equal(latest,before,'Budget changed before migration');ledger=await d.requireRun();assert(!hasPendingPartialMigration(ledger),'Pending migration requires investigation');assert.equal(buildPlan(c,latest,ledger).summary.planHash,d.expectedPlan,'Ledger or plan changed');
  const updateIds=new Set(plan.updates.map(u=>u.id));ledger.historicalAccountMigrations??={};assert(!ledger.historicalAccountMigrations[d.expectedPlan],'Migration audit already exists');
  ledger.historicalAccountMigrations[d.expectedPlan]={status:'pending',candidate:c,backup:dir,sourceAccount:c.sourceAccount,destinationAccount:c.destinationAccount,legacyLineMappings:plan.legacyLineMappings,updatedTransactions:plan.expected.filter(t=>updateIds.has(t.id)),planHash:d.expectedPlan};await d.save(ledger);
  for(let i=0;i<plan.updates.length;i+=100){const lease=await d.requireRun();assert.equal(lease.historicalAccountMigrations?.[d.expectedPlan]?.status,'pending','Migration audit lost');await rt.send('transactions-batch-update',{added:[],updated:plan.updates.slice(i,i+100),deleted:i+100>=plan.updates.length?[{id:c.opening.id}]:[],runTransfers:false,learnCategories:false});await api.sync();}
 }finally{await api.shutdown();}
 ({api}=await d.connect(BUDGETS[c.currency].syncId));
 try{
  const after=await d.snapshot(api);after.dashboards=await d.readDashboard(api);const expected=structuredClone(before);expected.transactions=plan.expected;expected.balances[c.sourceAccount]+=plan.summary.sourceDelta;
  const {transactions:at,...ar}=after,{transactions:bt,...br}=expected;equal(ar,br,'Other state or balances changed');assert.equal(at.length,bt.length,'Transaction count changed');const byId=new Map(at.map(t=>[t.id,t]));assert.equal(byId.size,at.length,'Duplicate transaction ID');for(const t of bt)equal(byId.get(t.id),t,'Transaction changed unexpectedly');
  await d.json(dir+'/after.json',after);ledger=await d.requireRun();const audit=ledger.historicalAccountMigrations?.[d.expectedPlan];assert.equal(audit?.status,'pending','Pending audit missing');equal(audit.candidate,c,'Pending audit changed');ledger.historicalAccountMigrations[d.expectedPlan]={...audit,status:'complete',verifiedAt:new Date().toISOString()};await d.save(ledger);
  return {...plan.summary,verified:true,backup:dir};
 }finally{await api.shutdown();}
}
