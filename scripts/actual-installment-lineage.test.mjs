import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyHistoricalAmount,correctHistoricalAmount} from './actual-historical-amount.mjs';
import {classifyInstallmentDate,amendInstallmentDate} from './actual-installment-date.mjs';

const t=(id,n,date,amount=-10000)=>({id,account:'account',date,amount,payee:'merchant',category:'cat',notes:`Camera ${n}/3 #cuotas`,imported_id:null,is_parent:false,is_child:false,parent_id:null,transfer_id:null,subtransactions:[],reconciled:false,cleared:false,schedule:null,starting_balance_flag:false,tombstone:false});
function fixture(){
 const prev=t('prev',1,'2024-01-28'),old=t('target',2,'2024-02-28'),next=t('next',3,'2024-03-28');
 const amount={historicalExpenseAmountCorrection:true,currency:'CLP',oldTransaction:old,newAmount:-10100,statementId:'statement_target',statementSeries:{purchaseStatementId:'statement_original',number:2,total:3,previous:prev,next},evidence:'Original and target statements were independently examined for this purchase.'};
 const changed={...old,amount:amount.newAmount};
 const date={historicalInstallmentDateCorrection:true,currency:'CLP',oldTransaction:changed,previous:prev,next,number:2,total:3,newDate:'2024-02-19',statementFileId:'statement_target',purchaseStatementFileId:'statement_original',evidence:'Original and target statements were independently examined for this purchase.'};
 const final={...changed,date:date.newDate};
 const ledger={historicalExpenseAmountCorrections:{target:{candidate:amount,verifiedAt:'2026-01-01T00:00:00.000Z',backup:'/backup/amount'}},historicalInstallmentDateCorrections:{target:{candidate:date,status:'complete',verifiedAt:'2026-01-02T00:00:00.000Z',backup:'/backup/date'}}};
 const snapshot={transactions:[prev,final,next],accounts:[{id:'account'}],categories:[{id:'cat'}],payees:[{id:'merchant'}]};
 return {amount,date,prev,next,final,ledger,snapshot};
}
test('completed amount retry follows a later exact verified date audit',()=>{
 const {amount,snapshot,ledger}=fixture();assert.equal(classifyHistoricalAmount(amount,snapshot,ledger).action,'existing');
});
test('completed receipt-backed installment amount retry follows a later date audit',()=>{
 const {amount,snapshot,ledger}=fixture();delete amount.statementSeries;amount.receiptId='19e7168eca723238';ledger.historicalExpenseAmountCorrections.target.candidate=structuredClone(amount);
 assert.equal(classifyHistoricalAmount(amount,snapshot,ledger).action,'existing');
});
test('completed retries follow a later exact verified neighbor change',()=>{
 const {amount,date,prev,snapshot,ledger}=fixture();let corrected={...prev,amount:-10100};snapshot.transactions[0]=corrected;
 ledger.historicalExpenseAmountCorrections.prev={candidate:{historicalExpenseAmountCorrection:true,currency:'CLP',oldTransaction:prev,newAmount:-10100},verifiedAt:'2026-01-03T00:00:00.000Z',backup:'/backup/prev'};
 assert.equal(classifyHistoricalAmount(amount,snapshot,ledger).action,'existing');assert.equal(classifyInstallmentDate(date,snapshot,ledger).action,'existing');
});
test('completed date retry follows a subsequent exact amount audit',()=>{
 const x=fixture(),original=x.amount.oldTransaction;
 x.date.oldTransaction=structuredClone(original);
 x.ledger.historicalInstallmentDateCorrections.target.candidate=structuredClone(x.date);
 x.ledger.historicalInstallmentDateCorrections.target.verifiedAt='2026-01-01T00:00:00.000Z';
 const afterDate={...original,date:x.date.newDate};
 x.ledger.historicalExpenseAmountCorrections.target.candidate.oldTransaction=afterDate;
 x.ledger.historicalExpenseAmountCorrections.target.verifiedAt='2026-01-02T00:00:00.000Z';
 assert.equal(classifyInstallmentDate(x.date,x.snapshot,x.ledger).action,'existing');
});
test('completed retry refuses a changed candidate or incomplete original audit',()=>{
 for(const mutate of [
  x=>{x.ledger.historicalExpenseAmountCorrections.target.candidate.evidence='different'},
  x=>{x.ledger.historicalExpenseAmountCorrections.target.status='pending'},
  x=>{x.ledger.historicalExpenseAmountCorrections.target.backup=''},
  x=>{x.ledger.historicalInstallmentDateCorrections.target.status='pending'},
  x=>{x.ledger.historicalInstallmentDateCorrections.target.backup=''},
 ]){const x=fixture();mutate(x);assert.throws(()=>classifyHistoricalAmount(x.amount,x.snapshot,x.ledger));}
});
test('chained retry rejects pending, nonchronological or changed snapshots',()=>{
 for(const mutate of [
  x=>{x.ledger.historicalInstallmentDateCorrections.target.status='pending'},
  x=>{x.ledger.historicalInstallmentDateCorrections.target.verifiedAt='2025-01-01T00:00:00.000Z'},
  x=>{x.ledger.historicalInstallmentDateCorrections.target.backup=''},
  x=>{x.snapshot.transactions[1].notes+=' unaudited'},
  x=>{x.ledger.historicalInstallmentDateCorrections.target.candidate.currency='USD'},
 ]){const x=fixture();mutate(x);assert.throws(()=>classifyHistoricalAmount(x.amount,x.snapshot,x.ledger));}
});
test('new amount and date corrections reject stale neighbor snapshots despite prior audits',()=>{
 const x=fixture();delete x.ledger.historicalExpenseAmountCorrections.target;delete x.ledger.historicalInstallmentDateCorrections.target;
 x.snapshot.transactions[1]=structuredClone(x.amount.oldTransaction);x.snapshot.transactions[0]={...x.prev,amount:-10100};
 x.ledger.historicalExpenseAmountCorrections.prev={candidate:{historicalExpenseAmountCorrection:true,currency:'CLP',oldTransaction:x.prev,newAmount:-10100},verifiedAt:'2026-01-03T00:00:00.000Z',backup:'/backup/prev'};
 assert.throws(()=>classifyHistoricalAmount(x.amount,x.snapshot,x.ledger));assert.throws(()=>classifyInstallmentDate(x.date,x.snapshot,x.ledger));
});
test('completed chained operations do not back up or write on commit retry',async()=>{
 const x=fixture();let writes=0,backups=0;
 const api={async shutdown(){},async updateTransaction(){writes++}};
 const d={async requireRun(){return structuredClone(x.ledger)},async connect(){return{api}},async snapshot(){return structuredClone(x.snapshot)},async backup(){backups++;throw Error('unexpected backup')}};
 assert.equal((await correctHistoricalAmount(x.amount,true,d)).action,'existing');
 assert.equal((await amendInstallmentDate(x.date,true,d)).action,'existing');
 assert.equal(writes,0);assert.equal(backups,0);
});
test('later neighbor mutation fails without a matching complete audit',()=>{
 const x=fixture();x.snapshot.transactions[0]={...x.prev,amount:-10100};
 for(const bad of [undefined,{status:'pending',candidate:{historicalExpenseAmountCorrection:true,currency:'CLP',oldTransaction:x.prev,newAmount:-10100},verifiedAt:'2026-01-03T00:00:00.000Z',backup:'/backup/prev'}]){
  if(bad)x.ledger.historicalExpenseAmountCorrections.prev=bad;
  assert.throws(()=>classifyHistoricalAmount(x.amount,x.snapshot,x.ledger));
  assert.throws(()=>classifyInstallmentDate(x.date,x.snapshot,x.ledger));
 }
});
