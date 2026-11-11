import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BUDGETS} from './actual-daily-policy.mjs';

const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const equal=(a,b,m)=>assert.deepEqual(canonical(a),canonical(b),m);

function allocateWallet(p){
 const card=p.cardTransaction,total=BigInt(-p.total/100),weightSum=p.categoryWeights.reduce((n,w)=>n+BigInt(w.weight),0n);const amounts=p.categoryWeights.map((w,i)=>{const weighted=total*BigInt(w.weight);return {i,whole:weighted/weightSum,remainder:weighted%weightSum}});let remainder=total-amounts.reduce((n,x)=>n+x.whole,0n);for(const a of [...amounts].sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1)){if(remainder>0n){a.whole++;remainder--}}
 const splits=p.categoryWeights.map((w,i)=>{const previous=card.subtransactions.find(c=>c.category===w.category);const residual=Number(amounts[i].whole)*100+previous.amount;assert(Number.isSafeInteger(residual)&&residual>0,'Invalid allocation residual');return {category:w.category,amount:-residual}});assert.equal(splits.reduce((n,x)=>n+x.amount,0),p.amount,'Wallet split does not sum');return splits;
}

export function classifyMixedSplit(p,s,l){
 equal(Object.keys(p).sort(),['mixedUberCashSplit','currency','wallet','receipt','statementFileId','cardTransaction','cardRecord','amount','total','categoryWeights','evidence'].sort(),'Unexpected fields');
 assert.equal(p.mixedUberCashSplit,true);assert.equal(p.currency,'CLP');assert(/^[a-f0-9]{8,}$/.test(p.receipt));assert(/^[A-Za-z0-9_-]{8,}$/.test(p.statementFileId));assert(typeof p.evidence==='string'&&p.evidence.trim().length>=30);
 for(const n of [p.amount,p.total])assert(Number.isSafeInteger(n)&&n<0&&n%100===0,'Invalid amount');
 const card=p.cardTransaction,r=p.cardRecord;assert(card&&card.is_parent&&!card.is_child&&!card.parent_id&&!card.transfer_id&&!card.schedule&&!card.tombstone&&!card.starting_balance_flag&&card.account!==p.wallet&&card.amount+p.amount===p.total&&card.category===null,'Invalid card parent');
 assert.equal(card.imported_id,'gmail:'+p.receipt);assert(typeof card.date==='string'&&/^\d{4}-\d\d-\d\d$/.test(card.date)&&Number.isFinite(Date.parse(card.date+'T12:00:00Z'))&&new Date(card.date+'T12:00:00Z').toISOString().slice(0,10)===card.date,'Invalid date');
 assert(String(card.notes??'').includes('/'+p.receipt)&&String(card.notes??'').includes('/'+p.statementFileId),'Missing evidence links');
 assert(s.accounts.some(a=>a.id===card.account&&!a.closed&&!a.offbudget));assert(s.accounts.some(a=>a.id===p.wallet&&!a.closed&&!a.offbudget&&/uber cash/i.test(a.name)&&/parcial/i.test(a.name)),'Partial wallet missing');
 assert(s.payees.some(x=>x.id===card.payee&&!x.transfer_acct&&/^uber eats$/i.test(x.name)),'Payee mismatch');assert(Array.isArray(card.subtransactions)&&card.subtransactions.length===2,'Exactly two card children required');
 assert(Array.isArray(p.categoryWeights)&&p.categoryWeights.length===2);const cats=new Set();
 for(const w of p.categoryWeights){equal(Object.keys(w).sort(),['category','weight']);assert(typeof w.category==='string'&&Number.isSafeInteger(w.weight)&&w.weight>0);cats.add(w.category)}assert.equal(cats.size,2,'Categories must be distinct');
 const names=p.categoryWeights.map(w=>s.categories.find(c=>c.id===w.category&&!c.hidden&&!c.is_income)?.name??'');assert(names.some(x=>/^(?:\S+\s+)?groceries$/i.test(x))&&names.some(x=>/^(?:\S+\s+)?alcohol$/i.test(x)),'Expected groceries and alcohol');
 assert.equal(new Set(card.subtransactions.map(c=>c.id)).size,2);for(const child of card.subtransactions)assert(child.is_child&&child.parent_id===card.id&&child.account===card.account&&cats.has(child.category)&&Number.isSafeInteger(child.amount)&&child.amount<0&&child.amount%100===0&&!child.transfer_id,'Invalid split child');
 assert.equal(new Set(card.subtransactions.map(c=>c.category)).size,2);assert.equal(card.subtransactions.reduce((a,c)=>a+c.amount,0),card.amount,'Card children do not sum');
 const matches=s.transactions.filter(x=>x.id===card.id);assert.equal(matches.length,1);equal(matches[0],card,'Card split changed');equal(l.records?.[p.receipt],r,'Source ledger changed');
 assert(r?.status==='registered'&&r.verifiedAt&&r.transactionId===card.id&&r.currency==='CLP'&&r.account===card.account&&r.date===card.date&&r.amount===card.amount&&r.category===null&&r.sourceIds?.includes(p.receipt),'Source ledger mismatch');
 for(const [key,v]of Object.entries(l.records??{}))if(key!==p.receipt)assert(!JSON.stringify(v)?.includes(p.receipt),'Other ledger owns receipt');
 for(const [key,v]of Object.entries(l))if(!['activeRun','records'].includes(key))assert(!JSON.stringify(v)?.includes(p.receipt),'Receipt already reserved');
 for(const t of s.transactions)if(t.id!==card.id){assert(!String(t.imported_id??'').includes(p.receipt)&&!String(t.notes??'').includes('/'+p.receipt),'Receipt already in another transaction');if(!t.is_child&&t.account===p.wallet&&t.amount===p.amount&&Math.abs(Date.parse(t.date)-Date.parse(card.date))<=86400000)assert.fail('Possible duplicate wallet split')}
 const walletSplits=allocateWallet(p);
 const stable=structuredClone(l);delete stable.activeRun;return {action:'create',walletSplits,planHash:createHash('sha256').update(JSON.stringify(canonical({candidate:p,snapshot:s,ledger:stable}))).digest('hex')};
}

export const hasPendingMixedSplit=l=>Object.values(l.mixedUberCashSplits??{}).some(a=>a?.status==='pending');
export function mixedSplitSourceConflict(c,l){const text=JSON.stringify(c);return Object.values(l.mixedUberCashSplits??{}).some(a=>['pending','complete'].includes(a?.status)&&[a.candidate?.receipt,a.candidate?.cardTransaction?.id,...(a.candidate?.cardTransaction?.subtransactions??[]).map(t=>t.id),a.id,...(a.childIds??[])].filter(Boolean).some(id=>text.includes(id)))}
const parentNotes=p=>`Parte pagada con Uber Cash; alimentos y alcohol prorrateados. Historial de billetera parcial.\nhttps://mail.google.com/mail/u/0/#all/${p.receipt}\nhttps://drive.google.com/file/d/${p.statementFileId}/view`;
const childNotes='Porción proporcional del pedido, después del descuento y del pago con tarjeta.';
function verifyPosted(p,s,l,a){
 equal(a.walletSplits,allocateWallet(p),'Audited allocation changed');
 equal(l.records?.[p.receipt],p.cardRecord,'Source ledger changed');const card=s.transactions.filter(x=>x.id===p.cardTransaction.id);assert.equal(card.length,1);equal(card[0],p.cardTransaction,'Existing card split changed');
 const wallet=s.accounts.filter(x=>x.id===p.wallet);assert.equal(wallet.length,1);assert(!wallet[0].closed&&!wallet[0].offbudget&&/uber cash/i.test(wallet[0].name)&&/parcial/i.test(wallet[0].name));
 const sources=s.transactions.filter(x=>x.imported_id==='gmail:'+p.receipt);assert.equal(sources.length,2,'Receipt must identify both components');const matches=sources.filter(x=>x.account===p.wallet);assert.equal(matches.length,1);const t=matches[0];
 for(const [k,v]of Object.entries({date:p.cardTransaction.date,amount:p.amount,payee:p.cardTransaction.payee,category:null,notes:parentNotes(p),is_parent:true,transfer_id:null,cleared:false}))assert.equal(t[k]??null,v,'Wallet parent differs: '+k);
 assert(t.id&&!t.is_child&&!t.parent_id&&!t.reconciled&&!t.schedule&&!t.tombstone&&!t.starting_balance_flag&&t.subtransactions?.length===2,'Invalid wallet parent');
 const ids=[];for(const expected of a.walletSplits){const children=t.subtransactions.filter(x=>x.category===expected.category);assert.equal(children.length,1);const child=children[0];assert(child.id&&child.is_child&&child.parent_id===t.id&&child.account===p.wallet&&child.amount===expected.amount&&child.notes===childNotes&&!child.transfer_id,'Wallet child differs');ids.push(child.id)}assert.equal(new Set(ids).size,2);assert.equal(t.subtransactions.reduce((n,x)=>n+x.amount,0),p.amount);
 if(a.id)assert.equal(t.id,a.id);if(a.childIds)equal(ids,a.childIds,'Wallet child identities differ');return {id:t.id,childIds:ids};
}
function verifyUnrelated(p,before,after){for(const k of ['accounts','payees','categories','rules','schedules','dashboards'])equal(after[k],before[k],`Unrelated ${k} changed`);assert.equal(after.transactions.length,before.transactions.length+1,'Unexpected parent count');const map=new Map(after.transactions.map(x=>[x.id,x]));assert.equal(map.size,after.transactions.length);for(const t of before.transactions)equal(map.get(t.id),t,'Existing transaction changed');equal(Object.keys(before.balances).sort(),Object.keys(after.balances).sort());for(const [id,b]of Object.entries(before.balances))assert.equal(after.balances[id],b+(id===p.wallet?p.amount:0),'Unexpected balance');}
export async function recordMixedSplit(p,commit,d){
 assert.equal(p.currency,'CLP');if(commit)assert(/^[a-f0-9]{64}$/.test(d.expectedPlan??''),'Exact plan digest required');let l=commit?await d.requireRun():await d.readState();assert(!hasPendingMixedSplit(l),'Pending mixed Uber Cash split requires investigation');const prior=l.mixedUberCashSplits?.[p.receipt];
 if(prior){assert(prior.status==='complete'&&prior.planHash===d.expectedPlan&&prior.backup&&prior.verifiedAt,'Incomplete audit');equal(prior.candidate,p,'Candidate differs');const {api}=await d.connect(BUDGETS.CLP.syncId);try{const ids=verifyPosted(p,await d.snapshot(api),l,prior);return {action:'existing',...ids,backup:prior.backup,verified:true}}finally{await api.shutdown()}}
 let {api}=await d.connect(BUDGETS.CLP.syncId),before,plan,dir;try{
  before=await d.snapshot(api);before.dashboards=await d.readDashboard(api);plan=classifyMixedSplit(p,before,l);if(!commit)return {...plan,candidate:p};assert.equal(plan.planHash,d.expectedPlan,'Plan digest changed');dir=await d.backup(api,'CLP',before);await d.json(dir+'/mixed-uber-split.json',{candidate:p,plan});await api.sync();const now=await d.snapshot(api);now.dashboards=await d.readDashboard(api);equal(now,before,'Budget changed before write');l=await d.requireRun();assert.equal(classifyMixedSplit(p,now,l).planHash,d.expectedPlan,'Plan digest changed');
  l.mixedUberCashSplits??={};assert(!l.mixedUberCashSplits[p.receipt]);l.mixedUberCashSplits[p.receipt]={status:'pending',candidate:p,planHash:d.expectedPlan,walletSplits:plan.walletSplits,backup:dir};await d.save(l);await d.requireRun();await api.addTransactions(p.wallet,[{date:p.cardTransaction.date,amount:p.amount,payee:p.cardTransaction.payee,category:null,notes:parentNotes(p),imported_id:'gmail:'+p.receipt,cleared:false,is_parent:true,subtransactions:plan.walletSplits.map(x=>({...x,notes:childNotes}))}],{runTransfers:false,learnCategories:false});await api.sync();
 }finally{await api.shutdown()}
 ({api}=await d.connect(BUDGETS.CLP.syncId));try{const after=await d.snapshot(api);after.dashboards=await d.readDashboard(api);l=await d.requireRun();const a=l.mixedUberCashSplits?.[p.receipt];assert.equal(a?.status,'pending');equal(a.candidate,p,'Pending candidate changed');const ids=verifyPosted(p,after,l,a);verifyUnrelated(p,before,after);await d.json(dir+'/after.json',after);l=await d.requireRun();assert.equal(l.mixedUberCashSplits?.[p.receipt]?.status,'pending');l.mixedUberCashSplits[p.receipt]={...a,...ids,status:'complete',verifiedAt:new Date().toISOString()};await d.save(l);return {...plan,...ids,backup:dir,verified:true}}finally{await api.shutdown()}
}
