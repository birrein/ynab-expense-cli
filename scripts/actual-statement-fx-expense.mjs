import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BUDGETS } from './actual-daily-policy.mjs';

const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const eq=(a,b,m)=>assert.deepEqual(canonical(a),canonical(b),m);
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const stableLedger=l=>{const {activeRun,runs,...rest}=l;return rest};
const link=id=>`https://mail.google.com/mail/u/0/#all/${id}`;
const validDate=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const nearby=(a,b)=>Math.abs(Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))<=4*86400000;
const newNotes=p=>`${p.oldTransaction.notes}\nhttps://drive.google.com/file/d/${p.statementFileId}/view`;
export const hasPendingFxExpenseMigration=l=>Object.values(l.statementFxExpenseMigrations??{}).some(a=>a?.status==='pending');
export function migrationSourceConflict(c,l){
 for(const a of Object.values(l.statementFxExpenseMigrations??{})){
  if(a?.status!=='complete')continue;
  const p=a.candidate, encoded=JSON.stringify(c);
  const touched=p.sourceIds.some(id=>encoded.includes(id));
  const protectedIdentity=[p.oldTransaction.id,a.newId].some(id=>id&&encoded.includes(id));
  if(protectedIdentity||touched)return true;
 }
 return false;
}
function validate(p){
 eq(Object.keys(p).sort(),['statementFxExpenseMigration','oldTransaction','oldRecord','sourceId','sourceIds','usd','statementFileId','evidence',...(Object.hasOwn(p,'distinctStatementPeers')?['distinctStatementPeers']:[])].sort(),'Unexpected candidate fields');
 assert.equal(p.statementFxExpenseMigration,true);const t=p.oldTransaction,r=p.oldRecord;
 assert(t&&typeof t.id==='string'&&t.id&&typeof t.account==='string'&&typeof t.payee==='string'&&typeof t.category==='string');
 assert(validDate(t.date),'Invalid date');
 assert(Number.isSafeInteger(t.amount)&&t.amount<0&&!t.is_parent&&!t.is_child&&!t.parent_id&&!t.transfer_id&&!t.schedule&&!t.reconciled&&!t.cleared&&!t.starting_balance_flag&&!t.tombstone&&!t.subtransactions?.length,'Unsafe original transaction');
 assert(Array.isArray(p.sourceIds)&&p.sourceIds.length>0&&new Set(p.sourceIds).size===p.sourceIds.length&&p.sourceIds.includes(p.sourceId)&&p.sourceIds.every(x=>typeof x==='string'&&/^[a-f0-9]+$/.test(x)),'Invalid sources');
 assert.equal(t.imported_id,`gmail:${p.sourceId}`,'Original imported id mismatch');
 assert(typeof t.notes==='string'&&p.sourceIds.every(id=>t.notes.split('\n').filter(x=>x===link(id)).length===1),'Missing or repeated source link');
 const links=[...t.notes.matchAll(/^https:\/\/mail\.google\.com\/mail\/u\/0\/#all\/([a-f0-9]+)$/gm)].map(x=>x[1]);eq([...links].sort(),[...p.sourceIds].sort(),'Original source links differ');
 assert(r&&r.transactionId===t.id&&r.currency==='CLP'&&r.account===t.account&&r.date===t.date&&r.amount===t.amount&&r.category===t.category&&r.status==='registered'&&r.verifiedAt&&!r.refundOf&&(r.sourceType??'gmail')==='gmail','Original ledger mismatch');eq([...r.sourceIds].sort(),[...p.sourceIds].sort(),'Ledger sources differ');
 eq(Object.keys(p.usd??{}).sort(),['account','amount','payee','category'].sort(),'Invalid destination fields');
 for(const k of ['account','payee','category'])assert(typeof p.usd[k]==='string'&&p.usd[k],'Missing destination '+k);
 assert(Number.isSafeInteger(p.usd.amount)&&p.usd.amount<0,'Invalid billed amount');assert(/^[A-Za-z0-9_-]{8,}$/.test(p.statementFileId),'Invalid statement');assert(typeof p.evidence==='string'&&p.evidence.trim().length>=40,'Missing evidence');
 assert(!t.notes.includes(`https://drive.google.com/file/d/${p.statementFileId}/view`),'Statement link already present');
 if(Object.hasOwn(p,'distinctStatementPeers')){
  const d=p.distinctStatementPeers;eq(Object.keys(d??{}).sort(),['transactionReference','transactionDate','peers'].sort(),'Invalid peer evidence');
  assert(/^\d{8,32}$/.test(d.transactionReference)&&validDate(d.transactionDate)&&nearby(d.transactionDate,t.date),'Invalid statement purchase identity');
  assert(Array.isArray(d.peers)&&d.peers.length>0,'Missing distinct peers');const refs=new Set([d.transactionReference]),ids=new Set();
  for(const peer of d.peers){eq(Object.keys(peer??{}).sort(),['transaction','statementReference','statementDate','evidence'].sort(),'Invalid peer');assert(/^\d{8,32}$/.test(peer.statementReference)&&!refs.has(peer.statementReference),'Repeated or invalid statement reference');refs.add(peer.statementReference);assert(peer.transaction?.id&&!ids.has(peer.transaction.id),'Repeated or invalid peer id');ids.add(peer.transaction.id);assert(validDate(peer.transaction.date)&&validDate(peer.statementDate)&&nearby(peer.transaction.date,peer.statementDate),'Peer statement date mismatch');assert(typeof peer.evidence==='string'&&peer.evidence.trim().length>=40,'Peer evidence missing');}
 }
}
function targetMatches(t,p){return t.account===p.usd.account&&t.date===p.oldTransaction.date&&t.amount===p.usd.amount&&t.payee===p.usd.payee&&t.category===p.usd.category&&t.imported_id===p.oldTransaction.imported_id&&t.notes===newNotes(p)&&!t.is_parent&&!t.is_child&&!t.parent_id&&!t.transfer_id&&!t.schedule&&!t.reconciled&&!t.cleared&&!t.subtransactions?.length}
function sourceMatch(t,p){return p.sourceIds.some(id=>t.imported_id===`gmail:${id}`||String(t.notes??'').split('\n').includes(link(id)))}
function mappedRecord(p,id,audit){return {...p.oldRecord,transactionId:id,currency:'USD',account:p.usd.account,amount:p.usd.amount,category:p.usd.category,fxExpenseMigration:{oldTransactionId:p.oldTransaction.id,auditKey:p.oldTransaction.id},verifiedAt:audit.verifiedAt,backup:audit.backups.usd}}
export function classifyStatementFxExpense(p,s,l,dashboards){
 validate(p);assert(s?.clp&&s?.usd&&dashboards&&Array.isArray(dashboards.clp)&&Array.isArray(dashboards.usd),'Missing budget snapshots');const old=p.oldTransaction;
 const a=l.statementFxExpenseMigrations?.[old.id];if(a?.status==='pending')throw Error('Pending FX expense migration requires investigation');
 if(a){
  assert.equal(a.status,'complete');eq(a.candidate,p,'Audit candidate differs');assert(!s.clp.transactions.some(t=>t.id===old.id||sourceMatch(t,p)),'Original source still in CLP');
  const matching=s.usd.transactions.filter(t=>sourceMatch(t,p));assert.equal(matching.length,1,'Destination source missing or duplicated');assert.equal(matching[0].id,a.newId);assert(targetMatches(matching[0],p),'Destination changed');
  for(const id of p.sourceIds)eq(l.records[id],mappedRecord(p,a.newId,a),'Migrated ledger differs');
  return {action:'existing',id:a.newId};
 }
 assert(!hasPendingFxExpenseMigration(l),'Pending FX expense migration requires investigation');
 assert(s.clp.accounts.some(x=>x.id===old.account&&!x.closed&&!x.offbudget),'Original account unavailable');assert(s.usd.accounts.some(x=>x.id===p.usd.account&&!x.closed&&!x.offbudget),'Destination account unavailable');
 const originalCategory=s.clp.categories.find(x=>x.id===old.category&&!x.hidden&&!x.is_income),destinationCategory=s.usd.categories.find(x=>x.id===p.usd.category&&!x.hidden&&!x.is_income);
 assert(originalCategory&&destinationCategory&&originalCategory.name.toLowerCase()===destinationCategory.name.toLowerCase(),'Category mapping differs');
 assert(s.clp.payees.some(x=>x.id===old.payee&&!x.transfer_acct)&&s.usd.payees.some(x=>x.id===p.usd.payee&&!x.transfer_acct),'Payee unavailable');
 const matches=s.clp.transactions.filter(t=>t.id===old.id);assert.equal(matches.length,1,'Original transaction missing or duplicated');eq(matches[0],old,'Original transaction changed');
 const owners=Object.entries(l.records??{}).filter(([,r])=>r?.transactionId===old.id).map(([id])=>id).sort();eq(owners,[...p.sourceIds].sort(),'Unexpected source owners');
 for(const id of p.sourceIds)eq(l.records[id],p.oldRecord,'Source ledger changed');
 assert.equal(s.clp.transactions.filter(t=>sourceMatch(t,p)).length,1,'Ambiguous original source');assert(!s.usd.transactions.some(t=>sourceMatch(t,p)),'Source already exists in USD');
 const near=s.usd.transactions.filter(t=>t.account===p.usd.account&&t.amount===p.usd.amount&&validDate(t.date)&&nearby(t.date,old.date));
 if(!Object.hasOwn(p,'distinctStatementPeers'))assert.equal(near.length,0,'Possible USD duplicate');
 else {const peers=p.distinctStatementPeers.peers;assert.equal(near.length,peers.length,'Incomplete or extraneous peer evidence');const destPayee=s.usd.payees.find(x=>x.id===p.usd.payee);for(const peer of peers){const actual=near.find(t=>t.id===peer.transaction.id);assert(actual,'Peer is not an exact nearby charge');eq(actual,peer.transaction,'Peer changed');const other=s.usd.payees.find(x=>x.id===actual.payee&&!x.transfer_acct);assert(other&&actual.payee!==p.usd.payee&&other.name.trim().toLowerCase()!==destPayee.name.trim().toLowerCase(),'Peer merchant is not distinct');}}
 for(const [key,value] of Object.entries(l)){if(['records','activeRun','runs','statementFxExpenseMigrations'].includes(key))continue;assert(!JSON.stringify(value).includes(old.id),`Unexpected original transaction reference in ${key}`)}
 const planHash=hash({candidate:p,snapshots:s,dashboards,ledger:stableLedger(l)});return {action:'migrate',oldId:old.id,clpDelta:-old.amount,usdDelta:p.usd.amount,planHash};
}
async function withBudget(d,currency,fn){const {api}=await d.connect((d.budgets??BUDGETS)[currency].syncId);try{return await fn(api)}finally{await api.shutdown()}}
async function snapshots(d){const s={},dashboards={};for(const currency of ['CLP','USD'])await withBudget(d,currency,async api=>{const k=currency.toLowerCase();s[k]=await d.snapshot(api);dashboards[k]=await d.readDashboard(api)});return {s,dashboards}}
function verify(before,after,p){
 const found=after.usd.transactions.filter(t=>sourceMatch(t,p));assert.equal(found.length,1,'New expense missing or duplicate');const t=found[0];assert(targetMatches(t,p),'New expense differs');assert(!after.clp.transactions.some(x=>x.id===p.oldTransaction.id||sourceMatch(x,p)),'Old source remains');
 for(const k of ['clp','usd']){const old=before[k],now=after[k];for(const field of Object.keys(old).filter(x=>!['transactions','balances'].includes(x)))eq(now[field],old[field],`Unrelated ${k} ${field} changed`);
  const oldList=old.transactions.filter(x=>k!=='clp'||x.id!==p.oldTransaction.id),newList=now.transactions.filter(x=>k!=='usd'||x.id!==t.id);eq(newList,oldList,`Other ${k} transactions changed`);
  const balances=structuredClone(old.balances);balances[k==='clp'?p.oldTransaction.account:p.usd.account]+=k==='clp'?-p.oldTransaction.amount:p.usd.amount;eq(now.balances,balances,`Unexpected ${k} balance`);
 }
 return t.id;
}
function verifyDestination(before,after,p){
 const found=after.transactions.filter(t=>sourceMatch(t,p));assert.equal(found.length,1,'New destination missing or duplicate');const t=found[0];assert(targetMatches(t,p),'New destination differs');
 eq(after.transactions.filter(x=>x.id!==t.id),before.transactions,'Other destination transactions changed');
 for(const field of Object.keys(before).filter(x=>!['transactions','balances'].includes(x)))eq(after[field],before[field],`Unrelated destination ${field} changed`);
 const balances=structuredClone(before.balances);balances[p.usd.account]+=p.usd.amount;eq(after.balances,balances,'Destination balance differs');return t.id;
}
export async function migrateStatementFxExpense(p,commit,d){
 validate(p);let ledger=commit?await d.requireRun():await d.readState();assert(!hasPendingFxExpenseMigration(ledger),'Pending FX expense migration requires investigation');
 const before=await snapshots(d),action=classifyStatementFxExpense(p,before.s,ledger,before.dashboards);if(!commit)return {...action,candidate:p};if(action.action==='existing')return {...action,verified:true,backups:ledger.statementFxExpenseMigrations[p.oldTransaction.id].backups};
 assert(d.expectedPlan&&d.expectedPlan===action.planHash,'Plan hash missing or changed');const backups={};
 for(const currency of ['CLP','USD'])await withBudget(d,currency,async api=>{const k=currency.toLowerCase();eq(await d.snapshot(api),before.s[k],'Budget changed before backup');eq(await d.readDashboard(api),before.dashboards[k],'Dashboard changed before backup');backups[k]=await d.backup(api,currency,before.s[k]);await d.json(backups[k]+'/statement-fx-expense.json',{candidate:p,planHash:action.planHash,dashboard:before.dashboards[k]})});
 eq(await snapshots(d),before,'Budget changed before write');ledger=await d.requireRun();assert.equal(classifyStatementFxExpense(p,before.s,ledger,before.dashboards).planHash,action.planHash,'Ledger changed before write');
 ledger.statementFxExpenseMigrations??={};ledger.statementFxExpenseMigrations[p.oldTransaction.id]={status:'pending',candidate:p,planHash:action.planHash,backups};await d.save(ledger);
 await withBudget(d,'USD',async api=>{eq(await d.snapshot(api),before.s.usd,'USD changed before creation');await d.requireRun();await api.addTransactions(p.usd.account,[{date:p.oldTransaction.date,amount:p.usd.amount,payee:p.usd.payee,category:p.usd.category,imported_id:p.oldTransaction.imported_id,notes:newNotes(p),cleared:false}],{runTransfers:false,learnCategories:false});await api.sync()});
 const intermediate=await snapshots(d);eq(intermediate.s.clp,before.s.clp,'Original budget changed before deletion');eq(intermediate.dashboards,before.dashboards,'Dashboard changed before deletion');verifyDestination(before.s.usd,intermediate.s.usd,p);
 await withBudget(d,'CLP',async api=>{eq(await d.snapshot(api),before.s.clp,'CLP changed before deletion');await d.requireRun();await api.deleteTransaction(p.oldTransaction.id);await api.sync()});
 const after=await snapshots(d);eq(after.dashboards,before.dashboards,'Dashboard changed');const id=verify(before.s,after.s,p);for(const k of ['clp','usd'])await d.json(backups[k]+'/after.json',after.s[k]);
 ledger=await d.requireRun();const audit=ledger.statementFxExpenseMigrations?.[p.oldTransaction.id];assert.equal(audit?.status,'pending');eq(audit.candidate,p,'Pending audit changed');for(const source of p.sourceIds)eq(ledger.records[source],p.oldRecord,'Source ledger changed during write');
 audit.newId=id;audit.verifiedAt=new Date().toISOString();audit.status='complete';for(const source of p.sourceIds)ledger.records[source]=mappedRecord(p,id,audit);await d.save(ledger);assert.equal(classifyStatementFxExpense(p,after.s,ledger,after.dashboards).action,'existing');
 return {...action,id,backups,verified:true};
}
