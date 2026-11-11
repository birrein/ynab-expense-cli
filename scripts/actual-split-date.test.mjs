import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySplitDate,correctSplitDate} from './actual-split-date.mjs';
const parent={id:'tx',account:'a',date:'2024-01-14',amount:-2869700,is_parent:true,is_child:false,parent_id:null,transfer_id:null,reconciled:false,cleared:true,schedule:null,imported_id:null,payee:'p',notes:null,subtransactions:[
 {id:'c1',parent_id:'tx',is_parent:false,is_child:true,account:'a',date:'2024-01-14',amount:-1521700,category:'clean',payee:'p',notes:'detergent',cleared:true,reconciled:false,transfer_id:null,schedule:null},
 {id:'c2',parent_id:'tx',is_parent:false,is_child:true,account:'a',date:'2024-01-14',amount:-1348000,category:'bike',payee:'p',notes:'bicycle parts',cleared:true,reconciled:false,transfer_id:null,schedule:null}]};
const p={historicalSplitDateCorrection:true,currency:'CLP',oldParent:parent,newDate:'2024-01-18',preserveCleared:true,purchaseMessageId:'18d1d7e591fd35c7',statementFileId:'statement123',evidence:'Purchase receipt and bank statement identify card, transaction, amount and date.'};
const snapshot={accounts:[{id:'a',closed:false,offbudget:false}],transactions:[parent],balances:{a:-2869700},categories:[],payees:[],rules:[],schedules:[]};
const clone=structuredClone;
test('previews an evidenced uncleared split only when every status is explicitly preserved',()=>{
 const old=clone(parent);old.cleared=false;old.subtransactions.forEach(c=>c.cleared=false);
 const candidate={...p,oldParent:old,preserveCleared:false};const state={...snapshot,transactions:[old]};
 assert.equal(classifySplitDate(candidate,state,{}).action,'amend-date');
 for(const flag of [true,null,undefined,0])assert.throws(()=>classifySplitDate({...candidate,preserveCleared:flag},state,{}));
 const mixed=clone(old);mixed.subtransactions[0].cleared=true;
 assert.throws(()=>classifySplitDate({...candidate,oldParent:mixed},{...state,transactions:[mixed]},{}));
});
test('applies and retries an uncleared split without changing statuses',async()=>{
 const old=clone(parent);old.cleared=false;old.subtransactions.forEach(c=>c.cleared=false);
 const candidate={...p,oldParent:old,preserveCleared:false};let live={...clone(snapshot),transactions:[clone(old)]},ledger={},writes=0;
 const api={async sync(){},async shutdown(){},async updateTransaction(id,v){writes++;live.transactions[0].date=v.date;live.transactions[0].subtransactions.forEach(c=>c.date=v.date)}};
 const d={async connect(){return {api}},async snapshot(){return clone(live)},async requireRun(){return clone(ledger)},async readState(){return clone(ledger)},async save(s){ledger=clone(s)},async backup(){return '/backup'},async json(){}};
 assert.equal((await correctSplitDate(candidate,true,d)).verified,true);assert.equal((await correctSplitDate(candidate,true,d)).action,'existing');
 assert.equal(writes,1);assert.equal(live.transactions[0].cleared,false);assert(live.transactions[0].subtransactions.every(c=>c.cleared===false));
});
test('previews only the date of an exact evidenced cleared split',()=>{assert.equal(classifySplitDate(p,snapshot,{}).action,'amend-date')});
test('refuses missing evidence, unsafe dates, reconciled children, altered snapshots, ledger ownership and duplicates',()=>{
 for(const bad of [{purchaseMessageId:''},{preserveCleared:false},{newDate:'2024-02-01'},{newDate:'2024-01-25'},{evidence:''}])assert.throws(()=>classifySplitDate({...p,...bad},snapshot,{}));
 let s=clone(snapshot);s.transactions[0].subtransactions[0].amount--;assert.throws(()=>classifySplitDate(p,s,{}));
 s=clone(snapshot);s.transactions[0].reconciled=true;assert.throws(()=>classifySplitDate({...p,oldParent:s.transactions[0]},s,{}));
 s=clone(snapshot);s.transactions[0].subtransactions[0].reconciled=true;assert.throws(()=>classifySplitDate({...p,oldParent:s.transactions[0]},s,{}));
 s=clone(snapshot);s.transactions.push({id:'other',account:'a',date:'2024-01-18',amount:-2869700});assert.throws(()=>classifySplitDate(p,s,{}));
 assert.throws(()=>classifySplitDate(p,snapshot,{records:{x:{transactionId:'c1'}}}));
 assert.throws(()=>classifySplitDate(p,snapshot,{historicalSplitDateCorrections:{tx:{status:'pending',candidate:p}}}));
});
test('backs up and persists pending audit before one write; exact retry only verifies',async()=>{
 let live=clone(snapshot),ledger={},events=[];
 const api={async sync(){},async shutdown(){},async updateTransaction(id,v){events.push('write');assert.equal(ledger.historicalSplitDateCorrections.tx.status,'pending');live.transactions[0].date=v.date;live.transactions[0].subtransactions.forEach(c=>c.date=v.date)}};
 const d={async connect(){return {api}},async snapshot(){return clone(live)},async requireRun(){return clone(ledger)},async readState(){return clone(ledger)},async save(s){ledger=clone(s)},async backup(){events.push('backup');return '/backup'},async json(){}};
 assert.equal((await correctSplitDate(p,true,d)).verified,true);assert.equal((await correctSplitDate(p,true,d)).verified,true);assert.deepEqual(events,['backup','write']);
});
test('failed update leaves pending audit and blocks a second write',async()=>{
 let ledger={},writes=0;const api={async sync(){},async shutdown(){},async updateTransaction(){writes++;throw Error('interrupted')}};
 const d={async connect(){return{api}},async snapshot(){return clone(snapshot)},async requireRun(){return clone(ledger)},async readState(){return clone(ledger)},async save(s){ledger=clone(s)},async backup(){return '/backup'},async json(){}};
 await assert.rejects(correctSplitDate(p,true,d),/interrupted/);await assert.rejects(correctSplitDate(p,true,d),/pending/i);assert.equal(writes,1);
});
test('a backup failure prevents every financial write',async()=>{
 let writes=0;const api={async shutdown(){},async updateTransaction(){writes++}};
 const d={async connect(){return{api}},async snapshot(){return clone(snapshot)},async requireRun(){return{}},async backup(){throw Error('backup failure')}};
 await assert.rejects(correctSplitDate(p,true,d),/backup failure/);assert.equal(writes,0);
});
test('unexpected unrelated state leaves the audit pending',async()=>{
 let live=clone(snapshot),ledger={};const api={async sync(){},async shutdown(){},async updateTransaction(id,v){live.transactions[0].date=v.date;live.transactions[0].subtransactions.forEach(c=>c.date=v.date);live.balances.a++}};
 const d={async connect(){return{api}},async snapshot(){return clone(live)},async requireRun(){return clone(ledger)},async readState(){return clone(ledger)},async save(s){ledger=clone(s)},async backup(){return '/backup'},async json(){}};
 await assert.rejects(correctSplitDate(p,true,d),/balances/);assert.equal(ledger.historicalSplitDateCorrections.tx.status,'pending');
});
