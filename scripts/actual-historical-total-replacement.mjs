import assert from 'node:assert/strict';
import { BUDGETS } from './actual-daily-policy.mjs';

const canonical = x => Array.isArray(x) ? x.map(canonical) : x && typeof x === 'object' ?
  Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])) : x;
const equal = (a,b,message) => assert.deepEqual(canonical(a),canonical(b),message);
const validDate = x => typeof x === 'string' && /^\d{4}-\d\d-\d\d$/.test(x) &&
  Number.isFinite(Date.parse(x+'T12:00:00Z')) && new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const month = x => Number(x.slice(0,4))*12+Number(x.slice(5,7));
const fields = new Set(['historicalCardTotalReplacement','currency','oldTransaction','purchaseMessageId','evidence','installments','categoryReason','receiptInstallmentEvidence','financedPurchase','userConfirmedFinancing']);

export function classifyReplacement(p,s,ledger,asOf){
  assert.equal(p?.historicalCardTotalReplacement,true,'Expected replacement');
  for(const key of Object.keys(p))assert(fields.has(key),'Unexpected candidate field');
  assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported budget');
  assert(validDate(asOf),'Invalid current date');
  const confirmed=p.userConfirmedFinancing, financed=p.financedPurchase??confirmed;
  assert(!(p.financedPurchase!==undefined&&confirmed!==undefined),'Mixed financed evidence');
  if(financed===undefined)assert(/^[a-f0-9]+$/.test(p.purchaseMessageId),'Invalid purchase evidence');
  else assert(p.purchaseMessageId===undefined&&p.receiptInstallmentEvidence===undefined,'Mixed purchase evidence');
  assert(typeof p.evidence==='string'&&p.evidence.trim(),'Missing evidence');
  const old=p.oldTransaction;
  assert(old&&typeof old.id==='string'&&old.id&&validDate(old.date),'Invalid original');
  assert(Number.isSafeInteger(old.amount)&&old.amount<0,'Invalid original amount');
  assert(typeof old.notes==='string'&&old.notes.trim(),'Original notes missing');
  assert(!old.is_parent&&!old.is_child&&!old.parent_id&&!old.transfer_id&&!old.schedule&&!old.reconciled&&!old.cleared&&!old.imported_id&&!old.starting_balance_flag&&!old.tombstone&&!old.error&&!old.subtransactions?.length,'Original not simple and unreconciled');
  assert(s.accounts.some(x=>x.id===old.account&&!x.closed&&!x.offbudget),'Account unavailable');
  assert(s.payees.some(x=>x.id===old.payee&&!x.transfer_acct),'Payee unavailable');
  if(old.category!=null)assert(s.categories.some(x=>x.id===old.category&&!x.hidden&&!x.is_income),'Category unavailable');
  else assert(typeof p.categoryReason==='string'&&p.categoryReason.trim(),'Missing category reason');
  assert(Array.isArray(p.installments)&&p.installments.length>=2&&p.installments.length<=99,'Incomplete series');
  if(financed!==undefined){
    assert(financed&&typeof financed==='object'&&!Array.isArray(financed),'Invalid financed evidence');
    equal(Object.keys(financed).sort(),[...(confirmed?['confirmationRef','confirmationDate']:['receiptFileId']),'transactionId','account','purchaseDate','amount','cardLast4','installmentCount','financeCost'].sort(),'Unexpected financed evidence fields');
    if(confirmed){assert(typeof confirmed.confirmationRef==='string'&&/^call_[a-zA-Z0-9]{16,}$/.test(confirmed.confirmationRef),'Invalid confirmation reference');assert(validDate(confirmed.confirmationDate)&&confirmed.confirmationDate<=asOf,'Invalid confirmation date');}
    else assert(typeof financed.receiptFileId==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(financed.receiptFileId),'Invalid Drive receipt');
    assert.equal(financed.transactionId,old.id,'Financed transaction mismatch');
    assert.equal(financed.account,old.account,'Financed account mismatch');
    assert.equal(financed.purchaseDate,old.date,'Financed date mismatch');
    assert.equal(financed.amount,old.amount,'Financed amount mismatch');
    assert(typeof financed.cardLast4==='string'&&/^\d{4}$/.test(financed.cardLast4),'Invalid card suffix');
    assert.equal(financed.installmentCount,p.installments.length,'Financed installment count mismatch');
    assert(Number.isSafeInteger(financed.financeCost)&&financed.financeCost>0,'Invalid financing cost');
  }
  const receipt=p.receiptInstallmentEvidence;
  if(receipt!==undefined){
    assert(receipt&&typeof receipt==='object'&&!Array.isArray(receipt),'Invalid receipt declaration');
    equal(Object.keys(receipt).sort(),['transactionId','account','purchaseDate','amount','messageId','cardLast4','installmentCount'].sort(),'Unexpected receipt fields');
    assert.equal(receipt.transactionId,old.id,'Receipt transaction mismatch');
    assert.equal(receipt.account,old.account,'Receipt account mismatch');
    assert.equal(receipt.purchaseDate,old.date,'Receipt date mismatch');
    assert.equal(receipt.amount,old.amount,'Receipt amount mismatch');
    assert.equal(receipt.messageId,p.purchaseMessageId,'Receipt message mismatch');
    assert(typeof receipt.cardLast4==='string'&&/^\d{4}$/.test(receipt.cardLast4),'Invalid card suffix');
    assert.equal(receipt.installmentCount,p.installments.length,'Receipt installment count mismatch');
  }
  assert(/#cuotas\b/i.test(old.notes)||receipt!==undefined||financed!==undefined,'Original installment tag or receipt declaration missing');
  const sources=new Set(),statements=new Set();let sum=0, first;
  for(const [i,x] of p.installments.entries()){
    equal(Object.keys(x).sort(),['number','date','amount','statementId','sourceId'].sort(),'Unexpected installment fields');
    assert.equal(x.number,i+1,'Nonconsecutive installment number');
    assert(validDate(x.date),'Invalid installment date');
    assert(x.date<=asOf,'Future installment cannot be posted');
    if(i===0){first=month(x.date);assert(first-month(old.date)>=0&&first-month(old.date)<=1,'First installment month conflicts');}
    assert.equal(month(x.date),first+i,'Nonconsecutive billing month');
    assert(Number.isSafeInteger(x.amount)&&x.amount<0,'Invalid installment amount');sum+=x.amount;
    assert(/^[A-Za-z0-9_-]{8,}$/.test(x.statementId)&&!statements.has(x.statementId),'Invalid or repeated statement');statements.add(x.statementId);
    assert(/^bank:[A-Za-z0-9:_-]+$/.test(x.sourceId)&&!sources.has(x.sourceId),'Invalid or repeated source');sources.add(x.sourceId);
  }
  assert.equal(sum,old.amount-(financed?.financeCost??0),'Installments differ from evidenced total');
  for(const r of Object.values(ledger.records??{}))assert.notEqual(r.transactionId,old.id,'Original belongs to ledger');
  for(const r of Object.values(ledger.cashflows??{}))assert(![r.id,r.counterpartId].includes(old.id),'Original belongs to ledger');
  const audit=ledger.historicalCardTotalReplacements?.[old.id];
  if(audit?.status==='pending')throw Error('Pending replacement requires manual investigation');
  if(audit){
    assert.equal(audit.status,'complete','Unexpected audit status');assert(audit.backup&&audit.verifiedAt,'Verified audit incomplete');equal(audit.candidate,p,'Audit candidate mismatch');
    assert(Array.isArray(audit.transactions)&&audit.transactions.length===p.installments.length,'Audit series missing');
    assert(Array.isArray(audit.ids)&&audit.ids.length===audit.transactions.length&&new Set(audit.ids).size===audit.ids.length&&audit.ids[0]===old.id,'Audit IDs invalid');
    for(const [i,t] of audit.transactions.entries()){
      assert.equal(t.id,audit.ids[i],'Audit series ID mismatch');
      const live=s.transactions.filter(x=>x.id===t.id);assert.equal(live.length,1,'Audit series missing');equal(live[0],t,'Audited transaction changed');
    }
    return {action:'existing',id:old.id,ids:audit.ids};
  }
  const found=s.transactions.filter(t=>t.id===old.id);assert.equal(found.length,1,'Original missing');equal(found[0],old,'Original changed');
  for(const x of p.installments){
    assert(!s.transactions.some(t=>t.id!==old.id&&(t.imported_id===x.sourceId||
      (t.account===old.account&&t.amount===x.amount&&Math.abs(Date.parse(t.date)-Date.parse(x.date))<=4*86400000))), 'Possible duplicate installment');
    assert(!(s.schedules??[]).some(t=>t.account===old.account&&t.payee===old.payee&&t.amount===x.amount&&
      validDate(t.next_date??t.date)&&Math.abs(Date.parse(t.next_date??t.date)-Date.parse(x.date))<=4*86400000),'Possible duplicate schedule');
    assert(!ledger.cashflows?.[x.sourceId],'Installment source already owned');
    assert(!ledger.records?.[x.sourceId],'Installment source already owned');
  }
  return {action:'replace',id:old.id,...(financed?{balanceDelta:-financed.financeCost}:{}),...(old.category==null?{label:'Actual/Review'}:{})};
}

const installmentNotes=(p,x)=>{const financing=p.financedPurchase??p.userConfirmedFinancing;const evidence=p.userConfirmedFinancing?'Confirmación directa del usuario '+p.userConfirmedFinancing.confirmationDate+'; referencia '+p.userConfirmedFinancing.confirmationRef:p.financedPurchase?'https://drive.google.com/file/d/'+p.financedPurchase.receiptFileId+'/view':'https://mail.google.com/mail/u/0/#all/'+p.purchaseMessageId;return `${p.oldTransaction.notes}\nCuota ${x.number}/${p.installments.length}; compra original ${p.oldTransaction.date}.${financing?' Costo financiero de la serie: '+financing.financeCost/100+' '+p.currency+'; no distribuido por cuota.':''}${p.oldTransaction.category==null?'\nCategoría pendiente: '+p.categoryReason:''}\n${evidence}\nhttps://drive.google.com/file/d/${x.statementId}/view\nsource=${x.sourceId}`;};

export async function replaceHistoricalTotal(p,commit,d){
  assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported budget');
  let ledger=commit?await d.requireRun():await d.readState();
  let {api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir;
  try{
    before=await d.snapshot(api);action=classifyReplacement(p,before,ledger,d.today());
    if(!commit)return {...action,candidate:p};
    if(action.action==='existing')return {...action,verified:true,backup:ledger.historicalCardTotalReplacements[p.oldTransaction.id].backup};
    dir=await d.backup(api,p.currency,before);await d.json(dir+'/historical-card-total-replacement.json',{candidate:p});
    await api.sync();equal(await d.snapshot(api),before,'Budget changed before replacement');
    ledger=await d.requireRun();classifyReplacement(p,before,ledger,d.today());ledger.historicalCardTotalReplacements??={};
    ledger.historicalCardTotalReplacements[p.oldTransaction.id]={status:'pending',candidate:p,backup:dir};await d.save(ledger);
    const first=p.installments[0],updated={date:first.date,amount:first.amount,notes:installmentNotes(p,first),imported_id:first.sourceId};
    await api.updateTransaction(p.oldTransaction.id,updated);
    let ready=false;
    for(let i=0;i<30;i++){
      const state=await d.snapshot(api),t=state.transactions.find(x=>x.id===p.oldTransaction.id);
      if(t?.date===first.date&&t.amount===first.amount&&t.notes===updated.notes&&t.imported_id===first.sourceId){equal(t,{...p.oldTransaction,...updated},'Original changed unexpectedly');ready=true;break;}
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    assert(ready,'Original update incomplete; inspect pending audit and backup');
    await d.requireRun();
    const rest=p.installments.slice(1).map(x=>({date:x.date,amount:x.amount,payee:p.oldTransaction.payee,
      category:p.oldTransaction.category??null,imported_id:x.sourceId,notes:installmentNotes(p,x),cleared:false}));
    await api.addTransactions(p.oldTransaction.account,rest,{runTransfers:false,learnCategories:false});
    await api.sync();
  }finally{await api.shutdown();}
  ({api}=await d.connect(BUDGETS[p.currency].syncId));
  try{
    const after=await d.snapshot(api),old=p.oldTransaction,first=p.installments[0],ids=[old.id],transactions=[];
    const initial=after.transactions.filter(t=>t.id===old.id);assert.equal(initial.length,1,'Updated original missing');
    equal(initial[0],{...old,date:first.date,amount:first.amount,notes:installmentNotes(p,first),imported_id:first.sourceId},'Original differs');transactions.push(initial[0]);
    for(const x of p.installments.slice(1)){
      const found=after.transactions.filter(t=>t.imported_id===x.sourceId);assert.equal(found.length,1,'Installment missing or duplicated');
      const t=found[0];assert(t.id!==old.id&&!ids.includes(t.id),'Duplicate ID');
      assert.equal(t.account,old.account);assert.equal(t.payee,old.payee);assert.equal(t.category??null,old.category??null);
      assert.equal(t.date,x.date);assert.equal(t.amount,x.amount);assert.equal(t.notes,installmentNotes(p,x));
      assert(!t.transfer_id&&!t.is_parent&&!t.is_child&&!t.parent_id&&!t.schedule&&!t.reconciled&&!t.cleared,'Unexpected installment status');
      ids.push(t.id);transactions.push(t);
    }
    assert.equal(after.transactions.length,before.transactions.length+p.installments.length-1,'Unexpected transaction count');
    const byId=new Map(after.transactions.map(t=>[t.id,t]));assert.equal(byId.size,after.transactions.length,'Duplicate IDs');
    for(const t of before.transactions)if(t.id!==old.id)equal(byId.get(t.id),t,'Unrelated transaction changed');
    for(const key of Object.keys(before).filter(k=>k!=='transactions'&&k!=='balances'))equal(after[key],before[key],`Unrelated ${key} changed`);
    const expectedBalances=structuredClone(before.balances);
    assert(Number.isSafeInteger(expectedBalances[old.account]),'Original account balance unavailable');
    expectedBalances[old.account]-=(p.financedPurchase??p.userConfirmedFinancing)?.financeCost??0;
    assert(Number.isSafeInteger(expectedBalances[old.account]),'Expected account balance invalid');
    equal(after.balances,expectedBalances,'Unexpected account balances changed');
    await d.json(dir+'/after.json',after);ledger=await d.requireRun();const audit=ledger.historicalCardTotalReplacements?.[old.id];
    assert.equal(audit?.status,'pending');equal(audit.candidate,p,'Pending audit changed');
    Object.assign(audit,{status:'complete',ids,transactions,verifiedAt:new Date().toISOString()});
    assert.equal(classifyReplacement(p,after,ledger,d.today()).action,'existing');await d.save(ledger);
    return {action:'replace',id:old.id,ids,verified:true,backup:dir};
  }finally{await api.shutdown();}
}
