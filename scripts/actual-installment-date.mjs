import assert from 'node:assert/strict';
import { BUDGETS } from './actual-daily-policy.mjs';
import {assertAuditedLineage} from './actual-installment-lineage.mjs';

const allowed = new Set(['historicalInstallmentDateCorrection','currency','oldTransaction','previous','previous2','next','next2','verifiedFinal',
  'number','total','newDate','statementFileId','purchaseMessageId','purchaseStatementFileId','preserveCleared','evidence']);
const canonical = x => Array.isArray(x) ? x.map(canonical) : x && typeof x === 'object' ?
  Object.fromEntries(Object.keys(x).sort().map(k => [k,canonical(x[k])])) : x;
const equal = (a,b,msg) => assert.deepEqual(canonical(a),canonical(b),msg);
const validDate = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  Number.isFinite(Date.parse(x+'T12:00:00Z')) && new Date(x+'T12:00:00Z').toISOString().slice(0,10) === x;
const month = x => Number(x.slice(0,4))*12+Number(x.slice(5,7));
function signature(t,n,total){
  assert(typeof t.notes === 'string' && /#cuotas\b/i.test(t.notes), 'Installment note missing');
  const re=new RegExp(`(?<!\\d)0?${n}/0?${total}(?!\\d)`,'g');
  assert.equal([...t.notes.matchAll(re)].length,1,'Installment number missing or ambiguous');
  return t.notes.replace(re,'<installment>');
}
export function classifyInstallmentDate(p,s,ledger){
  assert(p && p.historicalInstallmentDateCorrection===true,'Expected installment date correction');
  for(const key of Object.keys(p))assert(allowed.has(key),`Unexpected field ${key}`);
  assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported currency');
  for(const key of ['statementFileId','evidence'])assert(typeof p[key]==='string'&&p[key].trim(),`Missing ${key}`);
  assert(/^[A-Za-z0-9_-]{8,}$/.test(p.statementFileId),'Invalid statement ID');
  const hasMessage=Object.hasOwn(p,'purchaseMessageId'),hasStatement=Object.hasOwn(p,'purchaseStatementFileId');
  assert(hasMessage!==hasStatement,'Exactly one purchase evidence source is required');
  if(hasMessage)assert(typeof p.purchaseMessageId==='string'&&/^[a-f0-9]+$/.test(p.purchaseMessageId),'Invalid purchase message ID');
  else {
    assert(typeof p.purchaseStatementFileId==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(p.purchaseStatementFileId),'Invalid purchase statement ID');
    assert.notEqual(p.purchaseStatementFileId,p.statementFileId,'Purchase and target statements must differ');
  }
  assert(Number.isInteger(p.number)&&Number.isInteger(p.total)&&p.number>=1&&p.number<=p.total&&p.total<=120,'Invalid installment number');
  const first=p.number===1,terminal=p.number===p.total,verified=Object.hasOwn(p,'verifiedFinal');
  let peers,peerNumbers;
  if(first){assert(p.total>=3&&!terminal&&!verified&&!Object.hasOwn(p,'previous')&&!Object.hasOwn(p,'previous2')&&Object.hasOwn(p,'next')&&Object.hasOwn(p,'next2'),'Invalid first neighbors');peers=[p.next,p.next2];peerNumbers=[2,3];}
  else if(verified){assert(p.total>=3&&p.number===p.total-1&&!Object.hasOwn(p,'next')&&!Object.hasOwn(p,'next2')&&Object.hasOwn(p,'previous')&&Object.hasOwn(p,'previous2'),'Invalid verified final neighbors');peers=[p.previous,p.previous2,p.verifiedFinal?.transaction];peerNumbers=[p.number-1,p.number-2,p.total];}
  else if(terminal){assert(p.total>=3&&!Object.hasOwn(p,'next')&&!Object.hasOwn(p,'next2')&&Object.hasOwn(p,'previous2'),'Invalid terminal neighbors');peers=[p.previous,p.previous2];peerNumbers=[p.number-1,p.number-2];}
  else {assert(!Object.hasOwn(p,'previous2')&&!Object.hasOwn(p,'next2')&&Object.hasOwn(p,'next'),'Invalid intermediate neighbors');peers=[p.previous,p.next];peerNumbers=[p.number-1,p.number+1];}
  const old=p.oldTransaction;
  for(const t of [old,...peers])assert(t&&typeof t.id==='string'&&validDate(t.date),'Invalid transaction snapshot');
  assert(new Set([old,...peers].map(t=>t.id)).size===1+peers.length,'Series identities overlap');
  assert(validDate(p.newDate)&&p.newDate!==old.date,'Invalid new date');
  for(let i=0;i<peers.length;i++)assert.equal(month(peers[i].date)-month(p.newDate),peerNumbers[i]-p.number,'Neighbor billing month mismatch');
  assert(old.amount<0&&Number.isSafeInteger(old.amount),'Invalid installment amount');
  assert(!old.is_parent&&!old.is_child&&!old.parent_id&&!old.transfer_id&&!old.schedule&&!old.reconciled&&!old.imported_id&&!old.subtransactions?.length,'Target is not a simple unreconciled historical expense');
  assert(typeof old.cleared==='boolean','Cleared status must be explicit');
  if(old.cleared){
    assert(old.reconciled===false&&p.preserveCleared===true&&hasMessage,'Cleared correction requires explicit unreconciled status, preservation and a purchase message');
    assert(month(old.date)===month(p.newDate)&&Math.abs(Date.parse(old.date+'T12:00:00Z')-Date.parse(p.newDate+'T12:00:00Z'))===86400000,'Cleared correction must move exactly one day in the same month');
  }else assert(!Object.hasOwn(p,'preserveCleared'),'Cleared preservation flag is only valid for cleared targets');
  assert(s.accounts.some(x=>x.id===old.account&&!x.closed&&!x.offbudget),'Account unavailable');
  assert(s.payees.some(x=>x.id===old.payee&&!x.transfer_acct),'Payee unavailable');
  assert(s.categories.some(x=>x.id===old.category),'Category unavailable');
  for(const peer of peers)assert(peer.account===old.account&&peer.payee===old.payee&&peer.category===old.category&&!peer.is_parent&&!peer.is_child&&!peer.transfer_id,'Neighbor identity mismatch');
  const sig=signature(old,p.number,p.total);
  for(let i=0;i<peers.length;i++){
    const psig=signature(peers[i],peerNumbers[i],p.total);
    if(!verified||i!==2)assert.equal(psig,sig,'Neighbor series mismatch');
  }
  if(verified){
    const v=p.verifiedFinal,final=peers[2],rec=ledger.records?.[final.imported_id],payee=s.payees.find(x=>x.id===old.payee);
    equal(Object.keys(v).sort(),['transaction','statementFileId','seriesLabel'].sort(),'Unexpected final evidence fields');
    assert(typeof v.statementFileId==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(v.statementFileId)&&v.statementFileId!==p.statementFileId&&(!hasStatement||v.statementFileId!==p.purchaseStatementFileId),'Distinct final statement required');
    assert(typeof v.seriesLabel==='string'&&v.seriesLabel.trim()===v.seriesLabel&&v.seriesLabel.length>=8&&old.notes.includes(v.seriesLabel)&&final.notes.includes(v.seriesLabel),'Distinctive shared series label required');
    assert(Number.isSafeInteger(final.amount)&&final.amount<0&&typeof final.imported_id==='string'&&final.imported_id.startsWith('statement:')&&s.transactions.filter(t=>t.imported_id===final.imported_id).length===1&&final.notes.split('\n').includes('https://drive.google.com/file/d/'+v.statementFileId+'/view'),'Final statement provenance missing');
    assert(rec&&rec.transactionId===final.id&&rec.currency===p.currency&&rec.account===final.account&&rec.date===final.date&&rec.amount===final.amount&&rec.payee===payee?.name&&rec.category===final.category&&rec.sourceType==='bank-statement'&&rec.status==='registered'&&rec.verifiedAt&&rec.backup&&Array.isArray(rec.sourceIds)&&rec.sourceIds.length===1&&rec.sourceIds[0]===final.imported_id,'Final ledger evidence mismatch');
  }
  const audit=ledger.historicalInstallmentDateCorrections?.[old.id];
  if(audit?.status==='pending')throw Error('Pending date correction requires manual investigation');
  if(audit){assert.equal(audit.status,'complete','Invalid audit status');equal(audit.candidate,p,'Audit candidate mismatch');assert(typeof audit.backup==='string'&&audit.backup.trim()&&typeof audit.verifiedAt==='string'&&Number.isFinite(Date.parse(audit.verifiedAt)),'Incomplete date audit');}
  for(const peer of peers){const found=s.transactions.filter(t=>t.id===peer.id);assert.equal(found.length,1);
    if(audit)assertAuditedLineage(peer,found[0],ledger,p.currency,audit.verifiedAt,'Neighbor changed');
    else equal(found[0],peer,'Neighbor changed');}
  for(const record of Object.values(ledger.records??{}))assert.notEqual(record.transactionId,old.id,'Target belongs to source ledger');
  for(const record of Object.values(ledger.cashflows??{}))assert(![record.id,record.counterpartId].includes(old.id),'Target belongs to cashflow ledger');
  const found=s.transactions.filter(t=>t.id===old.id);assert.equal(found.length,1,'Target missing or duplicated');
  const target=found[0];
  if(audit){assertAuditedLineage({...old,date:p.newDate},target,ledger,p.currency,audit.verifiedAt,'Corrected transaction differs');return {action:'existing',id:old.id,oldDate:old.date,newDate:p.newDate};}
  if(target.date===p.newDate)throw Error('Changed date without completed audit');
  assert(!audit,'Existing audit conflicts with old date');equal(target,old,'Target changed');
  assert(!s.transactions.some(t=>t.id!==old.id&&t.account===old.account&&t.payee===old.payee&&t.date===p.newDate&&
    typeof t.notes==='string'&&t.notes===old.notes),'Possible duplicate target installment');
  return {action:'amend-date',id:old.id,oldDate:old.date,newDate:p.newDate};
}
export async function amendInstallmentDate(p,commit,d){
  assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported currency');let ledger=commit?await d.requireRun():await d.readState();
  let {api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir;
  try{
    before=await d.snapshot(api);action=classifyInstallmentDate(p,before,ledger);
    if(!commit)return {...action,candidate:p};
    if(action.action==='existing')return {...action,verified:true,backup:ledger.historicalInstallmentDateCorrections[p.oldTransaction.id].backup};
    dir=await d.backup(api,p.currency,before);await d.json(dir+'/installment-date-correction.json',{candidate:p});
    await api.sync();equal(await d.snapshot(api),before,'Budget changed before correction');
    ledger=await d.requireRun();classifyInstallmentDate(p,before,ledger);ledger.historicalInstallmentDateCorrections??={};
    ledger.historicalInstallmentDateCorrections[p.oldTransaction.id]={status:'pending',candidate:p,backup:dir};await d.save(ledger);
    await api.updateTransaction(p.oldTransaction.id,{date:p.newDate});
    let ready=false;
    for(let i=0;i<30;i++){const state=await d.snapshot(api),target=state.transactions.find(t=>t.id===p.oldTransaction.id);
      if(target?.date===p.newDate){equal(target,{...p.oldTransaction,date:p.newDate},'Target changed unexpectedly');ready=true;break}
      await new Promise(resolve=>setTimeout(resolve,200));}
    assert(ready,'Date update incomplete; inspect source and backup');await api.sync();
  }finally{await api.shutdown()}
  ({api}=await d.connect(BUDGETS[p.currency].syncId));
  try{
    const after=await d.snapshot(api),byId=new Map(after.transactions.map(t=>[t.id,t]));
    assert.equal(after.transactions.length,before.transactions.length,'Unexpected transaction count');
    assert.equal(byId.size,after.transactions.length,'Duplicate transaction IDs');
    for(const t of before.transactions)equal(byId.get(t.id),t.id===p.oldTransaction.id?{...t,date:p.newDate}:t,'Transaction changed unexpectedly');
    for(const key of Object.keys(before).filter(k=>k!=='transactions'))equal(after[key],before[key],`Unrelated ${key} changed`);
    await d.json(dir+'/after.json',after);ledger=await d.requireRun();
    const audit=ledger.historicalInstallmentDateCorrections?.[p.oldTransaction.id];assert.equal(audit?.status,'pending');equal(audit.candidate,p,'Pending audit changed');
    audit.status='complete';audit.verifiedAt=new Date().toISOString();await d.save(ledger);
    assert.equal(classifyInstallmentDate(p,after,ledger).action,'existing');
    return {...action,verified:true,backup:dir};
  }finally{await api.shutdown()}
}
