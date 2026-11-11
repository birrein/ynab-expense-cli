import assert from 'node:assert/strict';
import { BUDGETS } from './actual-daily-policy.mjs';

const canon=x=>Array.isArray(x)?x.map(canon):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canon(x[k])])):x;
const eq=(a,b,m)=>assert.deepEqual(canon(a),canon(b),m);
const dateOk=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const month=x=>Number(x.slice(0,4))*12+Number(x.slice(5,7));
const fields=['historicalSplitInstallmentReplacement','currency','oldParent','purchaseMessageId','evidence','installments'];
const itemKey=x=>JSON.stringify([x.category,x.payee,x.notes]);
const abs=x=>x<0n?-x:x;

export function classifySplitInstallmentReplacement(p,s,l,asOf){
 assert(p&&p.historicalSplitInstallmentReplacement===true,'Expected split replacement');
 eq(Object.keys(p).sort(),fields.slice().sort(),'Unexpected candidate fields');
 assert(Object.hasOwn(BUDGETS,p.currency)&&dateOk(asOf),'Invalid currency or date');
 assert(typeof p.evidence==='string'&&p.evidence.trim().length>=30,'Missing evidence');
 assert(typeof p.purchaseMessageId==='string'&&/^[a-f0-9]+$/.test(p.purchaseMessageId),'Invalid receipt');
 const old=p.oldParent;
 assert(old&&typeof old.id==='string'&&old.id&&dateOk(old.date)&&Number.isSafeInteger(old.amount)&&old.amount<0,'Invalid parent');
 assert(old.is_parent&&!old.is_child&&!old.parent_id&&!old.transfer_id&&!old.schedule&&!old.reconciled&&!old.cleared&&!old.imported_id&&!old.starting_balance_flag&&!old.tombstone&&!old.error&&old.category==null,'Parent is not an eligible historical split');
 assert(typeof old.notes==='string'&&/#cuotas\b/i.test(old.notes),'Original installment evidence missing');
 assert(s.accounts.some(a=>a.id===old.account&&!a.closed&&!a.offbudget),'Account unavailable');
 assert(s.payees.some(a=>a.id===old.payee&&!a.transfer_acct),'Payee unavailable');
 assert(Array.isArray(old.subtransactions)&&old.subtransactions.length>=2&&old.subtransactions.length<=30,'Invalid split children');
 const children=old.subtransactions,childIds=new Set(),keys=new Set(),unit=p.currency==='CLP'?100:1;
 for(const child of children){
  assert(child&&typeof child.id==='string'&&child.id&&!childIds.has(child.id),'Duplicate child');childIds.add(child.id);
  assert(child.is_child&&!child.is_parent&&child.parent_id===old.id&&child.account===old.account&&child.date===old.date&&!child.transfer_id&&!child.schedule&&!child.reconciled&&!child.cleared&&!child.imported_id&&!child.tombstone&&!child.error,'Ineligible child');
  assert(Number.isSafeInteger(child.amount)&&child.amount<0&&child.amount%unit===0&&typeof child.notes==='string'&&child.notes.trim(),'Invalid child');
  assert(s.categories.some(c=>c.id===child.category&&!c.hidden&&!c.is_income),'Category unavailable');
  assert(s.payees.some(a=>a.id===child.payee&&!a.transfer_acct),'Child payee unavailable');
  assert(!keys.has(itemKey(child)),'Ambiguous child identity');keys.add(itemKey(child));
 }
 assert.equal(children.reduce((n,c)=>n+c.amount,0),old.amount,'Original child total mismatch');
 assert(Array.isArray(p.installments)&&p.installments.length>=2&&p.installments.length<=99,'Incomplete series');
 let sum=0,first;const sources=new Set(),statements=new Set(),columns=new Map(children.map(c=>[c.id,0]));
 for(const [i,x] of p.installments.entries()){
  eq(Object.keys(x).sort(),['number','date','amount','statementId','sourceId','allocations'].sort(),'Unexpected installment fields');
  assert.equal(x.number,i+1,'Nonconsecutive installment');assert(dateOk(x.date)&&x.date<=asOf,'Invalid or future installment date');
  if(i===0){first=month(x.date);assert(first-month(old.date)>=0&&first-month(old.date)<=1,'First installment month conflicts');}
  assert.equal(month(x.date),first+i,'Nonconsecutive billing months');
  assert(Number.isSafeInteger(x.amount)&&x.amount<0&&x.amount%unit===0,'Invalid installment amount');sum+=x.amount;
  assert(typeof x.statementId==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(x.statementId)&&!statements.has(x.statementId),'Invalid statement');statements.add(x.statementId);
  assert(typeof x.sourceId==='string'&&/^bank:[A-Za-z0-9:_-]+$/.test(x.sourceId)&&!sources.has(x.sourceId),'Invalid source');sources.add(x.sourceId);
  assert(Array.isArray(x.allocations)&&x.allocations.length===children.length,'Incomplete allocation');let row=0;
  for(const [j,z] of x.allocations.entries()){
   eq(Object.keys(z).sort(),['childId','amount'].sort(),'Unexpected allocation fields');assert.equal(z.childId,children[j].id,'Child allocation order or identity mismatch');
   assert(Number.isSafeInteger(z.amount)&&z.amount<0&&z.amount%unit===0,'Invalid child allocation');row+=z.amount;columns.set(z.childId,columns.get(z.childId)+z.amount);
   assert(abs(BigInt(z.amount)*BigInt(old.amount)-BigInt(children[j].amount)*BigInt(x.amount))<BigInt(-old.amount)*BigInt(unit),'Allocation is not proportional');
  }
  assert.equal(row,x.amount,'Installment allocation mismatch');
 }
 assert.equal(sum,old.amount,'Installments differ from original');
 for(const child of children)assert.equal(columns.get(child.id),child.amount,'Original child allocation mismatch');
 for(const r of Object.values(l.records??{}))assert(![old.id,...childIds].includes(r.transactionId),'Original belongs to ledger');
 for(const r of Object.values(l.cashflows??{}))assert(![old.id,...childIds].some(id=>[r.id,r.counterpartId].includes(id)),'Original belongs to ledger');
 const audit=l.historicalSplitInstallmentReplacements?.[old.id];
 if(audit?.status==='pending')throw Error('Pending replacement requires manual investigation');
 if(audit){
  assert.equal(audit.status,'complete','Invalid audit status');assert(audit.backup&&audit.verifiedAt,'Incomplete audit');eq(audit.candidate,p,'Audit candidate mismatch');
  assert(Array.isArray(audit.ids)&&audit.ids.length===p.installments.length&&new Set(audit.ids).size===audit.ids.length&&audit.ids[0]===old.id,'Invalid audited IDs');
  assert(Array.isArray(audit.transactions)&&audit.transactions.length===audit.ids.length,'Audited series missing');
  for(const [i,t] of audit.transactions.entries()){assert.equal(t.id,audit.ids[i]);const found=s.transactions.filter(x=>x.id===t.id);assert.equal(found.length,1,'Audited installment missing');eq(found[0],t,'Audited installment changed');}
  return {action:'existing',id:old.id,ids:audit.ids};
 }
 const found=s.transactions.filter(t=>t.id===old.id);assert.equal(found.length,1,'Original missing');eq(found[0],old,'Original changed');
 for(const x of p.installments){
  assert(!s.transactions.some(t=>t.id!==old.id&&(t.imported_id===x.sourceId||(t.account===old.account&&t.amount===x.amount&&Math.abs(Date.parse(t.date)-Date.parse(x.date))<=4*86400000))),'Possible duplicate installment');
  assert(!(s.schedules??[]).some(t=>t.account===old.account&&t.payee===old.payee&&t.amount===x.amount&&dateOk(t.next_date??t.date)&&Math.abs(Date.parse(t.next_date??t.date)-Date.parse(x.date))<=4*86400000),'Possible duplicate schedule');
  assert(!l.cashflows?.[x.sourceId]&&!l.records?.[x.sourceId],'Installment source already owned');
 }
 return {action:'replace',id:old.id,allocations:p.installments.map(x=>({number:x.number,date:x.date,amount:x.amount,allocations:x.allocations}))};
}

const notes=(p,x)=>`${p.oldParent.notes}\nCuota ${x.number}/${p.installments.length}; distribución proporcional de artículos.\nhttps://mail.google.com/mail/u/0/#all/${p.purchaseMessageId}\nhttps://drive.google.com/file/d/${x.statementId}/view\nsource=${x.sourceId}`;
const expectedFirst=p=>{const x=p.installments[0];return {...p.oldParent,date:x.date,amount:x.amount,notes:notes(p,x),imported_id:x.sourceId,
 subtransactions:p.oldParent.subtransactions.map((child,i)=>({...child,date:x.date,amount:x.allocations[i].amount}))};};
function verifyAdded(p,x,t){
 const old=p.oldParent;assert(t&&t.id!==old.id&&t.is_parent&&!t.is_child&&!t.parent_id&&!t.transfer_id&&!t.schedule&&!t.reconciled&&!t.cleared,'Invalid new parent');
 assert.equal(t.account,old.account);assert.equal(t.payee,old.payee);assert.equal(t.category??null,null);assert.equal(t.date,x.date);assert.equal(t.amount,x.amount);assert.equal(t.notes,notes(p,x));assert.equal(t.imported_id,x.sourceId);
 assert(Array.isArray(t.subtransactions)&&t.subtransactions.length===old.subtransactions.length,'Child count differs');
 const keys=new Set();for(const [i,child] of old.subtransactions.entries()){
  const found=t.subtransactions.filter(c=>itemKey(c)===itemKey(child));assert.equal(found.length,1,'Child identity differs');const c=found[0];
  assert(c.id&&!keys.has(c.id)&&!old.subtransactions.some(z=>z.id===c.id)&&c.is_child&&!c.is_parent&&c.parent_id===t.id&&!c.transfer_id&&!c.schedule&&!c.reconciled&&!c.cleared,'Invalid new child');keys.add(c.id);
  assert.equal(c.account,old.account);assert.equal(c.date,x.date);assert.equal(c.amount,x.allocations[i].amount);
 }
}

export async function replaceSplitInstallments(p,commit,d){
 assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported budget');let l=commit?await d.requireRun():await d.readState();
 let {api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir;
 try{
  before=await d.snapshot(api);action=classifySplitInstallmentReplacement(p,before,l,d.today());if(!commit)return {...action,candidate:p};
  if(action.action==='existing')return {...action,verified:true,backup:l.historicalSplitInstallmentReplacements[p.oldParent.id].backup};
  dir=await d.backup(api,p.currency,before);await d.json(dir+'/historical-split-installment-replacement.json',{candidate:p});
  await api.sync();eq(await d.snapshot(api),before,'Budget changed before replacement');l=await d.requireRun();classifySplitInstallmentReplacement(p,before,l,d.today());
  l.historicalSplitInstallmentReplacements??={};l.historicalSplitInstallmentReplacements[p.oldParent.id]={status:'pending',candidate:p,backup:dir};await d.save(l);
  const first=expectedFirst(p);await api.updateTransaction(first.id,{date:first.date,amount:first.amount,payee:first.payee,notes:first.notes,imported_id:first.imported_id,subtransactions:first.subtransactions});
  let updated;for(let i=0;i<50;i++){updated=(await d.snapshot(api)).transactions.find(t=>t.id===first.id);if(updated?.date===first.date&&updated.amount===first.amount)break;await new Promise(r=>setTimeout(r,200));}
  eq(updated,first,'First split differs; inspect pending audit and backup');await d.requireRun();
  const rest=p.installments.slice(1).map(x=>({date:x.date,amount:x.amount,payee:p.oldParent.payee,category:null,is_parent:true,imported_id:x.sourceId,notes:notes(p,x),cleared:false,
   subtransactions:p.oldParent.subtransactions.map((c,i)=>({amount:x.allocations[i].amount,category:c.category,payee:c.payee,notes:c.notes}))}));
  await api.addTransactions(p.oldParent.account,rest,{runTransfers:false,learnCategories:false});await api.sync();
 }finally{await api.shutdown();}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));
 try{
  const after=await d.snapshot(api),ids=[p.oldParent.id],tx=[];const first=after.transactions.filter(t=>t.id===p.oldParent.id);assert.equal(first.length,1);eq(first[0],expectedFirst(p),'First split differs');tx.push(first[0]);
  for(const x of p.installments.slice(1)){const found=after.transactions.filter(t=>t.imported_id===x.sourceId);assert.equal(found.length,1,'New installment missing or duplicated');verifyAdded(p,x,found[0]);assert(!ids.includes(found[0].id),'Duplicate installment ID');ids.push(found[0].id);tx.push(found[0]);}
  assert.equal(after.transactions.length,before.transactions.length+p.installments.length-1,'Unexpected transaction count');const byId=new Map(after.transactions.map(t=>[t.id,t]));assert.equal(byId.size,after.transactions.length);
  for(const t of before.transactions)if(t.id!==p.oldParent.id)eq(byId.get(t.id),t,'Unrelated transaction changed');
  for(const k of Object.keys(before).filter(k=>k!=='transactions'))eq(after[k],before[k],`Unrelated ${k} changed`);
  await d.json(dir+'/after.json',after);l=await d.requireRun();const audit=l.historicalSplitInstallmentReplacements?.[p.oldParent.id];assert.equal(audit?.status,'pending');eq(audit.candidate,p,'Pending audit changed');
  Object.assign(audit,{status:'complete',ids,transactions:tx,verifiedAt:new Date().toISOString()});assert.equal(classifySplitInstallmentReplacement(p,after,l,d.today()).action,'existing');await d.save(l);
  return {action:'replace',id:p.oldParent.id,ids,verified:true,backup:dir};
 }finally{await api.shutdown();}
}
