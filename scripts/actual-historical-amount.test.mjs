import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyHistoricalAmount, correctHistoricalAmount} from './actual-historical-amount.mjs';

const old={id:'tx',account:'a',date:'2023-02-12',amount:-999000,payee:'merchant',category:'games',notes:'Dolby Atmos',imported_id:null,is_parent:false,is_child:false,parent_id:null,transfer_id:null,subtransactions:[],reconciled:false,cleared:true,schedule:null};
const candidate={historicalExpenseAmountCorrection:true,currency:'CLP',oldTransaction:old,newAmount:-999900,statementId:'statement123',receiptId:'18643987b3ef2860',evidence:'The statement and receipt identify the same purchase and amount.'};
const snap=()=>({accounts:[{id:'a',closed:false,offbudget:false}],transactions:[structuredClone(old)],categories:[{id:'games'}],payees:[{id:'merchant'}],rules:[],schedules:[],balances:{a:-999000}});
const change=(fn)=>{const c=structuredClone(candidate);fn(c);return c};

const importedFixture=()=>{
 const target={...structuredClone(old),date:'2026-07-16',amount:-2661600,cleared:false,imported_id:'YNABEXP:26A194F07760AD947694',notes:'PedidosYa; boleta 31736738; source=legacy'};
 const c={historicalExpenseAmountCorrection:true,currency:'CLP',oldTransaction:target,newAmount:-2653400,statementId:'statement_202607',importedAuthorizationEvidence:{noticeId:'19f6d527735de0fc',orderId:'19f6d523900fe476',finalReceiptId:'19f6d85763b4aec5',receiptNumber:'31736738',goodsAmount:2528500,serviceAmount:125000},evidence:'Operator read the notice, order, final goods receipt and bank statement for the same transaction.'};
 const s=snap();s.transactions=[structuredClone(target)];s.balances.a=target.amount;return {c,s};
};
const legacyImportedFixture=()=>{
 const {c,s}=importedFixture();
 c.oldTransaction.notes='PedidosYa Market; alimentos y servicio; source=pedido/boleta/Banco de Chile; source=ynab-expense-cli';
 c.oldTransaction.imported_payee='PedidosYa';
 c.importedAuthorizationEvidence.legacyMerchant='PedidosYa Market';
 s.transactions=[structuredClone(c.oldTransaction)];s.payees=[{id:'merchant',name:'PedidosYa'}];
 return {c,s};
};
test('plans a unique legacy authorization whose original note lacks the receipt number',()=>{
 const {c,s}=legacyImportedFixture();assert.equal(classifyHistoricalAmount(c,s,{}).action,'correct');
});
test('legacy authorization rejects ambiguous identities, provenance and nearby settlement',()=>{
 for(const mutate of [
  (c)=>{c.importedAuthorizationEvidence.legacyMerchant='Other merchant'},
  (c)=>{c.oldTransaction.imported_payee='Another'},
  (c)=>{c.oldTransaction.notes=c.oldTransaction.notes.replace('source=pedido/boleta/Banco de Chile','source=legacy')},
  (c)=>{c.oldTransaction.notes=c.oldTransaction.notes.replace('source=ynab-expense-cli','source=legacy')},
  (c,s)=>{s.payees[0].name='Another'},
  (c,s)=>{s.transactions.push({...structuredClone(c.oldTransaction),id:'same-authorization',imported_id:null})},
  (c,s)=>{s.transactions.push({...structuredClone(c.oldTransaction),id:'settled',date:'2026-07-17',amount:c.newAmount,imported_id:null})},
 ]){const {c,s}=legacyImportedFixture();mutate(c,s);s.transactions[0]=structuredClone(c.oldTransaction);assert.throws(()=>classifyHistoricalAmount(c,s,{}));}
});
test('legacy correction preserves notes and import identity and exact retry is read-only',async()=>{
 const {c,s}=legacyImportedFixture();let live=structuredClone(s),state={},events=[];
 const api={async shutdown(){},async sync(){},async updateTransaction(id,patch){events.push('write');live.transactions[0].amount=patch.amount;live.balances.a+=c.newAmount-c.oldTransaction.amount},async getTransactions(){return structuredClone(live.transactions)}};
 const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async readState(){return structuredClone(state)},async requireRun(){return structuredClone(state)},async backup(){events.push('backup');return '/private/backup'},async json(){},async save(x){state=structuredClone(x)}};
 assert.equal((await correctHistoricalAmount(c,true,d)).verified,true);assert.equal(live.transactions[0].notes,c.oldTransaction.notes);assert.equal(live.transactions[0].imported_id,c.oldTransaction.imported_id);
 assert.equal((await correctHistoricalAmount(c,true,d)).action,'existing');assert.deepEqual(events,['backup','write']);
});
test('plans a narrowly evidenced imported authorization adjustment',()=>{
 const {c,s}=importedFixture();const r=classifyHistoricalAmount(c,s,{});assert.equal(r.action,'correct');assert.equal(r.balanceDelta,8200);
});
test('imported correction rejects ambiguous sources, identities, totals and ledger ownership',()=>{
 for(const mutate of [
  c=>{c.receiptId='18643987b3ef2860'},c=>{c.importedAuthorizationEvidence.orderId=c.importedAuthorizationEvidence.noticeId},
  c=>{c.importedAuthorizationEvidence.finalReceiptId='bad'},c=>{c.importedAuthorizationEvidence.receiptNumber='99999999'},
  c=>{c.importedAuthorizationEvidence.goodsAmount-=300},c=>{c.importedAuthorizationEvidence.serviceAmount=-100},
  c=>{c.importedAuthorizationEvidence.extra=true},c=>{c.currency='USD'},c=>{c.newAmount=-2600000},
  c=>{c.oldTransaction.imported_id='gmail:19f6d527735de0fc'},c=>{c.oldTransaction.reconciled=true},
  (c,s)=>{s.transactions.push({...structuredClone(c.oldTransaction),id:'duplicate'})},
 ]){const {c,s}=importedFixture();mutate(c,s);s.transactions[0]=structuredClone(c.oldTransaction);assert.throws(()=>classifyHistoricalAmount(c,s,{}));}
 const {c,s}=importedFixture();assert.throws(()=>classifyHistoricalAmount(c,s,{records:{source:{transactionId:c.oldTransaction.id}}}));
 const ordinary=structuredClone(c);delete ordinary.importedAuthorizationEvidence;ordinary.receiptId='18643987b3ef2860';assert.throws(()=>classifyHistoricalAmount(ordinary,s,{}));
});
test('imported correction backs up, preserves the import ID and retries without writing',async()=>{
 const {c,s}=importedFixture();let live=structuredClone(s),state={},events=[];
 const api={async shutdown(){},async sync(){},async updateTransaction(id,patch){events.push('write');live.transactions[0].amount=patch.amount;live.balances.a+=c.newAmount-c.oldTransaction.amount},async getTransactions(){return structuredClone(live.transactions)}};
 const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async readState(){return structuredClone(state)},async requireRun(){return structuredClone(state)},async backup(){events.push('backup');return '/private/backup'},async json(){},async save(x){state=structuredClone(x)}};
 assert.equal((await correctHistoricalAmount(c,true,d)).verified,true);assert.equal(live.transactions[0].imported_id,c.oldTransaction.imported_id);
 assert.equal((await correctHistoricalAmount(c,true,d)).action,'existing');assert.deepEqual(events,['backup','write']);
});
test('imported correction fails closed on an unaudited write or concurrent change',async()=>{
 const {c,s}=importedFixture();let live=structuredClone(s),writes=0;
 live.transactions[0].amount=c.newAmount;assert.throws(()=>classifyHistoricalAmount(c,live,{}));
 live=structuredClone(s);
 const api={async shutdown(){},async sync(){},async updateTransaction(){writes++}};
 const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async requireRun(){return{}},async backup(){live.transactions[0].notes+=' concurrent';return '/private/backup'},async json(){}};
 await assert.rejects(correctHistoricalAmount(c,true,d),/Budget changed/);assert.equal(writes,0);
});
test('imported correction refuses a readback that changes its import identity',async()=>{
 const {c,s}=importedFixture();let live=structuredClone(s),state={};
 const api={async shutdown(){},async sync(){},async updateTransaction(id,patch){live.transactions[0].amount=patch.amount;live.transactions[0].imported_id='changed';live.balances.a+=c.newAmount-c.oldTransaction.amount},async getTransactions(){return structuredClone(live.transactions)}};
 const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async requireRun(){return structuredClone(state)},async backup(){return '/private/backup'},async json(){},async save(x){state=structuredClone(x)}};
 await assert.rejects(correctHistoricalAmount(c,true,d));assert.equal(state.historicalExpenseAmountCorrections,undefined);
});

test('accepts a distinct archived provider receipt and rejects ambiguous evidence',()=>{
 const c=change(x=>{delete x.receiptId;x.providerReceiptId='provider_receipt_123'});
 assert.equal(classifyHistoricalAmount(c,snap(),{}).action,'correct');
 for(const mutate of [x=>x.providerReceiptId='',x=>x.providerReceiptId=x.statementId,x=>x.receiptId='18643987b3ef2860',x=>x.statementSeries={},x=>x.subscriptionEvidence={}]){
  const invalid=structuredClone(c);mutate(invalid);assert.throws(()=>classifyHistoricalAmount(invalid,snap(),{}));
 }
});

const installmentFixture=({terminal=false}={})=>{
 const num=terminal?12:11;
 const target={...structuredClone(old),date:terminal?'2024-10-19':'2024-09-19',notes:`GAES ${num}/12 #cuotas`,amount:-14958400};
 const previous={...structuredClone(target),id:'prior',date:terminal?'2024-09-19':'2024-08-19',notes:`GAES ${num-1}/12 #cuotas`};
 const neighbor={...structuredClone(target),id:'other',date:terminal?'2024-08-19':'2024-10-19',notes:`GAES ${terminal?num-2:num+1}/12 #cuotas`};
 const series={purchaseStatementId:'purchase_statement_123',number:num,total:12,previous,...(terminal?{previous2:neighbor}:{next:neighbor})};
 const c={historicalExpenseAmountCorrection:true,currency:'CLP',oldTransaction:target,newAmount:terminal?-14958700:-14958300,statementId:'target_statement_123',statementSeries:series,evidence:'Operator inspected both distinct statements and exact installment series.'};
 const s=snap();s.transactions=structuredClone([target,previous,neighbor]);s.balances.a=-44875200;
 return {c,s};
};
test('plans bounded statement-backed historical installment rounding including a final installment',()=>{
 for(const terminal of [false,true]){const {c,s}=installmentFixture({terminal});assert.equal(classifyHistoricalAmount(c,s,{}).action,'correct');}
});
test('statement-backed installment evidence rejects ambiguity, changed neighbors and excessive deltas',()=>{
 for(const mutate of [
  (c)=>{c.receiptId='18643987b3ef2860'},
  (c)=>{c.statementSeries.purchaseStatementId=c.statementId},
  (c)=>{c.newAmount=c.oldTransaction.amount-1100},
  (c)=>{c.currency='USD'},
  (c)=>{c.statementSeries.previous.notes='Unrelated 10/12 #cuotas'},
  (c)=>{c.statementSeries.next.date='2024-11-19'},
  (c)=>{c.statementSeries.extra=true},
  (c,s)=>{s.transactions[1].amount++},
 ]){const {c,s}=installmentFixture();mutate(c,s);assert.throws(()=>classifyHistoricalAmount(c,s,{}));}
});
test('statement-backed terminal amount correction preserves neighbors and exact retry is read-only',async()=>{
 const {c,s}=installmentFixture({terminal:true});let live=structuredClone(s),state={},writes=0,backups=0;
 const api={async shutdown(){},async sync(){},async updateTransaction(id,patch){writes++;live.transactions.find(t=>t.id===id).amount=patch.amount;live.balances.a+=c.newAmount-c.oldTransaction.amount},async getTransactions(){return structuredClone(live.transactions)}};
 const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async readState(){return structuredClone(state)},async requireRun(){return structuredClone(state)},async backup(){backups++;return '/backup'},async json(){},async save(x){state=structuredClone(x)}};
 assert.equal((await correctHistoricalAmount(c,true,d)).verified,true);
 assert.equal((await correctHistoricalAmount(c,true,d)).action,'existing');
 assert.equal(writes,1);assert.equal(backups,1);assert.deepEqual(live.transactions.slice(1),s.transactions.slice(1));
});

test('preview requires exact identity and independent evidence, including cleared flag',()=>{
 assert.equal(classifyHistoricalAmount(candidate,snap(),{}).action,'correct');
 for(const c of [change(x=>x.newAmount=x.oldTransaction.amount),change(x=>x.newAmount=0),change(x=>x.statementId=''),change(x=>x.receiptId='not-a-gmail-id'),change(x=>x.evidence=''),change(x=>x.extra=true),change(x=>x.oldTransaction.reconciled=true),change(x=>x.oldTransaction.transfer_id='other'),change(x=>x.oldTransaction.is_parent=true),change(x=>x.oldTransaction.schedule='schedule'),change(x=>x.oldTransaction.starting_balance_flag=true),change(x=>x.oldTransaction.tombstone=true),change(x=>x.oldTransaction.date='2023-02-30')])assert.throws(()=>classifyHistoricalAmount(c,snap(),{}));
 const altered=snap();altered.transactions[0].cleared=false;assert.throws(()=>classifyHistoricalAmount(candidate,altered,{}));
 assert.throws(()=>classifyHistoricalAmount(candidate,snap(),{records:{source:{transactionId:'tx'}}}));
 assert.throws(()=>classifyHistoricalAmount(candidate,snap(),{cashflows:{source:{id:'tx'}}}));
});

test('rejects matching deleted, opening balance or impossible-date records',()=>{
 for(const mutate of [x=>x.starting_balance_flag=true,x=>x.tombstone=true,x=>x.date='2023-02-30']){
  const c=change(x=>mutate(x.oldTransaction)),s=snap();s.transactions[0]=structuredClone(c.oldTransaction);assert.throws(()=>classifyHistoricalAmount(c,s,{}));
 }
});

test('backup precedes the write; readback preserves cleared and retry is read-only',async()=>{
 let live=snap(),state={},events=[];
 const api={async shutdown(){},async sync(){},async updateTransaction(id,patch){events.push('write');assert.deepEqual(patch,{amount:-999900});live.transactions[0].amount=patch.amount;live.balances.a-=900},async getTransactions(){return structuredClone(live.transactions)}};
 const d={async connect(){return {api}},async snapshot(){return structuredClone(live)},async readState(){return structuredClone(state)},async requireRun(){return structuredClone(state)},async backup(){events.push('backup');return '/private/backup'},async json(){},async save(x){state=structuredClone(x)}};
 assert((await correctHistoricalAmount(candidate,true,d)).verified);assert.equal(live.transactions[0].cleared,true);assert((await correctHistoricalAmount(candidate,true,d)).verified);assert.deepEqual(events,['backup','write']);
});

test('unaudited partial write and concurrent modification both fail closed',async()=>{
 let live=snap();live.transactions[0].amount=-999900;live.balances.a-=900;assert.throws(()=>classifyHistoricalAmount(candidate,live,{}));
 live=snap();let events=[];const api={async shutdown(){},async sync(){},async updateTransaction(){events.push('write')}};const d={async connect(){return {api}},async snapshot(){return structuredClone(live)},async requireRun(){return{}},async backup(){live.balances.a++;return '/private/backup'},async json(){}};
 await assert.rejects(correctHistoricalAmount(candidate,true,d),/Budget changed/);assert.deepEqual(events,[]);
});

test('readback rejects unrelated changes and does not record an audit',async()=>{
 let live=snap(),state={};const api={async shutdown(){},async sync(){},async updateTransaction(id,patch){live.transactions[0].amount=patch.amount;live.transactions[0].cleared=false;live.balances.a-=900},async getTransactions(){return structuredClone(live.transactions)}};
 const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async readState(){return state},async requireRun(){return state},async backup(){return '/private/backup'},async json(){},async save(x){state=x}};
 await assert.rejects(correctHistoricalAmount(candidate,true,d));assert.equal(state.historicalExpenseAmountCorrections,undefined);
});

const subscriptionFixture=()=>{
 const target={...structuredClone(old),date:'2024-04-17',amount:-176400,notes:'YouTube Premium',cleared:false};
 const previous={...structuredClone(target),id:'prior-subscription',date:'2024-03-17'};
 const c={historicalExpenseAmountCorrection:true,currency:'CLP',oldTransaction:target,newAmount:-179800,statementId:'statement_april_123',subscriptionEvidence:{previousStatementId:'statement_march_123',noticeId:'18ef3af339b55f5a',previous},evidence:'Operator reviewed the two bank statements and the subscription service notice.'};
 const s=snap();s.transactions=structuredClone([target,previous]);s.balances.a=-352800;return {c,s};
};
test('plans recurring subscription correction with two statements and service notice',()=>{
 const {c,s}=subscriptionFixture();const r=classifyHistoricalAmount(c,s,{});assert.equal(r.action,'correct');assert.equal(r.balanceDelta,-3400);
});
test('subscription correction rejects mixed or ambiguous evidence and bounds',()=>{
 for(const mutate of [
  c=>{c.receiptId='18643987b3ef2860'},
  c=>{c.subscriptionEvidence.previousStatementId=c.statementId},
  c=>{c.subscriptionEvidence.noticeId='bad'},
  c=>{c.subscriptionEvidence.extra=true},
  c=>{c.currency='USD'},
  c=>{c.newAmount=c.oldTransaction.amount-10100},
  c=>{c.newAmount=c.oldTransaction.amount-8900},
  c=>{c.subscriptionEvidence.previous.date='2024-02-17'},
  c=>{c.subscriptionEvidence.previous.date='2024-03-18'},
  c=>{c.subscriptionEvidence.previous.notes='Other service'},
  c=>{c.subscriptionEvidence.previous.amount-=100},
  c=>{c.subscriptionEvidence.previous.account='other'},
  c=>{c.subscriptionEvidence.previous.payee='other'},
  c=>{c.subscriptionEvidence.previous.category='other'},
  c=>{c.subscriptionEvidence.previous.is_parent=true},
  c=>{c.statementSeries={}},
  (c,s)=>{s.transactions.push({...structuredClone(c.oldTransaction),id:'ambiguous'})},
  (c,s)=>{s.transactions[1].amount++},
 ]){const {c,s}=subscriptionFixture();mutate(c,s);assert.throws(()=>classifyHistoricalAmount(c,s,{}));}
});
test('subscription correction backs up and preserves neighbor on exact retry',async()=>{
 const {c,s}=subscriptionFixture();let live=structuredClone(s),state={},events=[];
 const api={async shutdown(){},async sync(){},async updateTransaction(id,patch){events.push('write');live.transactions.find(t=>t.id===id).amount=patch.amount;live.balances.a+=c.newAmount-c.oldTransaction.amount},async getTransactions(){return structuredClone(live.transactions)}};
 const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async readState(){return structuredClone(state)},async requireRun(){return structuredClone(state)},async backup(){events.push('backup');return '/private/backup'},async json(){},async save(x){state=structuredClone(x)}};
 assert.equal((await correctHistoricalAmount(c,true,d)).verified,true);assert.equal((await correctHistoricalAmount(c,true,d)).action,'existing');assert.deepEqual(events,['backup','write']);assert.deepEqual(live.transactions[1],s.transactions[1]);
});
