import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyHistoricalProviderNote,amendHistoricalProviderNote} from './actual-historical-provider-note.mjs';

const old={id:'tx',account:'account',date:'2025-09-08',amount:-918100,payee:'github',category:'subs',notes:'Github Copilot 10USD',imported_id:null,is_parent:false,is_child:false,parent_id:null,transfer_id:null,subtransactions:[],reconciled:false,cleared:false,schedule:null};
const candidate={historicalProviderNote:true,currency:'CLP',oldTransaction:old,oldText:'10USD',newText:'USD 9,33',statementId:'statement_123',providerReceiptId:'receipt_123',evidence:'Operator read the bank statement and provider receipt and matched the transaction.'};
const snap=()=>({accounts:[{id:'account',closed:false,offbudget:false}],transactions:[structuredClone(old)],categories:[{id:'subs'}],payees:[{id:'github'}],balances:{account:-918100}});
test('plans one literal historical note correction and rejects unsafe or ambiguous state',()=>{
 const p=structuredClone(candidate);assert.equal(classifyHistoricalProviderNote(p,snap(),{}).newNotes,'Github Copilot USD 9,33');
 for(const change of [x=>x.providerReceiptId=x.statementId,x=>x.providerReceiptId='bad',x=>x.oldText='missing',x=>x.newText='#tag',x=>x.newText='https://example.com',x=>x.oldTransaction.notes+='#tag',x=>x.oldTransaction.reconciled=true,x=>x.oldTransaction.imported_id='gmail:abc',x=>x.extra=true]){
  const c=structuredClone(candidate);change(c);const s=snap();s.transactions[0]=structuredClone(c.oldTransaction);assert.throws(()=>classifyHistoricalProviderNote(c,s,{}));
 }
 assert.throws(()=>classifyHistoricalProviderNote(candidate,snap(),{records:{source:{transactionId:'tx'}}}));
});
test('backs up and independently verifies one write; exact retry is read-only',async()=>{
 let live=snap(),state={},events=[];const api={async shutdown(){},async sync(){},async updateTransaction(id,p){events.push('write');live.transactions[0].notes=p.notes}};
 const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async readState(){return structuredClone(state)},async requireRun(){return structuredClone(state)},async backup(){events.push('backup');return '/private/backup'},async json(){},async save(x){state=structuredClone(x)}};
 assert.equal((await amendHistoricalProviderNote(candidate,true,d)).verified,true);assert.equal((await amendHistoricalProviderNote(candidate,true,d)).verified,true);assert.deepEqual(events,['backup','write']);assert.equal(live.transactions[0].notes,'Github Copilot USD 9,33');
});
test('rejects unaudited altered note',()=>{const s=snap();s.transactions[0].notes='Github Copilot USD 9,33';assert.throws(()=>classifyHistoricalProviderNote(candidate,s,{}));});
test('refuses a concurrent change before writing and unrelated changes during readback',async()=>{
 for(const when of ['backup','write']){
  let live=snap(),state={},writes=0;const api={async shutdown(){},async sync(){},async updateTransaction(id,p){writes++;live.transactions[0].notes=p.notes;if(when==='write')live.balances.account++}};
  const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async requireRun(){return structuredClone(state)},async backup(){if(when==='backup')live.balances.account++;return '/private/backup'},async json(){},async save(x){state=structuredClone(x)}};
  await assert.rejects(amendHistoricalProviderNote(candidate,true,d));assert.equal(writes,when==='write'?1:0);assert.equal(state.historicalProviderNotes,undefined);
 }
});
