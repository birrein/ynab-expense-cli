import assert from 'node:assert/strict';
import {BUDGETS} from './actual-daily-policy.mjs';
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const eq=(a,b,m)=>assert.deepEqual(canon(a),canon(b),m);
const validDate=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const normalized=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('en-US').replace(/\s+/gu,' ').trim();
function baseCheck(p,s,l){
 eq(Object.keys(p).sort(),['unbilledBundledSubscriptionRetirement','currency','old','bundle','standaloneText','bundleText','includedText','receiptId','providerOrderId','statementIds','evidence'].sort(),'Unexpected fields');
 assert.equal(p.unbilledBundledSubscriptionRetirement,true);assert(BUDGETS[p.currency],'Unsupported budget');
 assert(/^[a-f0-9]{16}$/i.test(p.receiptId),'Missing receipt');assert(/^[A-Za-z0-9_-]{8,}$/.test(p.providerOrderId),'Missing provider order');assert(Array.isArray(p.statementIds)&&p.statementIds.length===2&&new Set(p.statementIds).size===2&&p.statementIds.every(x=>/^[A-Za-z0-9_-]{8,}$/.test(x)),'Two distinct statements required');
 assert(typeof p.evidence==='string'&&p.evidence.trim().length>=90&&!/[\r\n]/.test(p.evidence),'Detailed provider and bank evidence required');
 for(const k of ['standaloneText','bundleText','includedText'])assert(typeof p[k]==='string'&&p[k].trim().length>=3&&!/[\r\n]/.test(p[k]),'Missing identity '+k);
 const t=p.old,b=p.bundle;assert(t&&b&&t.id&&b.id&&t.id!==b.id&&t.account&&t.account===b.account&&t.payee&&t.payee===b.payee&&t.category&&b.category,'Identity mismatch');
 for(const x of [t,b])assert(validDate(x.date)&&Number.isSafeInteger(x.amount)&&x.amount<0&&!x.is_parent&&!x.is_child&&!x.parent_id&&!x.subtransactions?.length&&!x.transfer_id&&!x.schedule&&!x.reconciled&&!x.tombstone&&typeof x.cleared==='boolean','Ineligible transaction');
 assert(!t.imported_id,'Old source must be absent');assert(t.amount!==b.amount,'Amounts must differ');assert(t.date.slice(0,7)===b.date.slice(0,7)&&Math.abs(Date.parse(t.date)-Date.parse(b.date))<=3*86400000,'Dates differ');
 assert(normalized(t.notes).includes(normalized(p.standaloneText))&&normalized(b.notes).includes(normalized(p.bundleText))&&normalized(b.notes).includes(normalized(p.includedText)),'Service identity missing');
 assert(s.accounts.some(a=>a.id===t.account&&!a.closed&&!a.offbudget),'Account unavailable');assert(s.payees.some(a=>a.id===t.payee&&!a.transfer_acct),'Merchant unavailable');
 eq(s.transactions.filter(x=>x.id===b.id),[b],'Retained bundle changed');
 const duplicates=s.transactions.filter(x=>x.id!==b.id&&x.id!==t.id&&x.account===b.account&&x.payee===b.payee&&x.amount===b.amount&&validDate(x.date)&&Math.abs(Date.parse(x.date)-Date.parse(b.date))<=3*86400000);assert.equal(duplicates.length,0,'Ambiguous bundle charge');
 for(const r of Object.values(l.records??{}))assert.notEqual(r.transactionId,t.id,'Old transaction owned by ledger');
 for(const r of Object.values(l.cashflows??{}))assert(![r.id,r.counterpartId].includes(t.id),'Old transaction owned by ledger');
}
export function classifyUnbilledSubscription(p,s,l){
 baseCheck(p,s,l);const audit=l.unbilledBundledSubscriptions?.[p.old.id];const found=s.transactions.filter(x=>x.id===p.old.id);
 if(audit){assert.equal(audit.status,'complete','Pending operation requires investigation');eq(audit.candidate,p,'Audit conflict');assert.equal(found.length,0,'Retired transaction returned');eq(audit.old,p.old,'Prior audit changed');return {action:'existing',id:p.old.id,retainedId:p.bundle.id};}
 assert.equal(found.length,1,'Old transaction absent or duplicated without audit');eq(found[0],p.old,'Old transaction changed');return {action:'retire',id:p.old.id,retainedId:p.bundle.id,oldAmount:p.old.amount,account:p.old.account};
}
export async function retireUnbilledSubscription(p,commit,d){
 assert(BUDGETS[p.currency],'Unsupported budget');let l=commit?await d.requireRun():await d.readState(),{api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir;
 try{
  before=await d.snapshot(api);action=classifyUnbilledSubscription(p,before,l);if(!commit)return {...action,candidate:p};if(action.action==='existing')return {...action,verified:true,backup:l.unbilledBundledSubscriptions[p.old.id].backup};
  dir=await d.backup(api,p.currency,before);await d.json(dir+'/unbilled-subscription.json',{candidate:p,old:p.old});await api.sync();eq(await d.snapshot(api),before,'Budget changed before retirement');l=await d.requireRun();eq(classifyUnbilledSubscription(p,before,l),action,'Preview changed');
  l.unbilledBundledSubscriptions??={};l.unbilledBundledSubscriptions[p.old.id]={status:'pending',candidate:p,old:p.old,backup:dir};await d.save(l);await d.requireRun();await api.deleteTransaction(p.old.id);await api.sync();
 }finally{await api.shutdown()}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));
 try{
  const after=await d.snapshot(api);assert(!after.transactions.some(t=>t.id===p.old.id),'Old transaction remains');
  const {transactions:at,balances:ab,...ar}=after,{transactions:bt,balances:bb,...br}=before;eq(ar,br,'Unrelated data changed');assert.equal(at.length,bt.length-1,'Unexpected transaction count');const byId=new Map(at.map(t=>[t.id,t]));assert.equal(byId.size,at.length);for(const t of bt)if(t.id!==p.old.id)eq(byId.get(t.id),t,'Unrelated transaction changed');
  eq(Object.keys(ab).sort(),Object.keys(bb).sort(),'Accounts changed');for(const [id,b] of Object.entries(bb))assert.equal(ab[id],b-(id===p.old.account?p.old.amount:0),'Unexpected balance');
  await d.json(dir+'/after.json',after);l=await d.requireRun();eq(l.unbilledBundledSubscriptions?.[p.old.id],{status:'pending',candidate:p,old:p.old,backup:dir},'Intent changed');l.unbilledBundledSubscriptions[p.old.id]={status:'complete',candidate:p,old:p.old,backup:dir,verifiedAt:new Date().toISOString()};await d.save(l);return {...action,verified:true,backup:dir};
 }finally{await api.shutdown()}
}
