import assert from 'node:assert/strict';
import {BUDGETS} from './actual-daily-policy.mjs';
import {assertAuditedLineage} from './actual-installment-lineage.mjs';

const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const equal=(a,b,message)=>assert.deepEqual(canonical(a),canonical(b),message);
const corrected=p=>({...structuredClone(p.oldTransaction),amount:p.newAmount});
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const month=x=>Number(x.slice(0,4))*12+Number(x.slice(5,7));
function installmentSignature(t,n,total){
 assert(typeof t.notes==='string'&&/#cuotas\b/i.test(t.notes),'Installment note missing');
 const re=new RegExp(`(?<!\\d)0?${n}/0?${total}(?!\\d)`,'g');
 assert.equal([...t.notes.matchAll(re)].length,1,'Installment number missing or ambiguous');
 return t.notes.replace(re,'<installment>');
}
function validateStatementSeries(p,s,ledger,retry){
 const e=p.statementSeries,old=p.oldTransaction;
 assert(e&&typeof e==='object'&&!Array.isArray(e),'Statement series required');
 assert(Number.isInteger(e.number)&&Number.isInteger(e.total)&&e.number>1&&e.number<=e.total&&e.total<=120,'Invalid installment number');
 const terminal=e.number===e.total;
 equal(Object.keys(e).sort(),['purchaseStatementId','number','total','previous',terminal?'previous2':'next'].sort(),'Unexpected statement series fields');
 assert(p.currency==='CLP'&&old.amount%100===0&&p.newAmount%100===0&&Math.abs(p.newAmount-old.amount)<=1000,'Statement-only amount correction exceeds rounding bounds');
 assert(typeof e.purchaseStatementId==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(e.purchaseStatementId)&&e.purchaseStatementId!==p.statementId,'Original and target statement IDs must be valid and distinct');
 if(terminal)assert(e.total>=3,'Final installment needs two prior neighbors');
 const prev=e.previous,other=terminal?e.previous2:e.next;
 for(const t of [old,prev,other])assert(t&&typeof t.id==='string'&&validDate(t.date),'Invalid installment snapshot');
 assert.equal(new Set([old.id,prev.id,other.id]).size,3,'Series identities overlap');
 assert.equal(month(old.date)-month(prev.date),1,'Previous billing month mismatch');
 if(terminal)assert.equal(month(prev.date)-month(other.date),1,'Earlier billing month mismatch');
 else assert.equal(month(other.date)-month(old.date),1,'Next billing month mismatch');
 const sig=installmentSignature(old,e.number,e.total);
 assert.equal(installmentSignature(prev,e.number-1,e.total),sig,'Previous series mismatch');
 assert.equal(installmentSignature(other,terminal?e.number-2:e.number+1,e.total),sig,'Neighbor series mismatch');
 for(const peer of [prev,other]){
  assert(peer.account===old.account&&peer.payee===old.payee&&peer.category===old.category&&!peer.is_parent&&!peer.is_child&&!peer.transfer_id,'Neighbor identity mismatch');
  const found=s.transactions.filter(t=>t.id===peer.id);assert.equal(found.length,1,'Neighbor missing or duplicated');
  if(retry)assertAuditedLineage(peer,found[0],ledger,p.currency,retry.verifiedAt,'Neighbor changed');
  else equal(found[0],peer,'Neighbor changed');
 }
}

function validateSubscriptionEvidence(p,s){
 const e=p.subscriptionEvidence,old=p.oldTransaction;
 assert(e&&typeof e==='object'&&!Array.isArray(e),'Subscription evidence required');
 equal(Object.keys(e).sort(),['noticeId','previous','previousStatementId'].sort(),'Unexpected subscription evidence fields');
 assert(typeof e.previousStatementId==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(e.previousStatementId)&&e.previousStatementId!==p.statementId,'Two distinct statements required');
 assert(typeof e.noticeId==='string'&&/^[0-9a-f]{16}$/i.test(e.noticeId),'Valid service notice required');
 assert(p.currency==='CLP'&&old.amount%100===0&&p.newAmount%100===0,'Subscription correction requires whole CLP');
 const delta=Math.abs(p.newAmount-old.amount);
 assert(delta<=10000&&delta*20<=Math.abs(old.amount),'Subscription correction exceeds bounds');
 const prior=e.previous;
 assert(prior&&typeof prior.id==='string'&&prior.id!==old.id&&validDate(prior.date)&&validDate(old.date),'Invalid subscription snapshot');
 assert(month(old.date)-month(prior.date)===1&&old.date.slice(8)===prior.date.slice(8),'Subscription billing dates mismatch');
 assert(prior.account===old.account&&prior.payee===old.payee&&prior.category===old.category&&prior.amount===old.amount&&typeof old.notes==='string'&&old.notes.trim()&&prior.notes===old.notes,'Subscription identity mismatch');
 assert(!prior.is_parent&&!prior.is_child&&!prior.transfer_id&&!prior.tombstone&&!prior.starting_balance_flag,'Unsupported previous subscription');
 const found=s.transactions.filter(t=>t.id===prior.id);assert.equal(found.length,1,'Previous subscription missing or duplicated');equal(found[0],prior,'Previous subscription changed');
 for(const t of [old,prior])assert.equal(s.transactions.filter(x=>x.account===t.account&&x.payee===t.payee&&x.date===t.date&&!x.is_child&&!x.tombstone).length,1,'Ambiguous subscription day');
}

function validateImportedAuthorization(p,s){
 const e=p.importedAuthorizationEvidence,old=p.oldTransaction;
 assert(e&&typeof e==='object'&&!Array.isArray(e),'Imported authorization evidence required');
 const legacy=Object.hasOwn(e,'legacyMerchant');
 equal(Object.keys(e).sort(),['noticeId','orderId','finalReceiptId','receiptNumber','goodsAmount','serviceAmount',...(legacy?['legacyMerchant']:[])].sort(),'Unexpected imported evidence fields');
 const ids=[e.noticeId,e.orderId,e.finalReceiptId];
 assert(ids.every(x=>typeof x==='string'&&/^[0-9a-f]{16}$/i.test(x))&&new Set(ids.map(x=>x.toLowerCase())).size===3,'Three distinct Gmail sources required');
 assert(typeof old.imported_id==='string'&&/^YNABEXP:[A-F0-9]{20}$/.test(old.imported_id),'Unsupported import identity');
 assert.equal(s.transactions.filter(t=>t.imported_id===old.imported_id).length,1,'Import identity must be unique');
 assert(typeof e.receiptNumber==='string'&&/^\d{4,32}$/.test(e.receiptNumber)&&typeof old.notes==='string','Invalid receipt number or historical notes');
 if(!legacy)assert(old.notes.split(/\D+/).includes(e.receiptNumber),'Receipt number must identify historical notes');
 else {
  const merchant=e.legacyMerchant,payee=s.payees.find(x=>x.id===old.payee);
  assert(typeof merchant==='string'&&merchant.trim()===merchant&&merchant.length>=8&&old.notes.startsWith(merchant+';'),'Legacy merchant must identify original notes');
  assert(old.notes.includes('source=pedido/boleta/Banco de Chile')&&old.notes.includes('source=ynab-expense-cli'),'Legacy source provenance missing');
  assert(typeof old.imported_payee==='string'&&old.imported_payee.trim().length>=5&&typeof payee?.name==='string'&&payee.name.trim().toLowerCase()===old.imported_payee.trim().toLowerCase()&&merchant.toLowerCase().startsWith(old.imported_payee.trim().toLowerCase()+' '),'Legacy merchant and payee mismatch');
  assert(validDate(old.date),'Invalid authorization date');
  for(const t of s.transactions){
   if(t.id===old.id||t.account!==old.account||t.tombstone||t.is_child)continue;
   assert(!(t.date===old.date&&t.amount===old.amount),'Ambiguous authorization');
   if(validDate(t.date)&&Math.abs(Date.parse(t.date+'T12:00:00Z')-Date.parse(old.date+'T12:00:00Z'))<=3*86400000)assert(t.amount!==p.newAmount,'Competing settled charge');
  }
 }
 assert(p.currency==='CLP'&&old.amount%100===0&&p.newAmount%100===0,'Imported correction requires whole CLP');
 assert(Number.isSafeInteger(e.goodsAmount)&&e.goodsAmount>0&&e.goodsAmount%100===0&&Number.isSafeInteger(e.serviceAmount)&&e.serviceAmount>=0&&e.serviceAmount%100===0,'Invalid goods or service amount');
 const delta=Math.abs(p.newAmount-old.amount);
 assert(delta<=50000&&delta*20<=Math.abs(old.amount),'Imported correction exceeds bounds');
 assert(Number.isSafeInteger(e.goodsAmount+e.serviceAmount)&&Math.abs(-p.newAmount-e.goodsAmount-e.serviceAmount)<=100,'Final amount does not match goods and service');
}

export function classifyHistoricalAmount(p,s,ledger){
 const statementMode=Object.hasOwn(p,'statementSeries');
 const subscriptionMode=Object.hasOwn(p,'subscriptionEvidence');
 const providerMode=Object.hasOwn(p,'providerReceiptId');
 const importedMode=Object.hasOwn(p,'importedAuthorizationEvidence');
 assert([statementMode,subscriptionMode,providerMode,importedMode,Object.hasOwn(p,'receiptId')].filter(Boolean).length===1,'Exactly one evidence mode required');
 equal(Object.keys(p).sort(),['historicalExpenseAmountCorrection','currency','oldTransaction','newAmount','statementId',statementMode?'statementSeries':subscriptionMode?'subscriptionEvidence':providerMode?'providerReceiptId':importedMode?'importedAuthorizationEvidence':'receiptId','evidence'].sort(),'Unexpected candidate fields');
 assert.equal(p.historicalExpenseAmountCorrection,true,'Historical amount operation required');
 assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported currency');
 assert(typeof p.statementId==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(p.statementId),'Invalid statement ID');
 if(providerMode)assert(typeof p.providerReceiptId==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(p.providerReceiptId)&&p.providerReceiptId!==p.statementId,'Distinct valid provider receipt ID required');
 if(!statementMode&&!subscriptionMode&&!providerMode&&!importedMode)assert(typeof p.receiptId==='string'&&/^[0-9a-f]{16}$/i.test(p.receiptId),'Invalid Gmail receipt ID');
 assert(typeof p.evidence==='string'&&p.evidence.trim().length>=30,'Evidence required');
 const old=p.oldTransaction;
 assert(old&&typeof old.id==='string'&&typeof old.account==='string'&&typeof old.date==='string','Historical transaction required');
 assert(Number.isSafeInteger(old.amount)&&old.amount<0&&Number.isSafeInteger(p.newAmount)&&p.newAmount<0&&old.amount!==p.newAmount,'Different negative integer amount required');
 const installmentMode=statementMode||(typeof old.notes==='string'&&/#cuotas\b/i.test(old.notes));
 const saved=ledger.historicalExpenseAmountCorrections?.[old.id];
 if(saved){equal(saved.candidate,p,'Audit conflict');if(installmentMode){assert(saved.status===undefined||saved.status==='complete','Incomplete amount audit');assert(typeof saved.backup==='string'&&saved.backup.trim()&&typeof saved.verifiedAt==='string'&&Number.isFinite(Date.parse(saved.verifiedAt)),'Incomplete amount audit');}}
 if(statementMode)validateStatementSeries(p,s,ledger,saved);
 if(subscriptionMode)validateSubscriptionEvidence(p,s);
 if(importedMode)validateImportedAuthorization(p,s);
 assert(/^\d{4}-\d{2}-\d{2}$/.test(old.date)&&!Number.isNaN(Date.parse(old.date))&&new Date(old.date+'T12:00:00Z').toISOString().slice(0,10)===old.date,'Invalid transaction date');
 assert(!old.is_parent&&!old.is_child&&!old.parent_id&&!old.transfer_id&&!old.subtransactions?.length&&!old.reconciled&&!old.schedule&&(importedMode||!old.imported_id)&&!old.starting_balance_flag&&!old.tombstone,'Unsupported historical transaction');
 assert(typeof old.cleared==='boolean'&&old.category&&old.payee,'Cleared flag, category and payee required');
 assert(s.accounts.some(a=>a.id===old.account&&!a.closed&&!a.offbudget),'Account unavailable');
 assert(s.categories.some(c=>c.id===old.category),'Category unavailable');
 assert(s.payees.some(x=>x.id===old.payee&&!x.transfer_acct),'Payee unavailable');
 for(const x of Object.values(ledger.records??{}))assert(x.transactionId!==old.id,'Transaction belongs to source ledger');
 for(const x of Object.values(ledger.cashflows??{}))assert(x.id!==old.id&&x.counterpartId!==old.id,'Transaction belongs to cashflow ledger');
 const matches=s.transactions.filter(t=>t.id===old.id);assert.equal(matches.length,1,'Transaction is not unique');
 const audit=saved;
 if(audit){if(installmentMode)assertAuditedLineage(corrected(p),matches[0],ledger,p.currency,audit.verifiedAt,'Audited transaction differs');else equal(matches[0],corrected(p),'Audited transaction differs');return {action:'existing',id:old.id,oldAmount:old.amount,newAmount:p.newAmount};}
 equal(matches[0],old,'Transaction identity mismatch or unaudited previous write');
 return {action:'correct',id:old.id,oldAmount:old.amount,newAmount:p.newAmount,balanceDelta:p.newAmount-old.amount};
}

export async function correctHistoricalAmount(p,commit,d){
 assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported currency');
 let ledger=commit?await d.requireRun():await d.readState(),{api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir;
 try{
  before=await d.snapshot(api);action=classifyHistoricalAmount(p,before,ledger);
  if(!commit)return {...action,candidate:p};
  if(action.action==='existing')return {...action,verified:true,backup:ledger.historicalExpenseAmountCorrections[p.oldTransaction.id].backup};
  dir=await d.backup(api,p.currency,before);await d.json(dir+'/historical-amount-correction.json',{candidate:p});
  await api.sync();const latest=await d.snapshot(api);equal(latest,before,'Budget changed before correction');classifyHistoricalAmount(p,latest,await d.requireRun());
  await api.updateTransaction(p.oldTransaction.id,{amount:p.newAmount});
  let updated;for(let i=0;i<50;i++){updated=(await api.getTransactions(p.oldTransaction.account,p.oldTransaction.date,p.oldTransaction.date)).find(t=>t.id===p.oldTransaction.id);if(updated&&updated.amount===p.newAmount)break;await new Promise(r=>setTimeout(r,100));}
  equal(updated,corrected(p),'Updated transaction differs; inspect backup and live state');await api.sync();
 }finally{await api.shutdown();}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));
 try{
  const after=await d.snapshot(api),expected=structuredClone(before),old=p.oldTransaction;
  expected.transactions=expected.transactions.map(t=>t.id===old.id?corrected(p):t);expected.balances[old.account]+=p.newAmount-old.amount;
  const {transactions:at,...ar}=after,{transactions:bt,...br}=expected;equal(ar,br,'Unrelated state or balances changed');assert.equal(at.length,bt.length,'Transaction count changed');
  const byId=new Map(at.map(t=>[t.id,t]));assert.equal(byId.size,at.length,'Duplicate transaction ID');for(const t of bt)equal(byId.get(t.id),t,'Transaction differs');
  await d.json(dir+'/after.json',after);ledger=await d.requireRun();ledger.historicalExpenseAmountCorrections??={};assert(!ledger.historicalExpenseAmountCorrections[old.id],'Audit appeared concurrently');ledger.historicalExpenseAmountCorrections[old.id]={candidate:p,backup:dir,verifiedAt:new Date().toISOString()};await d.save(ledger);
  return {...action,verified:true,backup:dir};
 }finally{await api.shutdown();}
}
