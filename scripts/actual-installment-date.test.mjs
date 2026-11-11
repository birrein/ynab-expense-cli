import test from 'node:test';
import assert from 'node:assert/strict';

async function subject() {
  try { return await import('./actual-installment-date.mjs'); }
  catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND') assert.fail('Installment date correction is not implemented'); throw e; }
}
const tx = (id, date, n) => ({ id, account:'a', payee:'p', category:'c', amount:-1700700,
  date, notes:`Radar ${n}/12 #cuotas`, imported_id:null, is_parent:false, is_child:false,
  parent_id:null, transfer_id:null, schedule:null, reconciled:false, cleared:false, subtransactions:[] });
const fixture = () => {
  const prev=tx('prev','2025-10-19',9), old=tx('target','2025-10-21',10), next=tx('next','2025-12-19',11);
  return {p:{historicalInstallmentDateCorrection:true,currency:'CLP',oldTransaction:old,previous:prev,next,
    number:10,total:12,newDate:'2025-11-19',statementFileId:'statement_123',purchaseMessageId:'abcd1234',
    evidence:'Purchase and statement show installment 10 in November.'},
    s:{accounts:[{id:'a',closed:false,offbudget:false}],payees:[{id:'p',name:'Seller',transfer_acct:null}],
      categories:[{id:'c'}],transactions:structuredClone([prev,old,next]),rules:[],schedules:[],balances:{a:-5102100}}};
};
test('plans the date correction for an exact, consecutive series',async()=>{
  const {classifyInstallmentDate}=await subject(),{p,s}=fixture();
  assert.equal(classifyInstallmentDate(p,s,{}).action,'amend-date');
});
test('accepts a distinct verified purchase statement as alternative evidence',async()=>{
  const {classifyInstallmentDate}=await subject(),{p,s}=fixture();
  delete p.purchaseMessageId;p.purchaseStatementFileId='purchase_statement_123';
  assert.equal(classifyInstallmentDate(p,s,{}).action,'amend-date');
});
test('rejects conflicting, missing, invalid or identical statement evidence',async()=>{
  const {classifyInstallmentDate}=await subject();
  for(const change of [
    p=>{p.purchaseStatementFileId='purchase_statement_123'},
    p=>{delete p.purchaseMessageId},
    p=>{delete p.purchaseMessageId;p.purchaseStatementFileId='bad!'},
    p=>{delete p.purchaseMessageId;p.purchaseStatementFileId=p.statementFileId},
  ]) {const {p,s}=fixture();change(p);assert.throws(()=>classifyInstallmentDate(p,s,{}));}
});
const terminalFixture = () => {
  const previous2=tx('previous2','2025-05-19',10), previous=tx('previous','2025-06-19',11), old=tx('target','2025-07-28',12);
  const {p,s}=fixture();
  delete p.next;
  Object.assign(p,{oldTransaction:old,previous,previous2,number:12,newDate:'2025-07-19'});
  s.transactions=structuredClone([previous2,previous,old]);
  return {p,s};
};
test('plans a final installment with its two exact prior installments',async()=>{
  const {classifyInstallmentDate}=await subject(),{p,s}=terminalFixture();
  assert.equal(classifyInstallmentDate(p,s,{}).action,'amend-date');
});
test('rejects unsafe final installment neighbors and candidate shapes',async()=>{
  const {classifyInstallmentDate}=await subject();
  for(const change of [
    (p,s)=>{s.transactions[0].amount++},
    (p)=>{p.previous2.notes='Other 10/12 #cuotas'},
    (p)=>{p.previous2.date='2025-04-19'},
    (p)=>{p.previous2=p.previous},
    (p)=>{p.next=tx('other','2025-08-19',13)},
    (p)=>{delete p.previous2},
    (p)=>{p.number=2;p.total=2},
    (p)=>{p.oldTransaction.reconciled=true},
  ]) {const {p,s}=terminalFixture();change(p,s);assert.throws(()=>classifyInstallmentDate(p,s,{}));}
});
test('terminal correction verifies independent readback and an exact retry does not write again',async()=>{
  const {amendInstallmentDate}=await subject(),{p,s}=terminalFixture();let live=structuredClone(s),state={},writes=0,backups=0;
  const api={sync:async()=>{},shutdown:async()=>{},updateTransaction:async(id,fields)=>{
    assert.deepEqual(fields,{date:p.newDate});writes++;live.transactions.find(t=>t.id===id).date=fields.date;
  }};
  const d={connect:async()=>({api}),snapshot:async()=>structuredClone(live),readState:async()=>structuredClone(state),
    requireRun:async()=>structuredClone(state),save:async x=>{state=structuredClone(x)},backup:async()=>{backups++;return '/backup'},json:async()=>{}};
  assert.equal((await amendInstallmentDate(p,true,d)).verified,true);
  assert.equal((await amendInstallmentDate(p,true,d)).action,'existing');
  assert.equal(writes,1);assert.equal(backups,1);
});
test('rejects modified neighbors, missing provenance and a nonconsecutive month',async()=>{
  const {classifyInstallmentDate}=await subject();
  for(const change of [(p,s)=>{s.transactions[0].amount++},(p)=>{p.statementFileId=''},
    (p)=>{p.newDate='2025-10-30'},(p)=>{p.previous.notes='Other 9/12 #cuotas'}]){
    const {p,s}=fixture();change(p,s);assert.throws(()=>classifyInstallmentDate(p,s,{}));
  }
});
test('rejects a changed date without complete audit and any source-ledger ownership',async()=>{
  const {classifyInstallmentDate}=await subject(),{p,s}=fixture();
  assert.throws(()=>classifyInstallmentDate(p,s,{records:{source:{transactionId:'target'}}}),/ledger/i);
  s.transactions[1].date=p.newDate;assert.throws(()=>classifyInstallmentDate(p,s,{}),/audit/i);
});
test('backs up, writes only the date, verifies and retries without another write',async()=>{
  const {amendInstallmentDate}=await subject(),{p,s}=fixture();let live=structuredClone(s),state={},writes=0,backups=0;
  const api={sync:async()=>{},shutdown:async()=>{},updateTransaction:async(id,fields)=>{
    assert.deepEqual(fields,{date:p.newDate});writes++;live.transactions.find(t=>t.id===id).date=fields.date;
  }};
  const d={connect:async()=>({api}),snapshot:async()=>structuredClone(live),readState:async()=>structuredClone(state),
    requireRun:async()=>structuredClone(state),save:async x=>{state=structuredClone(x)},backup:async()=>{backups++;return '/backup'},json:async()=>{}};
  assert.equal((await amendInstallmentDate(p,true,d)).verified,true);
  assert.equal((await amendInstallmentDate(p,true,d)).action,'existing');
  assert.equal(writes,1);assert.equal(backups,1);assert.equal(state.historicalInstallmentDateCorrections.target.status,'complete');
});
test('an interrupted write leaves a pending audit and refuses another write',async()=>{
  const {amendInstallmentDate}=await subject(),{p,s}=fixture();let live=structuredClone(s),state={},writes=0;
  const api={sync:async()=>{},shutdown:async()=>{},updateTransaction:async(id,fields)=>{
    writes++;live.transactions.find(t=>t.id===id).date=fields.date;throw new Error('interrupted');
  }};
  const d={connect:async()=>({api}),snapshot:async()=>structuredClone(live),readState:async()=>structuredClone(state),
    requireRun:async()=>structuredClone(state),save:async x=>{state=structuredClone(x)},backup:async()=>'/backup',json:async()=>{}};
  await assert.rejects(()=>amendInstallmentDate(p,true,d),/interrupted/);
  assert.equal(state.historicalInstallmentDateCorrections.target.status,'pending');
  await assert.rejects(()=>amendInstallmentDate(p,true,d),/pending/i);assert.equal(writes,1);
});
const clearedFixture=()=>{const {p,s}=fixture();p.oldTransaction.date='2025-11-20';p.oldTransaction.cleared=true;p.preserveCleared=true;s.transactions[1]=structuredClone(p.oldTransaction);return {p,s}};
test('plans a cleared unreconciled installment correction of one day with explicit preservation',async()=>{const {classifyInstallmentDate}=await subject(),{p,s}=clearedFixture();assert.equal(classifyInstallmentDate(p,s,{}).action,'amend-date')});
test('rejects unsafe cleared corrections and flag use',async()=>{const {classifyInstallmentDate}=await subject();for(const change of [(p)=>{delete p.preserveCleared},(p)=>{p.preserveCleared=false},(p)=>{delete p.purchaseMessageId;p.purchaseStatementFileId='other_statement'},(p)=>{p.oldTransaction.reconciled=true},(p)=>{p.oldTransaction.reconciled=null},(p)=>{p.oldTransaction.date='2025-11-22'},(p)=>{p.newDate='2025-10-31'},(p)=>{p.oldTransaction.cleared=false}]){const {p,s}=clearedFixture();change(p);s.transactions[1]=structuredClone(p.oldTransaction);assert.throws(()=>classifyInstallmentDate(p,s,{}))}});
test('cleared installment date write preserves flag and exact retry avoids another write',async()=>{const {amendInstallmentDate}=await subject(),{p,s}=clearedFixture();let live=structuredClone(s),state={},writes=0;const api={sync:async()=>{},shutdown:async()=>{},updateTransaction:async(id,fields)=>{assert.deepEqual(fields,{date:p.newDate});writes++;live.transactions.find(t=>t.id===id).date=fields.date}};const d={connect:async()=>({api}),snapshot:async()=>structuredClone(live),readState:async()=>structuredClone(state),requireRun:async()=>structuredClone(state),save:async x=>{state=structuredClone(x)},backup:async()=>'/backup',json:async()=>{}};assert.equal((await amendInstallmentDate(p,true,d)).verified,true);assert.equal(live.transactions[1].cleared,true);assert.equal((await amendInstallmentDate(p,true,d)).action,'existing');assert.equal(writes,1)});

const firstBoundary=()=>{
 const {p,s}=fixture(),old=tx('target','2025-01-28',1),next=tx('next','2025-02-19',2),next2=tx('next2','2025-03-19',3);
 delete p.previous;Object.assign(p,{oldTransaction:old,next,next2,number:1,newDate:'2025-01-19'});s.transactions=structuredClone([old,next,next2]);return {p,s,l:{}};
};
const penultimateBoundary=()=>{
 const {p,s}=fixture(),previous2=tx('prior2','2025-09-19',9),previous=tx('prior','2025-10-19',10),old=tx('target','2025-11-28',11),last=tx('last','2025-12-19',12),source='statement:card:last';
 for(const t of [previous2,previous,old])t.notes=t.notes.replace('Radar','Radar Varia');
 last.imported_id=source;last.amount=-1700900;last.notes='#cuotas Radar Varia 12/12 confirmed\nhttps://drive.google.com/file/d/final_statement_123/view';
 delete p.next;Object.assign(p,{oldTransaction:old,previous,previous2,number:11,newDate:'2025-11-19',verifiedFinal:{transaction:last,statementFileId:'final_statement_123',seriesLabel:'Radar Varia'}});s.transactions=structuredClone([previous2,previous,old,last]);
 const l={records:{[source]:{transactionId:'last',currency:'CLP',account:'a',date:last.date,amount:last.amount,payee:'Seller',category:'c',sourceIds:[source],sourceType:'bank-statement',status:'registered',verifiedAt:'2025-12-20T00:00:00Z',backup:'/backup'}}};return {p,s,l};
};
test('first installment accepts two consecutive exact following neighbors',async()=>{const {classifyInstallmentDate}=await subject(),{p,s,l}=firstBoundary();assert.equal(classifyInstallmentDate(p,s,l).action,'amend-date')});
test('first installment rejects missing, nonconsecutive or changed neighbors',async()=>{const {classifyInstallmentDate}=await subject();for(const change of [(p)=>delete p.next2,(p)=>p.next2.date='2025-04-19',(p)=>p.next2.notes='Other 3/12 #cuotas',(p,s)=>s.transactions[2].amount++,(p)=>p.previous=tx('x','2024-12-19',0)]){const {p,s,l}=firstBoundary();change(p,s);assert.throws(()=>classifyInstallmentDate(p,s,l))}});
test('penultimate installment accepts separately evidenced verified final neighbor',async()=>{const {classifyInstallmentDate}=await subject(),{p,s,l}=penultimateBoundary();assert.equal(classifyInstallmentDate(p,s,l).action,'amend-date')});
test('penultimate verified final neighbor rejects missing or inconsistent provenance',async()=>{const {classifyInstallmentDate}=await subject();for(const change of [(p,s,l)=>delete l.records['statement:card:last'],(p,s,l)=>l.records['statement:card:last'].status='review',(p,s,l)=>l.records['statement:card:last'].amount++,(p)=>p.verifiedFinal.statementFileId=p.statementFileId,(p)=>p.verifiedFinal.seriesLabel='x',(p,s)=>s.transactions[3].amount++,(p)=>p.verifiedFinal.transaction.notes='Radar 12/12 #cuotas',(p)=>p.previous2.notes='Other 9/12 #cuotas',(p)=>p.next=tx('bad','2025-12-19',12)]){const {p,s,l}=penultimateBoundary();change(p,s,l);assert.throws(()=>classifyInstallmentDate(p,s,l))}});
test('boundary date correction independently verifies and retries without a second write',async()=>{
 const {amendInstallmentDate}=await subject();for(const make of [firstBoundary,penultimateBoundary]){const {p,s,l}=make();let live=structuredClone(s),state=structuredClone(l),writes=0;
 const api={sync:async()=>{},shutdown:async()=>{},updateTransaction:async(id,fields)=>{writes++;live.transactions.find(t=>t.id===id).date=fields.date}};
 const d={connect:async()=>({api}),snapshot:async()=>structuredClone(live),readState:async()=>structuredClone(state),requireRun:async()=>structuredClone(state),save:async x=>{state=structuredClone(x)},backup:async()=>'/backup',json:async()=>{}};
 assert.equal((await amendInstallmentDate(p,true,d)).verified,true);assert.equal((await amendInstallmentDate(p,true,d)).action,'existing');assert.equal(writes,1);
 }});
