import test from 'node:test';
import assert from 'node:assert/strict';
import * as actual from './actual-transfer-destination.mjs';

test('historical transfer retirement exposes a guarded classifier',()=>{
 assert.equal(typeof actual.classifyTransferRetirement,'function');
});
const p={historicalTransferRetirement:true,currency:'CLP',originId:'o',legId:'l',originAccount:'a',destination:'b',date:'2026-04-01',amount:-42300000,driveFileIds:['statementOne','statementTwo'],evidence:'Both reviewed bank statements cover both accounts and date and show no transfer.'};
const snap=()=>({accounts:[{id:'a'},{id:'b'}],payees:[{id:'pa',transfer_acct:'a'},{id:'pb',transfer_acct:'b'}],transactions:[{id:'o',account:'a',payee:'pb',transfer_id:'l',date:p.date,amount:p.amount,notes:null,imported_id:null},{id:'l',account:'b',payee:'pa',transfer_id:'o',date:p.date,amount:-p.amount,notes:null,imported_id:null}],balances:{a:-42300000,b:42300000},categories:[],rules:[],schedules:[]});
test('requires two distinct statements and exact unlinked reciprocal historical pair',()=>{
 const f=actual.classifyTransferRetirement;assert.equal(f(p,snap(),{}).action,'retire');
 for(const change of [s=>s.transactions[0].reconciled=true,s=>s.transactions[0].notes='source',s=>s.transactions[1].amount++,s=>s.transactions[0].schedule='s',s=>s.transactions.pop(),s=>s.accounts[1].closed=true]){const s=snap();change(s);assert.throws(()=>f(p,s,{}));}
 assert.throws(()=>f({...p,driveFileIds:['same','same']},snap(),{}));
 assert.throws(()=>f(p,snap(),{cashflows:{x:{id:'o'}}}));
 assert.throws(()=>f(p,snap(),{records:{x:{transactionId:'l'}}}));
});
test('unexplained missing pair fails closed',()=>{const s=snap();s.transactions=[];assert.throws(()=>actual.classifyTransferRetirement(p,s,{}));});
test('retires only the exact pair, verifies both balances and retries without rewriting',async()=>{
 let s=snap(),state={},writes=0,backs=0;
 const ctx={readState:async()=>state,requireRun:async()=>state,connect:async()=>({api:{sync:async()=>{},shutdown:async()=>{},deleteTransaction:async id=>{assert.equal(id,writes===0?'o':'l');writes++;if(writes===2){s.transactions=[];s.balances.a-=p.amount;s.balances.b+=p.amount;}}}}),snapshot:async()=>structuredClone(s),backup:async()=>{backs++;return '/backup'},json:async()=>{},save:async()=>{}};
 let r=await actual.retireHistoricalTransfer(p,true,ctx);assert(r.verified);assert.equal(writes,2);assert.equal(backs,1);
 r=await actual.retireHistoricalTransfer(p,true,ctx);assert.equal(r.action,'existing');assert.equal(writes,2);
});
