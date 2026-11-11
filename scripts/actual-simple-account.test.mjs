import test from 'node:test';
import assert from 'node:assert/strict';
import * as existing from './actual-split-account.mjs';

const tx={id:'test-id',account:'old',date:'2026-01-09',amount:-620000,is_parent:false,is_child:false,transfer_id:null,reconciled:false,cleared:false,schedule:null,imported_id:null,payee:null,category:'alcohol',notes:'Chelas',subtransactions:[]};
const candidate={historicalSimpleAccountCorrection:true,currency:'CLP',oldTransaction:tx,targetAccount:'new',receiptUrl:'https://mail.google.com/mail/u/0/#all/19ba59d24c3fcd6d',oldStatementId:'oldstatement1',targetStatementId:'newstatement1',evidence:'Source statement does not show the charge; destination statement and bank notice match.'};
const snap={accounts:[{id:'old'},{id:'new'}],transactions:[tx],balances:{old:-620000,new:0},categories:[],payees:[],rules:[],schedules:[]};

test('simple account correction classifier is exposed',()=>assert.equal(typeof existing.classifySimpleAccount,'function'));
test('evidenced simple transaction is accepted and conflicting identities or duplicates are rejected',()=>{
 const c=existing.classifySimpleAccount;
 assert.equal(c(candidate,snap,{}).action,'correct');
 assert.throws(()=>c({...candidate,receiptUrl:''},snap,{}));
 assert.throws(()=>c({...candidate,oldStatementId:candidate.targetStatementId},snap,{}));
 assert.throws(()=>c(candidate,snap,{records:{x:{transactionId:tx.id}}}));
 let s=structuredClone(snap);s.transactions.push({...tx,id:'duplicate',account:'new',date:'2026-01-12'});assert.throws(()=>c(candidate,s,{}),/duplicate/i);
 s=structuredClone(snap);s.transactions[0].notes='changed';assert.throws(()=>c(candidate,s,{}));
 s=structuredClone(snap);s.accounts[1].closed=true;assert.throws(()=>c(candidate,s,{}));
});

test('backs up and audits before updating, verifies full readback, and retry does not write',async()=>{
 assert.equal(typeof existing.correctSimpleAccount,'function');
 let live=structuredClone(snap),ledger={},events=[];
 const api={async sync(){},async shutdown(){},async getTransactions(){return structuredClone(live.transactions)},async updateTransaction(id,patch){events.push('write');assert.equal(ledger.historicalSimpleAccountCorrections[id].status,'pending');assert.equal(patch.payee,null);live.transactions[0].account=patch.account;live.balances={old:0,new:-620000}}};
 const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async requireRun(){return structuredClone(ledger)},async readState(){return structuredClone(ledger)},async save(s){ledger=structuredClone(s);events.push('audit:'+ledger.historicalSimpleAccountCorrections[tx.id].status)},async backup(){events.push('backup');return '/private/backup'},async json(){}};
 assert.equal((await existing.correctSimpleAccount(candidate,true,d)).verified,true);
 assert.equal((await existing.correctSimpleAccount(candidate,true,d)).verified,true);
 assert.deepEqual(events,['backup','audit:pending','write','audit:complete']);
});

test('pending audit blocks a second write after partial failure',async()=>{
 assert.equal(typeof existing.correctSimpleAccount,'function');let ledger={},writes=0,live=structuredClone(snap);
 const api={async sync(){},async shutdown(){},async updateTransaction(){writes++;throw Error('write failed')}};
 const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async requireRun(){return structuredClone(ledger)},async readState(){return structuredClone(ledger)},async save(s){ledger=structuredClone(s)},async backup(){return '/private/backup'},async json(){}};
 await assert.rejects(existing.correctSimpleAccount(candidate,true,d),/write failed/);
 await assert.rejects(existing.correctSimpleAccount(candidate,true,d),/pending audit/i);
 assert.equal(writes,1);
});

test('unexpected readback changes fail closed with pending audit',async()=>{
 let live=structuredClone(snap),ledger={},snapshots=0;
 const api={async sync(){},async shutdown(){},async getTransactions(){return structuredClone(live.transactions)},async updateTransaction(id,p){live.transactions[0].account=p.account;live.balances={old:0,new:-620000}}};
 const d={async connect(){return{api}},async snapshot(){snapshots++;let s=structuredClone(live);if(snapshots===3)s.categories.push({id:'unexpected'});return s},async requireRun(){return structuredClone(ledger)},async readState(){return structuredClone(ledger)},async save(s){ledger=structuredClone(s)},async backup(){return '/private/backup'},async json(){}};
 await assert.rejects(existing.correctSimpleAccount(candidate,true,d),/Unrelated state/);
 assert.equal(ledger.historicalSimpleAccountCorrections[tx.id].status,'pending');
});
