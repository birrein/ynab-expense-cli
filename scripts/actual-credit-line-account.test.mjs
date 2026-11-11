import test from 'node:test';import assert from 'node:assert/strict';import * as policy from './actual-daily-policy.mjs';
test('credit line account has evidence-bound classifier',()=>assert.equal(typeof policy.classifyCreditLineAccount,'function'));
const c={verifiedCreditLineAccount:true,currency:'CLP',name:'Credit Line',statementFileId:'statement_123',openingDate:'2026-05-01',evidence:'Bank statement identifies account and zero initial utilization.'};
const snap=()=>({accounts:[],payees:[],transactions:[],balances:{},categories:[],rules:[],schedules:[]});
test('plans verified zero-opening account and rejects collisions and malformed evidence',()=>{
 const f=policy.classifyCreditLineAccount;assert.equal(f(c,snap(),{}).action,'create');
 for(const patch of [{statementFileId:''},{openingDate:'2026-02-30'},{evidence:''},{currency:'EUR'},{other:true}])assert.throws(()=>f({...c,...patch},snap(),{}));
 const s=snap();s.accounts.push({id:'a',name:c.name,closed:false,offbudget:false});assert.throws(()=>f(c,s,{}));
});
test('only exact completed audit makes retry idempotent',()=>{
 const f=policy.classifyCreditLineAccount,s=snap();s.accounts.push({id:'a',name:c.name,closed:false,offbudget:false});s.payees.push({id:'pa',name:c.name,transfer_acct:'a'});
 const ledger={creditLineAccounts:{[c.statementFileId]:{candidate:c,id:'a'}}};assert.equal(f(c,s,ledger).action,'existing');assert.throws(()=>f({...c,evidence:'different'},s,ledger));
});
test('creates one verified account and transfer payee without touching existing data',async()=>{
 assert.equal(typeof policy.createVerifiedCreditLine,'function');let s=snap(),state={},writes=0,backups=0;
 const ctx={readState:async()=>state,requireRun:async()=>state,connect:async()=>({api:{sync:async()=>{},shutdown:async()=>{},createAccount:async()=>{writes++;s.accounts.push({id:'new',name:c.name,offbudget:false,closed:false});s.payees.push({id:'payee',name:c.name,transfer_acct:'new'});s.balances.new=0;return 'new';}}}),snapshot:async()=>structuredClone(s),backup:async()=>{backups++;return '/backup'},json:async()=>{},save:async()=>{}};
 let r=await policy.createVerifiedCreditLine(c,true,ctx);assert(r.verified);assert.equal(writes,1);assert.equal(backups,1);
 r=await policy.createVerifiedCreditLine(c,true,ctx);assert.equal(r.action,'existing');assert.equal(writes,1);
});
test('rejects unsupported currency before connecting to a budget',async()=>{
 let calls=0;await assert.rejects(policy.createVerifiedCreditLine({...c,currency:'EUR'},false,{readState:async()=>({}),connect:async()=>{calls++;throw Error('unexpected connection')}}),/Unsupported budget/);assert.equal(calls,0);
});
