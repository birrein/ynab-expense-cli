import assert from 'node:assert/strict';
import {BUDGETS} from './actual-daily-policy.mjs';
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const eq=(a,b,m)=>assert.deepEqual(canon(a),canon(b),m);
const idPattern=/^[A-Za-z0-9_-]{8,}$/;
function corrected(p){const t=structuredClone(p.oldParent);t.account=p.targetAccount;for(const c of t.subtransactions)c.account=p.targetAccount;return t}
export function classifySplitAccount(p,s,ledger){
 assert.equal(p.historicalSplitAccountCorrection,true);eq(Object.keys(p).sort(),['currency','evidence','historicalSplitAccountCorrection','oldParent','oldStatementId','receiptUrl','targetAccount','targetStatementId'].sort());assert(BUDGETS[p.currency]);assert(idPattern.test(p.oldStatementId)&&idPattern.test(p.targetStatementId)&&p.oldStatementId!==p.targetStatementId);assert(/^https:\/\/mail\.google\.com\/mail\/u\/0\/#all\/[a-f0-9]+$/.test(p.receiptUrl));assert(typeof p.evidence==='string'&&p.evidence.trim().length>=30);
 const old=p.oldParent;assert(old?.id&&old.account&&p.targetAccount&&old.account!==p.targetAccount&&old.date&&Number.isSafeInteger(old.amount)&&old.amount<0);assert(old.is_parent&&!old.is_child&&!old.transfer_id&&!old.reconciled&&!old.schedule&&!old.imported_id);assert(Array.isArray(old.subtransactions)&&old.subtransactions.length>=2);assert.equal(old.subtransactions.reduce((n,c)=>n+c.amount,0),old.amount);let ids=new Set([old.id]);for(const c of old.subtransactions){assert(c.is_child&&c.parent_id===old.id&&c.account===old.account&&c.date===old.date&&c.category&&c.amount<0&&!ids.has(c.id));ids.add(c.id)}
 for(const id of [old.account,p.targetAccount])assert(s.accounts.some(a=>a.id===id&&!a.closed&&!a.offbudget),'Account unavailable');for(const r of Object.values(ledger.cashflows??{}))assert(![r.id,r.counterpartId].some(id=>ids.has(id)),'Ledger owned');for(const r of Object.values(ledger.records??{}))assert(!ids.has(r.transactionId),'Ledger owned');
 const t=s.transactions.filter(t=>t.id===old.id);assert.equal(t.length,1);const audit=ledger.historicalSplitAccountCorrections?.[old.id];if(audit){eq(audit.candidate,p,'Audit differs');eq(t[0],corrected(p),'Corrected split differs');return {action:'existing',id:old.id}}
 eq(t[0],old,'Split identity mismatch or unverified previous write');assert(!s.transactions.some(t=>t.id!==old.id&&t.account===p.targetAccount&&t.date===old.date&&t.amount===old.amount),'Possible destination duplicate');return {action:'correct',id:old.id,from:old.account,to:p.targetAccount};
}
export async function correctSplitAccount(p,commit,d){
 let ledger=commit?await d.requireRun():await d.readState(),{api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir;
 try{before=await d.snapshot(api);action=classifySplitAccount(p,before,ledger);if(!commit)return {...action,candidate:p};if(action.action==='existing')return {...action,verified:true,backup:ledger.historicalSplitAccountCorrections[p.oldParent.id].backup};dir=await d.backup(api,p.currency,before);await d.json(dir+'/split-account-correction.json',{candidate:p});await api.sync();eq(await d.snapshot(api),before,'Budget changed');classifySplitAccount(p,before,await d.requireRun());await api.updateTransaction(p.oldParent.id,{account:p.targetAccount,payee:p.oldParent.payee});let moved;for(let i=0;i<50;i++){moved=(await api.getTransactions(p.targetAccount,p.oldParent.date,p.oldParent.date)).find(t=>t.id===p.oldParent.id);if(moved)break;await new Promise(r=>setTimeout(r,100))}assert(moved,'Account update did not settle; inspect backup and current state');eq(moved,corrected(p),'Updated split differs');await api.sync()}finally{await api.shutdown()}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));try{const after=await d.snapshot(api),expected=structuredClone(before),old=p.oldParent;expected.transactions=expected.transactions.map(t=>t.id===old.id?corrected(p):t);expected.balances[old.account]-=old.amount;expected.balances[p.targetAccount]+=old.amount;const {transactions:at,...ar}=after,{transactions:bt,...br}=expected;eq(ar,br,'Unrelated state or balances changed');assert.equal(at.length,bt.length);let byId=new Map(at.map(t=>[t.id,t]));assert.equal(byId.size,at.length);for(const t of bt)eq(byId.get(t.id),t,'Transaction differs');await d.json(dir+'/after.json',after);ledger=await d.requireRun();ledger.historicalSplitAccountCorrections??={};ledger.historicalSplitAccountCorrections[old.id]={candidate:p,backup:dir,verifiedAt:new Date().toISOString()};await d.save(ledger);return {...action,verified:true,backup:dir}}finally{await api.shutdown()}
}

export function classifySimpleAccount(p,s,ledger){
 assert.equal(p.historicalSimpleAccountCorrection,true);
 eq(Object.keys(p).sort(),['currency','evidence','historicalSimpleAccountCorrection','oldTransaction','oldStatementId','receiptUrl','targetAccount','targetStatementId'].sort());
 assert(BUDGETS[p.currency]);
 assert(idPattern.test(p.oldStatementId)&&idPattern.test(p.targetStatementId)&&p.oldStatementId!==p.targetStatementId);
 assert(/^https:\/\/mail\.google\.com\/mail\/u\/0\/#all\/[a-f0-9]+$/.test(p.receiptUrl));
 assert(typeof p.evidence==='string'&&p.evidence.trim().length>=30);
 const old=p.oldTransaction;
 assert(old?.id&&old.account&&p.targetAccount&&old.account!==p.targetAccount&&/^\d{4}-\d{2}-\d{2}$/.test(old.date)&&Number.isSafeInteger(old.amount)&&old.amount<0);
 assert(!old.is_parent&&!old.is_child&&!old.transfer_id&&!old.reconciled&&!old.schedule&&!old.imported_id&&(!old.subtransactions||old.subtransactions.length===0));
 for(const id of [old.account,p.targetAccount])assert(s.accounts.some(a=>a.id===id&&!a.closed&&!a.offbudget),'Account unavailable');
 for(const r of Object.values(ledger.cashflows??{}))assert(![r.id,r.counterpartId,r.transactionId].includes(old.id),'Ledger owned');
 for(const r of Object.values(ledger.records??{}))assert(r.transactionId!==old.id,'Ledger owned');
 const found=s.transactions.filter(t=>t.id===old.id);assert.equal(found.length,1);
 const audit=ledger.historicalSimpleAccountCorrections?.[old.id];
 if(audit){eq(audit.candidate,p,'Audit differs');assert.equal(audit.status,'complete','Pending audit requires inspection');eq(found[0],{...old,account:p.targetAccount},'Corrected expense differs');return {action:'existing',id:old.id}}
 eq(found[0],old,'Expense identity mismatch or unverified previous write');
 const stamp=Date.parse(old.date+'T00:00:00Z');assert(Number.isFinite(stamp));
 assert(!s.transactions.some(t=>t.id!==old.id&&t.account===p.targetAccount&&!t.is_child&&t.amount===old.amount&&Math.abs(Date.parse(t.date+'T00:00:00Z')-stamp)<=7*86400000),'Possible destination duplicate');
 return {action:'correct',id:old.id,from:old.account,to:p.targetAccount};
}

export async function correctSimpleAccount(p,commit,d){
 let ledger=commit?await d.requireRun():await d.readState();
 let {api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir;
 try{
  before=await d.snapshot(api);action=classifySimpleAccount(p,before,ledger);
  if(!commit)return {...action,candidate:p};
  if(action.action==='existing')return {...action,verified:true,backup:ledger.historicalSimpleAccountCorrections[p.oldTransaction.id].backup};
  dir=await d.backup(api,p.currency,before);
  await d.json(dir+'/simple-account-correction.json',{candidate:p});
  await api.sync();eq(await d.snapshot(api),before,'Budget changed');
  ledger=await d.requireRun();classifySimpleAccount(p,before,ledger);
  ledger.historicalSimpleAccountCorrections??={};
  ledger.historicalSimpleAccountCorrections[p.oldTransaction.id]={status:'pending',candidate:p,backup:dir};
  await d.save(ledger);
  await api.updateTransaction(p.oldTransaction.id,{account:p.targetAccount,payee:p.oldTransaction.payee});
  let moved;
  for(let i=0;i<50;i++){
   moved=(await api.getTransactions(p.targetAccount,p.oldTransaction.date,p.oldTransaction.date)).find(t=>t.id===p.oldTransaction.id);
   if(moved)break;await new Promise(r=>setTimeout(r,100));
  }
  assert(moved,'Account update did not settle; inspect backup and current state');
  eq(moved,{...p.oldTransaction,account:p.targetAccount},'Updated expense differs');
  await api.sync();
 }finally{await api.shutdown()}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));
 try{
  const after=await d.snapshot(api),expected=structuredClone(before),old=p.oldTransaction;
  expected.transactions=expected.transactions.map(t=>t.id===old.id?{...old,account:p.targetAccount}:t);
  expected.balances[old.account]-=old.amount;expected.balances[p.targetAccount]+=old.amount;
  const {transactions:at,...ar}=after,{transactions:bt,...br}=expected;eq(ar,br,'Unrelated state or balances changed');
  assert.equal(at.length,bt.length);let byId=new Map(at.map(t=>[t.id,t]));assert.equal(byId.size,at.length);
  for(const t of bt)eq(byId.get(t.id),t,'Transaction differs');
  await d.json(dir+'/after.json',after);
  ledger=await d.requireRun();const audit=ledger.historicalSimpleAccountCorrections?.[old.id];
  assert.equal(audit?.status,'pending');eq(audit.candidate,p,'Audit differs');
  audit.status='complete';audit.verifiedAt=new Date().toISOString();await d.save(ledger);
  return {...action,verified:true,backup:dir};
 }finally{await api.shutdown()}
}
