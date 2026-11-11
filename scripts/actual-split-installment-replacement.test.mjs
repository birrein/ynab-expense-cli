import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySplitInstallmentReplacement, replaceSplitInstallments } from './actual-split-installment-replacement.mjs';

const fixture=()=>{
  const child=(id,amount,category,notes,order)=>({id,is_parent:false,is_child:true,parent_id:'original',account:'a',
    category,amount,payee:'p',notes,date:'2025-08-28',imported_id:null,transfer_id:null,sort_order:order,
    cleared:false,reconciled:false,schedule:null});
  const old={id:'original',is_parent:true,is_child:false,parent_id:null,account:'a',category:null,amount:-6200000,
    payee:'p',notes:'#cuotas items',date:'2025-08-28',imported_id:null,transfer_id:null,sort_order:100,
    cleared:false,reconciled:false,schedule:null,subtransactions:[child('c1',-2500000,'running','short',0),
      child('c2',-200000,'running','cup',-1),child('c3',-3500000,'gym','bar',-2)]};
  const data=[['2025-09-19',-2066600,[-833300,-66600,-1166700]],
    ['2025-10-19',-2066600,[-833300,-66700,-1166600]],['2025-11-19',-2066800,[-833400,-66700,-1166700]]];
  const installments=data.map(([date,amount,allocations],i)=>({number:i+1,date,amount,statementId:`statement_${i+1}`,
    sourceId:`bank:test:installment:${i+1}`,allocations:allocations.map((amount,j)=>({childId:`c${j+1}`,amount}))}));
  const p={historicalSplitInstallmentReplacement:true,currency:'CLP',oldParent:old,purchaseMessageId:'abcd1234',
    evidence:'Receipt and three statements independently identify the same split purchase.',installments};
  const s={accounts:[{id:'a',closed:false,offbudget:false}],payees:[{id:'p',name:'Merchant',transfer_acct:null}],
    categories:[{id:'running',hidden:false,is_income:false},{id:'gym',hidden:false,is_income:false}],
    transactions:[structuredClone(old)],rules:[],schedules:[],balances:{a:-6200000}};
  return {p,s};
};

test('previews a complete exact split series without changing the original',()=>{
  const {p,s}=fixture(),before=structuredClone(s);
  assert.equal(classifySplitInstallmentReplacement(p,s,{},'2026-11-06').action,'replace');
  assert.deepEqual(s,before);
});
test('rejects invalid rows, columns, rounding, dates, ownership and duplicates',()=>{
  for(const change of [
    p=>p.installments.pop(),p=>p.installments[0].amount+=100,
    p=>p.installments[0].allocations[0].amount+=100,
    p=>{p.installments[0].allocations[0].amount+=200;p.installments[0].allocations[2].amount-=200;
      p.installments[1].allocations[0].amount-=200;p.installments[1].allocations[2].amount+=200},
    p=>p.installments[1].allocations[0].childId='c2',p=>p.installments[2].date='2027-01-19',
    p=>p.installments[2].statementId=p.installments[0].statementId,p=>p.oldParent.cleared=true,
    p=>p.oldParent.subtransactions[0].transfer_id='other',
    (p,s)=>{s.transactions[0].subtransactions[0].amount-=100},
    (p,s)=>s.transactions.push({...structuredClone(p.oldParent),id:'dup',date:p.installments[0].date,amount:p.installments[0].amount}),
    (p,s,l)=>{l.cashflows={x:{id:'original'}}},
    (p,s,l)=>{l.historicalSplitInstallmentReplacements={original:{status:'pending'}}}
  ]){const {p,s}=fixture(),l={};change(p,s,l);assert.throws(()=>classifySplitInstallmentReplacement(p,s,l,'2026-11-06'));}
});

function runtime(initial){
 let live=structuredClone(initial),ledger={},writes=0,backups=0,fail=false,corrupt=false;
 const api={async sync(){},async shutdown(){},async updateTransaction(id,fields){writes++;Object.assign(live.transactions.find(t=>t.id===id),structuredClone(fields));live.balances.a=live.transactions.reduce((n,t)=>n+t.amount,0);if(fail)throw Error('interrupted')},
   async addTransactions(account,items){for(const item of items){writes++;const id=`new-${writes}`;live.transactions.push({...structuredClone(item),id,account,is_child:false,parent_id:null,transfer_id:null,reconciled:false,schedule:null,subtransactions:item.subtransactions.map((c,i)=>({...structuredClone(c),id:`${id}-c${i}`,is_child:true,is_parent:false,parent_id:id,account,date:item.date,transfer_id:null,reconciled:false,schedule:null,cleared:false}))});}live.balances.a=live.transactions.reduce((n,t)=>n+t.amount,0);if(corrupt)live.rules.push({id:'unexpected'})}};
 const d={async connect(){return {api}},async snapshot(){return structuredClone(live)},async readState(){return structuredClone(ledger)},async requireRun(){return structuredClone(ledger)},async save(x){ledger=structuredClone(x)},async backup(){backups++;return '/private/backup'},async json(){},today:()=> '2026-11-06'};
 return {d,get live(){return live},get ledger(){return ledger},get writes(){return writes},get backups(){return backups},interrupt(){fail=true},corrupt(){corrupt=true}};
}
test('writes verified split series with retained IDs and idempotent retry',async()=>{
 const {p,s}=fixture(),x=runtime(s);assert.equal((await replaceSplitInstallments(p,false,x.d)).action,'replace');assert.equal(x.writes,0);
 const r=await replaceSplitInstallments(p,true,x.d);assert.equal(r.verified,true);assert.equal(x.backups,1);assert.equal(x.writes,3);
 assert.equal(x.live.transactions[0].id,'original');assert.deepEqual(x.live.transactions[0].subtransactions.map(x=>x.id),['c1','c2','c3']);
 assert.equal(x.live.transactions.reduce((n,t)=>n+t.amount,0),p.oldParent.amount);
 assert.equal((await replaceSplitInstallments(p,true,x.d)).action,'existing');assert.equal(x.writes,3);
});
test('interrupted first write leaves pending audit and rejects retry',async()=>{
 const {p,s}=fixture(),x=runtime(s);x.interrupt();await assert.rejects(()=>replaceSplitInstallments(p,true,x.d),/interrupted/);
 assert.equal(x.ledger.historicalSplitInstallmentReplacements.original.status,'pending');
 await assert.rejects(()=>replaceSplitInstallments(p,true,x.d),/pending/i);assert.equal(x.writes,1);
});
test('unrelated changes during write fail independent verification and prevent retry',async()=>{
 const {p,s}=fixture(),x=runtime(s);x.corrupt();await assert.rejects(()=>replaceSplitInstallments(p,true,x.d),/Unrelated rules changed/);
 assert.equal(x.ledger.historicalSplitInstallmentReplacements.original.status,'pending');
 await assert.rejects(()=>replaceSplitInstallments(p,true,x.d),/pending/i);assert.equal(x.writes,3);
});
test('a backup failure prevents all writes',async()=>{
 const {p,s}=fixture(),x=runtime(s);x.d.backup=async()=>{throw Error('backup failed')};
 await assert.rejects(()=>replaceSplitInstallments(p,true,x.d),/backup failed/);assert.equal(x.writes,0);
});
