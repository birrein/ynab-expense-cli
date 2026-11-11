import test from 'node:test';
import assert from 'node:assert/strict';

const subject = () => import('./actual-historical-total-replacement.mjs');
const fixture = () => {
  const old = {id:'original',account:'a',payee:'p',category:'c',amount:-9999000,date:'2025-10-08',
    notes:'#cuotas Camera 3cpc',imported_id:null,is_parent:false,is_child:false,parent_id:null,
    transfer_id:null,schedule:null,reconciled:false,cleared:false,subtransactions:[]};
  const installments = ['2025-10-19','2025-11-19','2025-12-19'].map((date,i)=>({
    number:i+1,date,amount:-3333000,statementId:`statement_${i+1}`,sourceId:`bank:test:camera:${i+1}`}));
  return {p:{historicalCardTotalReplacement:true,currency:'CLP',oldTransaction:old,
    purchaseMessageId:'abcd1234',evidence:'Three inspected statements and purchase receipt identify one camera.',installments},
    s:{accounts:[{id:'a',closed:false,offbudget:false}],payees:[{id:'p',name:'Seller',transfer_acct:null}],
      categories:[{id:'c',hidden:false,is_income:false}],transactions:[structuredClone(old)],rules:[],schedules:[],balances:{a:-9999000}}};
};

test('previews a complete exact series without mutation',async()=>{
  const {classifyReplacement}=await subject(),{p,s}=fixture(),before=structuredClone(s);
  assert.equal(classifyReplacement(p,s,{},'2026-11-05').action,'replace');assert.deepEqual(s,before);
});
function untaggedFixture(){
  const {p,s}=fixture();
  p.oldTransaction.notes='Camera and accessories';s.transactions[0].notes=p.oldTransaction.notes;
  p.receiptInstallmentEvidence={transactionId:p.oldTransaction.id,account:p.oldTransaction.account,
    purchaseDate:p.oldTransaction.date,amount:p.oldTransaction.amount,messageId:p.purchaseMessageId,
    cardLast4:'1348',installmentCount:p.installments.length};
  return {p,s};
}
test('previews an untagged original when exact receipt evidence and statements are supplied',async()=>{
  const {classifyReplacement}=await subject(),{p,s}=untaggedFixture(),before=structuredClone(s);
  assert.equal(classifyReplacement(p,s,{},'2026-11-05').action,'replace');assert.deepEqual(s,before);
});
test('rejects missing or inconsistent receipt declarations even for tagged originals',async()=>{
  const {classifyReplacement}=await subject();
  for(const change of [
    p=>delete p.receiptInstallmentEvidence,
    p=>delete p.receiptInstallmentEvidence.transactionId,
    p=>p.receiptInstallmentEvidence.transactionId='another',
    p=>p.receiptInstallmentEvidence.account='another',
    p=>p.receiptInstallmentEvidence.purchaseDate='2025-10-09',
    p=>p.receiptInstallmentEvidence.amount++,
    p=>p.receiptInstallmentEvidence.messageId='9876',
    p=>p.receiptInstallmentEvidence.cardLast4='348',
    p=>p.receiptInstallmentEvidence.installmentCount=2,
    p=>p.receiptInstallmentEvidence.extra=true,
    p=>{p.oldTransaction.notes='#cuotas';p.receiptInstallmentEvidence.account='another'}
  ]){const {p,s}=untaggedFixture();change(p);s.transactions[0].notes=p.oldTransaction.notes;assert.throws(()=>classifyReplacement(p,s,{},'2026-11-05'));}
});
test('rejects incomplete or inconsistent evidence, ownership and possible duplicates',async()=>{
  const {classifyReplacement}=await subject();
  for(const change of [
    p=>p.installments.pop(), p=>p.installments[1].amount++, p=>p.installments[1].statementId=p.installments[0].statementId,
    p=>p.installments[1].sourceId=p.installments[0].sourceId, p=>p.installments[1].date='2026-01-19',
    p=>p.installments[2].date='2027-01-19',
    p=>p.oldTransaction.cleared=true, p=>p.oldTransaction.is_parent=true,
    (p,s)=>{s.transactions[0].amount++}, (p,s)=>s.transactions.push({...structuredClone(p.oldTransaction),id:'duplicate',date:p.installments[1].date,amount:p.installments[1].amount}),
    (p,s)=>s.schedules.push({account:'a',payee:'p',amount:-3333000,next_date:p.installments[1].date}),
    (p,s,l)=>{l.records={[p.installments[0].sourceId]:{transactionId:'other'}}},
    (p,s,l)=>{l.records={x:{transactionId:'original'}}},
    (p,s,l)=>{l.historicalCardTotalReplacements={original:{status:'pending'}}}
  ]){const {p,s}=fixture(),ledger={};change(p,s,ledger);assert.throws(()=>classifyReplacement(p,s,ledger,'2026-11-05'));}
});
test('a completed audit without the complete matching series is rejected',async()=>{
  const {classifyReplacement}=await subject(),{p,s}=fixture();
  const ledger={historicalCardTotalReplacements:{original:{status:'complete',candidate:structuredClone(p),ids:['original','two','three'],transactions:[]}}};
  assert.throws(()=>classifyReplacement(p,s,ledger,'2026-11-05'),/audit|series/i);
});
test('does not post an otherwise valid future installment',async()=>{
  const {classifyReplacement}=await subject(),{p,s}=fixture();
  assert.throws(()=>classifyReplacement(p,s,{},'2025-11-19'),/future/i);
});
test('uncategorized originals require an explicit reason',async()=>{
  const {classifyReplacement}=await subject(),{p,s}=fixture();
  p.oldTransaction.category=null;s.transactions[0].category=null;
  assert.throws(()=>classifyReplacement(p,s,{},'2026-11-05'),/reason/i);
  p.categoryReason='Product details not yet known';
  assert.equal(classifyReplacement(p,s,{},'2026-11-05').action,'replace');
});

function runtime(s){
  let live=structuredClone(s),state={},writes=0,backups=0,fail=false,corrupt=false;
  const api={sync:async()=>{},shutdown:async()=>{},
    updateTransaction:async(id,fields)=>{writes++;Object.assign(live.transactions.find(t=>t.id===id),fields);if(fail)throw Error('interrupted')},
    addTransactions:async(account,items)=>{for(const item of items){writes++;live.transactions.push({id:`new-${writes}`,account,...item,
      is_parent:false,is_child:false,parent_id:null,transfer_id:null,schedule:null,reconciled:false,subtransactions:[]})}if(corrupt)live.rules.push({id:'unexpected'})},
    getTransactions:async(account,from,to)=>live.transactions.filter(t=>t.account===account&&t.date>=from&&t.date<=to)};
  const d={connect:async()=>({api}),snapshot:async()=>structuredClone(live),readState:async()=>structuredClone(state),
    requireRun:async()=>structuredClone(state),save:async x=>{state=structuredClone(x)},backup:async()=>{backups++;return '/backup'},json:async()=>{},today:()=> '2026-11-05'};
  return {d,get state(){return state},get live(){return live},get writes(){return writes},get backups(){return backups},interrupt(){fail=true},corrupt(){corrupt=true}};
}
test('writes one replacement series, verifies it and retries without writing',async()=>{
  const {replaceHistoricalTotal}=await subject(),{p,s}=fixture(),x=runtime(s);
  const preview=await replaceHistoricalTotal(p,false,x.d);assert.equal(preview.action,'replace');assert.equal(x.writes,0);
  const result=await replaceHistoricalTotal(p,true,x.d);assert.equal(result.verified,true);assert.equal(x.writes,3);assert.equal(x.backups,1);
  assert.equal(x.live.transactions.length,3);assert.equal(x.live.transactions[0].id,'original');
  assert.equal(x.live.transactions[0].imported_id,p.installments[0].sourceId);
  assert.equal(x.live.transactions.reduce((n,t)=>n+t.amount,0),p.oldTransaction.amount);
  assert.equal((await replaceHistoricalTotal(p,true,x.d)).action,'existing');assert.equal(x.writes,3);
});
test('untagged receipt-backed replacement preserves original description without inventing tags',async()=>{
  const {replaceHistoricalTotal}=await subject(),{p,s}=untaggedFixture(),x=runtime(s);
  const result=await replaceHistoricalTotal(p,true,x.d);
  assert.equal(result.verified,true);assert.equal(x.live.transactions.length,3);
  for(const t of x.live.transactions){assert(t.notes.startsWith('Camera and accessories\n'));assert(!t.notes.includes('#cuotas'));}
  assert.equal((await replaceHistoricalTotal(p,true,x.d)).action,'existing');assert.equal(x.writes,3);
});
test('interruption leaves pending audit and blocks any automatic retry',async()=>{
  const {replaceHistoricalTotal}=await subject(),{p,s}=fixture(),x=runtime(s);x.interrupt();
  await assert.rejects(()=>replaceHistoricalTotal(p,true,x.d),/interrupted/);
  assert.equal(x.state.historicalCardTotalReplacements.original.status,'pending');
  await assert.rejects(()=>replaceHistoricalTotal(p,true,x.d),/pending/i);assert.equal(x.writes,1);
});
test('independent verification failure remains pending and blocks retry',async()=>{
  const {replaceHistoricalTotal}=await subject(),{p,s}=fixture(),x=runtime(s);x.corrupt();
  await assert.rejects(()=>replaceHistoricalTotal(p,true,x.d),/Unrelated rules changed/);
  assert.equal(x.state.historicalCardTotalReplacements.original.status,'pending');
  await assert.rejects(()=>replaceHistoricalTotal(p,true,x.d),/pending/i);assert.equal(x.writes,3);
});

function financedFixture(){
  const {p,s}=fixture();
  p.oldTransaction.notes='Cycling lights';s.transactions[0].notes=p.oldTransaction.notes;
  delete p.purchaseMessageId;
  p.financedPurchase={receiptFileId:'receipt_image_123',transactionId:p.oldTransaction.id,account:p.oldTransaction.account,
    purchaseDate:p.oldTransaction.date,amount:p.oldTransaction.amount,cardLast4:'1348',installmentCount:3,financeCost:30000};
  for(const i of p.installments)i.amount-=10000;
  return {p,s};
}
test('previews financed purchase with exact Drive evidence and positive difference',async()=>{
  const {classifyReplacement}=await subject(),{p,s}=financedFixture();
  const r=classifyReplacement(p,s,{},'2026-11-05');assert.equal(r.action,'replace');assert.equal(r.balanceDelta,-30000);
});
test('rejects fabricated or inconsistent financed evidence and partial amount',async()=>{
  const {classifyReplacement}=await subject();
  for(const change of [
    p=>delete p.financedPurchase.receiptFileId,p=>p.financedPurchase.receiptFileId='x',
    p=>p.financedPurchase.transactionId='other',p=>p.financedPurchase.account='other',
    p=>p.financedPurchase.purchaseDate='2025-10-09',p=>p.financedPurchase.amount++,
    p=>p.financedPurchase.cardLast4='123',p=>p.financedPurchase.installmentCount=2,
    p=>p.financedPurchase.financeCost=0,p=>p.financedPurchase.financeCost=-30000,
    p=>p.financedPurchase.financeCost++,p=>p.financedPurchase.extra=true,
    p=>p.purchaseMessageId='abcd1234',p=>p.installments[2].amount++
  ]){const {p,s}=financedFixture();change(p);assert.throws(()=>classifyReplacement(p,s,{},'2026-11-05'));}
});

test('commits financed replacement and checks exact account delta with idempotent retry',async()=>{
  const {replaceHistoricalTotal}=await subject(),{p,s}=financedFixture(),x=runtime(s),snapshot=x.d.snapshot;
  x.d.snapshot=async api=>{const out=await snapshot(api);out.balances.a=s.balances.a+out.transactions.reduce((n,t)=>n+t.amount,0)-p.oldTransaction.amount;return out};
  const r=await replaceHistoricalTotal(p,true,x.d);assert.equal(r.verified,true);
  assert.equal(x.live.transactions.reduce((n,t)=>n+t.amount,0),p.oldTransaction.amount-p.financedPurchase.financeCost);
  for(const t of x.live.transactions){assert(t.notes.includes('Costo financiero de la serie: 300 CLP; no distribuido por cuota.'));assert(t.notes.includes('https://drive.google.com/file/d/receipt_image_123/view'));}
  assert.equal((await replaceHistoricalTotal(p,true,x.d)).action,'existing');assert.equal(x.writes,3);
});
test('rejects financed replacement when unrelated balance changes after writing',async()=>{
  const {replaceHistoricalTotal}=await subject(),{p,s}=financedFixture();s.balances.other=500;const x=runtime(s),snapshot=x.d.snapshot;
  x.d.snapshot=async api=>{const out=await snapshot(api);out.balances.a=s.balances.a+out.transactions.reduce((n,t)=>n+t.amount,0)-p.oldTransaction.amount;if(x.writes===3)out.balances.other++;return out};
  await assert.rejects(()=>replaceHistoricalTotal(p,true,x.d),/balance/i);
  assert.equal(x.state.historicalCardTotalReplacements.original.status,'pending');
  await assert.rejects(()=>replaceHistoricalTotal(p,true,x.d),/pending/i);
});

function userConfirmedFixture(){
 const {p,s}=financedFixture();delete p.financedPurchase;
 p.userConfirmedFinancing={confirmationRef:'call_b6e48826fcf641d4b0a61d4b90e319d6',confirmationDate:'2026-11-06',transactionId:p.oldTransaction.id,account:p.oldTransaction.account,purchaseDate:p.oldTransaction.date,amount:p.oldTransaction.amount,cardLast4:'1348',installmentCount:3,financeCost:30000};
 return {p,s};
}
test('accepts specific user-confirmed financing only with exact identity and statements',async()=>{
 const {classifyReplacement}=await subject(),{p,s}=userConfirmedFixture();assert.equal(classifyReplacement(p,s,{},'2026-11-06').balanceDelta,-30000);
 for(const change of [p=>p.userConfirmedFinancing.confirmationRef='bad',p=>p.userConfirmedFinancing.confirmationDate='2027-01-01',p=>p.userConfirmedFinancing.transactionId='other',p=>p.userConfirmedFinancing.account='other',p=>p.userConfirmedFinancing.purchaseDate='2025-10-09',p=>p.userConfirmedFinancing.amount++,p=>p.userConfirmedFinancing.cardLast4='123',p=>p.userConfirmedFinancing.installmentCount=2,p=>p.userConfirmedFinancing.financeCost++,p=>p.purchaseMessageId='abcd1234',p=>p.userConfirmedFinancing.extra=true]){const {p,s}=userConfirmedFixture();change(p);assert.throws(()=>classifyReplacement(p,s,{},'2026-11-06'));}
});
test('user-confirmed financing is audited and retries without writing',async()=>{
 const {replaceHistoricalTotal}=await subject(),{p,s}=userConfirmedFixture(),x=runtime(s),snapshot=x.d.snapshot;x.d.today=()=> '2026-11-06';
 x.d.snapshot=async api=>{const out=await snapshot(api);out.balances.a=s.balances.a+out.transactions.reduce((n,t)=>n+t.amount,0)-p.oldTransaction.amount;return out};
 assert((await replaceHistoricalTotal(p,true,x.d)).verified);for(const t of x.live.transactions){assert(t.notes.includes('Confirmación directa del usuario'));assert(t.notes.includes(p.userConfirmedFinancing.confirmationRef));assert(!t.notes.includes('undefined'));}
 assert.equal((await replaceHistoricalTotal(p,true,x.d)).action,'existing');assert.equal(x.writes,3);
});
