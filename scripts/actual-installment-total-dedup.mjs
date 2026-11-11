import assert from 'node:assert/strict';
import {BUDGETS} from './actual-daily-policy.mjs';

const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const equal=(a,b,message)=>assert.deepEqual(canon(a),canon(b),message);
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const month=x=>Number(x.slice(0,4))*12+Number(x.slice(5,7));
const validTx=t=>{
 assert(t&&typeof t==='object'&&typeof t.id==='string'&&t.id&&validDate(t.date));
 assert(Number.isSafeInteger(t.amount)&&t.amount<0&&typeof t.account==='string'&&t.account&&typeof t.payee==='string'&&t.payee&&typeof t.category==='string'&&t.category);
 assert(!t.transfer_id&&!t.is_parent&&!t.is_child&&!t.parent_id&&!t.subtransactions?.length&&!t.reconciled&&!t.schedule&&!t.imported_id,'Transaction is not an unowned simple historical expense');
};

export function classifyInstallmentTotal(p,s,ledger){
 assert.equal(p.installmentTotalRetirement,true);
 equal(Object.keys(p).sort(),['installmentTotalRetirement','currency','total','installments','purchaseMessageId','evidence',...(Object.hasOwn(p,'financeCost')?['financeCost']:[])].sort(),'Unexpected candidate fields');
 if(Object.hasOwn(p,'financeCost'))assert(Number.isSafeInteger(p.financeCost)&&p.financeCost>0,'Invalid finance cost');
 assert(Object.hasOwn(BUDGETS,p.currency));assert(/^[a-f0-9]{16}$/.test(p.purchaseMessageId));assert(typeof p.evidence==='string'&&p.evidence.trim());
 validTx(p.total);assert(s.accounts.some(a=>a.id===p.total.account&&!a.closed&&!a.offbudget),'Account unavailable');
 assert(Array.isArray(p.installments)&&p.installments.length>=2&&p.installments.length<=99);
 const n=p.installments.length, ids=new Set(), statements=new Set();let sum=0,firstMonth=null;
 for(let i=0;i<n;i++){
  const e=p.installments[i];equal(Object.keys(e).sort(),['number','statementId','statementDate','statementAmount','transaction'].sort(),'Unexpected installment fields');
  assert.equal(e.number,i+1,'Installments must be complete and ordered');assert(/^[A-Za-z0-9_-]{8,}$/.test(e.statementId)&&!statements.has(e.statementId),'Missing or duplicated statement');statements.add(e.statementId);
  assert(validDate(e.statementDate));validTx(e.transaction);const t=e.transaction;
  assert(!ids.has(t.id)&&t.id!==p.total.id,'Duplicate transaction');ids.add(t.id);
  assert.equal(t.account,p.total.account);assert.equal(t.payee,p.total.payee);assert.equal(t.category,p.total.category);assert.equal(e.statementAmount,t.amount,'Statement amount mismatch');
  assert.equal(month(e.statementDate),month(t.date),'Statement and booked month differ');
  if(i===0){firstMonth=month(e.statementDate);assert(firstMonth-month(p.total.date)>=0&&firstMonth-month(p.total.date)<=1,'First installment period inconsistent');}
  assert.equal(month(e.statementDate),firstMonth+i,'Statement periods must be consecutive');
  assert(new RegExp(`(^|[^0-9])0?${i+1}\\s*\\/\\s*0?${n}([^0-9]|$)`).test(t.notes??''),'Installment number absent from notes');
  const live=s.transactions.filter(x=>x.id===t.id);assert.equal(live.length,1,'Installment missing');equal(live[0],t,'Installment changed');sum+=t.amount;
 }
 assert.equal(sum,p.total.amount-(p.financeCost??0),'Installment sum differs from total plus finance cost');
 for(const r of Object.values(ledger.records??{}))assert(![p.total.id,...ids].includes(r.transactionId),'Ledger-owned transaction');
 for(const r of Object.values(ledger.cashflows??{}))assert(![p.total.id,...ids].some(id=>id===r.id||id===r.counterpartId),'Ledger-owned transaction');
 const totals=s.transactions.filter(x=>x.id===p.total.id),audit=ledger.installmentTotalRetirements?.[p.total.id];
 if(!totals.length){assert(audit?.verifiedAt&&audit.backup,'Missing verified audit');equal(audit.candidate,p,'Audit mismatch');return {action:'existing',id:p.total.id};}
 assert(!audit,'Transaction exists despite retirement audit');assert.equal(totals.length,1);equal(totals[0],p.total,'Purchase total changed');
 return {action:'retire',id:p.total.id};
}

export async function retireInstallmentTotal(p,commit,d){
 assert(Object.hasOwn(BUDGETS,p.currency));let ledger=commit?await d.requireRun():await d.readState();let {api}=await d.connect(BUDGETS[p.currency].syncId),before,dir,action;
 try{
  before=await d.snapshot(api);action=classifyInstallmentTotal(p,before,ledger);
  if(!commit)return {...action,candidate:p};
  if(action.action==='existing')return {...action,verified:true,backup:ledger.installmentTotalRetirements[p.total.id].backup};
  dir=await d.backup(api,p.currency,before);await d.json(dir+'/installment-total-dedup.json',{candidate:p,original:p.total});
  await api.sync();equal(await d.snapshot(api),before,'Budget changed before deletion');classifyInstallmentTotal(p,before,await d.requireRun());
  await api.deleteTransaction(p.total.id);await api.sync();
 }finally{await api.shutdown();}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));
 try{
  const after=await d.snapshot(api);assert(!after.transactions.some(t=>t.id===p.total.id),'Purchase total remains');
  const expected={...before,transactions:before.transactions.filter(t=>t.id!==p.total.id),balances:{...before.balances,[p.total.account]:before.balances[p.total.account]-p.total.amount}};
  const {transactions:at,...ar}=after,{transactions:bt,...br}=expected;equal(ar,br,'Unrelated budget data changed');assert.equal(at.length,bt.length);
  const byId=new Map(at.map(t=>[t.id,t]));assert.equal(byId.size,at.length);for(const t of bt)equal(byId.get(t.id),t,'Other transaction changed');
  await d.json(dir+'/after.json',after);ledger=await d.requireRun();ledger.installmentTotalRetirements??={};
  ledger.installmentTotalRetirements[p.total.id]={candidate:p,original:p.total,backup:dir,verifiedAt:new Date().toISOString()};await d.save(ledger);
  return {...action,verified:true,backup:dir};
 }finally{await api.shutdown();}
}
