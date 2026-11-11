import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyUnbilledSubscription,retireUnbilledSubscription} from './actual-unbilled-subscription.mjs';

function fixture(){
 const old={id:'old',account:'card',date:'2024-07-06',amount:-449000,category:'music',payee:'apple',notes:'Apple Music',imported_id:null,is_parent:false,is_child:false,parent_id:null,transfer_id:null,schedule:null,reconciled:false,cleared:true,subtransactions:[]};
 const bundle={id:'bundle',account:'card',date:'2024-07-05',amount:-939000,category:'subscriptions',payee:'apple',notes:'Apple One (iCloud, tv, Music and Arcade)',imported_id:null,is_parent:false,is_child:false,parent_id:null,transfer_id:null,schedule:null,reconciled:false,cleared:true,subtransactions:[]};
 const p={unbilledBundledSubscriptionRetirement:true,currency:'CLP',old,bundle,standaloneText:'Apple Music',bundleText:'Apple One',includedText:'Music',receiptId:'19081c3543cc1d73',providerOrderId:'MT8X0F77GM',statementIds:['statementJuly','statementAugust'],evidence:'Provider purchase history for the whole period and consecutive complete CMR statements show Apple One and no separate Apple Music charge.'};
 const s={accounts:[{id:'card',closed:false,offbudget:false}],payees:[{id:'apple',name:'Apple'}],categories:[{id:'music'},{id:'subscriptions'}],transactions:[structuredClone(old),structuredClone(bundle)],balances:{card:-1388000},rules:[],schedules:[]};
 return {p,s,l:{records:{},cashflows:{}}};
}
test('previews only the exact externally disproved standalone record',()=>{const {p,s,l}=fixture();const r=classifyUnbilledSubscription(p,s,l);assert.equal(r.action,'retire');assert.equal(r.id,'old');assert.equal(r.retainedId,'bundle');});
test('rejects stale snapshots, weak evidence, unauthorized identities and ambiguous ledger state',()=>{
 const mutations=[x=>x.p.evidence='',x=>x.p.receiptId='',x=>x.p.providerOrderId='',x=>x.p.statementIds=['statementJuly'],x=>x.p.statementIds=['same','same'],x=>x.s.transactions[0].amount--,x=>x.p.old.reconciled=true,x=>x.p.old.schedule='schedule',x=>x.p.old.imported_id='gmail:source',x=>x.p.old.payee='other',x=>x.p.bundle.notes='something else',x=>x.l.records.source={transactionId:'old'},x=>x.l.cashflows.source={id:'old'},x=>x.l.unbilledBundledSubscriptions={old:{status:'pending'}},x=>x.s.transactions.push({...x.p.bundle,id:'duplicate'})];
 for(const [index,mutate] of mutations.entries()){const x=fixture();mutate(x);assert.throws(()=>classifyUnbilledSubscription(x.p,x.s,x.l),`mutation ${index}`);}
});
test('backs up and deletes once, verifies budget and permits an audited read-only retry',async()=>{
 const {p,s,l}=fixture();const live=structuredClone(s);let deletes=0,backups=0,saves=0;const api={sync:async()=>{},shutdown:async()=>{},deleteTransaction:async id=>{deletes++;live.transactions=live.transactions.filter(t=>t.id!==id);live.balances.card-=p.old.amount;}};
 const d={connect:async()=>({api}),snapshot:async()=>structuredClone(live),backup:async()=>{backups++;return '/backup'},json:async()=>{},requireRun:async()=>l,readState:async()=>l,save:async()=>{saves++;}};
 const result=await retireUnbilledSubscription(p,true,d);assert.equal(result.verified,true);assert.equal(deletes,1);assert.equal(backups,1);assert.ok(saves>=2);assert.deepEqual(live.transactions,[s.transactions[1]]);assert.equal(l.unbilledBundledSubscriptions.old.old.cleared,true);
 const retry=await retireUnbilledSubscription(p,true,d);assert.equal(retry.action,'existing');assert.equal(deletes,1);
});
test('an interrupted delete preserves intent and prevents blind retry',async()=>{
 const {p,s,l}=fixture();let deletes=0;const api={sync:async()=>{},shutdown:async()=>{},deleteTransaction:async()=>{deletes++;throw Error('interrupted')}};
 const d={connect:async()=>({api}),snapshot:async()=>structuredClone(s),backup:async()=>'/backup',json:async()=>{},requireRun:async()=>l,readState:async()=>l,save:async()=>{}};
 await assert.rejects(retireUnbilledSubscription(p,true,d),/interrupted/);assert.equal(l.unbilledBundledSubscriptions.old.status,'pending');await assert.rejects(retireUnbilledSubscription(p,true,d),/pending/i);assert.equal(deletes,1);
});
test('a changed retained purchase after deletion leaves intent pending',async()=>{
 const {p,s,l}=fixture();const live=structuredClone(s);const api={sync:async()=>{},shutdown:async()=>{},deleteTransaction:async()=>{live.transactions=live.transactions.filter(t=>t.id!=='old');live.transactions[0].amount--;live.balances.card-=p.old.amount;}};
 const d={connect:async()=>({api}),snapshot:async()=>structuredClone(live),backup:async()=>'/backup',json:async()=>{},requireRun:async()=>l,readState:async()=>l,save:async()=>{}};
 await assert.rejects(retireUnbilledSubscription(p,true,d));assert.equal(l.unbilledBundledSubscriptions.old.status,'pending');
});
