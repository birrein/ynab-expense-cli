import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as api from './actual-runtime/node_modules/@actual-app/api/dist/index.js';

test('official API retains linked IDs, amounts and distinct cleared flags while correcting both dates',async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'actual-transfer-date-'));
 try{const rt=await api.init({dataDir:tmp});await rt.send('create-budget',{budgetName:'Offline transfer date test',avoidUpload:true});const a=await api.createAccount({name:'Origin'}),b=await api.createAccount({name:'Destination'}),payee=(await api.getPayees()).find(x=>x.transfer_acct===b);await api.addTransactions(a,[{date:'2024-06-05',amount:-4000000,payee:payee.id,cleared:false}],{runTransfers:true,learnCategories:false});let left=(await api.getTransactions(a,'2024-06-05','2024-06-05'))[0],right=(await api.getTransactions(b,'2024-06-05','2024-06-05'))[0];assert.equal(left.transfer_id,right.id);await api.updateTransaction(right.id,{cleared:true});await api.updateTransaction(left.id,{date:'2024-06-04'});await api.updateTransaction(right.id,{date:'2024-06-04'});let x,y;for(let i=0;i<50;i++){x=(await api.getTransactions(a,'2024-06-04','2024-06-04'))[0];y=(await api.getTransactions(b,'2024-06-04','2024-06-04'))[0];if(x&&y)break;await new Promise(r=>setTimeout(r,100))}assert.equal(x.id,left.id);assert.equal(y.id,right.id);assert.equal(x.transfer_id,y.id);assert.equal(y.transfer_id,x.id);assert.equal(x.amount,-4000000);assert.equal(y.amount,4000000);assert.equal(x.cleared,false);assert.equal(y.cleared,true);
 }finally{try{await api.shutdown()}catch{}await rm(tmp,{recursive:true,force:true})}
});
