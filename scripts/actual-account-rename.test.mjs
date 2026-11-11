import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAccountRename, renameAccount } from './actual-account-rename.mjs';

const candidate={accountRename:true,currency:'CLP',account:'account-1',oldName:'CMR Falabella 7421',newName:'CMR Falabella',evidence:'La tarjeta renovada corresponde al mismo contrato.'};
const initial=()=>({accounts:[{id:'account-1',name:'CMR Falabella 7421',closed:false,offbudget:false},{id:'account-2',name:'Otra',closed:false,offbudget:false}],payees:[{id:'payee-1',name:'CMR Falabella 7421',transfer_acct:'account-1'},{id:'payee-2',name:'Otra',transfer_acct:'account-2'}],transactions:[{id:'tx-1',account:'account-1',amount:-12300}],categories:[],rules:[],schedules:[],balances:{'account-1':-12300,'account-2':0}});

test('plans only an identified active account with a unique new name',()=>{
 assert.equal(classifyAccountRename(candidate,initial(),{}).action,'rename');
 for(const patch of [{oldName:'incorrecto'},{newName:'Otra'},{account:'missing'},{evidence:''},{currency:'EUR'},{extra:true}])assert.throws(()=>classifyAccountRename({...candidate,...patch},initial(),{}));
 const s=initial();s.accounts[0].closed=true;assert.throws(()=>classifyAccountRename(candidate,s,{}));
});

test('rejects unsupported currencies before connecting',async()=>{
 for(const currency of ['EUR','__proto__'])await assert.rejects(renameAccount({...candidate,currency},false,{budgets:{CLP:{syncId:'budget'}},readState:async()=>({}),connect:async()=>{throw Error('unexpected connection')}}),/Unsupported budget/);
});

test('renames once with backup and verifies the same transactions and balances',async()=>{
 let snapshot=initial(),state={},backups=0,writes=0;
 const ctx={budgets:{CLP:{syncId:'budget'}},readState:async()=>state,requireRun:async()=>state,save:async s=>{state=s},backup:async()=>{backups++;return '/backup'},json:async()=>{},equal:(a,b,m)=>assert.deepEqual(a,b,m),snapshot:async()=>structuredClone(snapshot),connect:async()=>({api:{sync:async()=>{},shutdown:async()=>{},updateAccount:async(id,fields)=>{writes++;assert.equal(id,'account-1');assert.deepEqual(fields,{name:'CMR Falabella'});snapshot.accounts[0].name=fields.name;snapshot.payees[0].name=fields.name;}}})};
 const result=await renameAccount(candidate,true,ctx);assert.equal(result.verified,true);assert.equal(result.id,'account-1');assert.equal(backups,1);assert.equal(writes,1);assert.equal(snapshot.transactions[0].amount,-12300);assert.equal(snapshot.balances['account-1'],-12300);
 const again=await renameAccount(candidate,true,ctx);assert.equal(again.action,'existing');assert.equal(writes,1);
});

test('rejects an already changed name without matching audit and unrelated changes during readback',async()=>{
 const s=initial();s.accounts[0].name='CMR Falabella';assert.throws(()=>classifyAccountRename(candidate,s,{}));
 let snapshot=initial(),state={};
 const ctx={budgets:{CLP:{syncId:'budget'}},readState:async()=>state,requireRun:async()=>state,save:async s=>{state=s},backup:async()=>'/backup',json:async()=>{},equal:(a,b,m)=>assert.deepEqual(a,b,m),snapshot:async()=>structuredClone(snapshot),connect:async()=>({api:{sync:async()=>{},shutdown:async()=>{},updateAccount:async()=>{snapshot.accounts[0].name='CMR Falabella';snapshot.transactions[0].amount=-1;}}})};
 await assert.rejects(renameAccount(candidate,true,ctx),/transactions/);assert.equal(state.accountRenames,undefined);
});
