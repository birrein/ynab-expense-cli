import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BUDGETS} from './actual-daily-policy.mjs';

const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const eq=(a,b,m)=>assert.deepEqual(canon(a),canon(b),m);
const hash=(p,s,a)=>createHash('sha256').update(JSON.stringify(canon({p,s,a}))).digest('hex');
const dateOK=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const lines=p=>`${p.oldTransaction.notes}\nhttps://mail.google.com/mail/u/0/#all/${p.transferMessageId}\nhttps://drive.google.com/file/d/${p.bankStatementId}/view\nhttps://drive.google.com/file/d/${p.walletStatementId}/view\nsource=${p.transferSource}`;
const incomeNotes=p=>`${p.evidence}\nhttps://mail.google.com/mail/u/0/#all/${p.saleMessageId}\nhttps://drive.google.com/file/d/${p.walletStatementId}/view\npaymentReference=${p.paymentReference}\nsource=${p.settlementSource}`;
const days=(a,b)=>Math.abs(Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000;
function verifyResult(p,s,a,audit){
 const t=s.transactions.find(x=>x.id===p.oldTransaction.id),leg=s.transactions.find(x=>x.id===audit.legId),income=s.transactions.find(x=>x.id===audit.incomeId);
 assert(t&&leg&&income,'Missing converted movements');for(const x of [leg,income])assert(!x.is_parent&&!x.is_child&&!x.parent_id&&!x.subtransactions?.length&&!x.reconciled&&!x.schedule&&!x.starting_balance_flag&&!x.tombstone,'Unexpected movement structure');assert(!income.transfer_id,'Income must not be a transfer');eq(t,{...p.oldTransaction,payee:a.transferPayee,category:null,notes:lines(p),transfer_id:leg.id},'Converted credit differs');
 for(const [k,v] of Object.entries({account:p.originAccount,date:p.oldTransaction.date,amount:-p.oldTransaction.amount,payee:a.destinationPayee,category:null,transfer_id:t.id,imported_id:null,notes:lines(p)}))assert.equal(leg[k]??null,v,'Transfer leg differs: '+k);
 for(const [k,v] of Object.entries({account:p.originAccount,date:p.settlementDate,amount:p.oldTransaction.amount,payee:p.incomePayee,category:p.incomeCategory,imported_id:p.settlementSource,notes:incomeNotes(p),cleared:false}))assert.equal(income[k]??null,v,'Income differs: '+k);
 return {t,leg,income};
}
export function marketplaceSourceConflict(candidate,ledger){const encoded=JSON.stringify(candidate);return Object.values(ledger.marketplaceSaleTransfers??{}).some(a=>['pending','complete'].includes(a?.status)&&a.candidate&&[a.candidate.settlementSource,a.candidate.transferSource,a.candidate.saleMessageId,a.candidate.transferMessageId].some(id=>typeof id==='string'&&id&&encoded.includes(id)));}
export function classifyMarketplaceSaleTransfer(p,s,l){
 eq(Object.keys(p).sort(),['marketplaceSaleTransfer','currency','oldTransaction','originAccount','settlementDate','incomeCategory','incomePayee','settlementSource','transferSource','saleMessageId','transferMessageId','walletStatementId','bankStatementId','paymentReference','evidence'].sort(),'Unexpected candidate fields');
 assert.equal(p.marketplaceSaleTransfer,true);assert(BUDGETS[p.currency],'Invalid currency');const t=p.oldTransaction;
 assert(t?.id&&t.account&&p.originAccount&&p.originAccount!==t.account&&Number.isSafeInteger(t.amount)&&t.amount>0&&dateOK(t.date)&&dateOK(p.settlementDate)&&p.settlementDate<=t.date,'Invalid accounts, date or amount');
 assert(!t.transfer_id&&!t.is_parent&&!t.is_child&&!t.parent_id&&!t.subtransactions?.length&&!t.reconciled&&!t.schedule&&!t.starting_balance_flag&&!t.tombstone,'Not a simple standalone credit');
 assert(typeof t.notes==='string'&&t.notes.trim(),'Historical note required');
 for(const k of ['settlementSource','transferSource'])assert(typeof p[k]==='string'&&/^bank:[A-Za-z0-9:_-]+$/.test(p[k]),'Invalid '+k);
 assert.notEqual(p.settlementSource,p.transferSource);for(const k of ['saleMessageId','transferMessageId'])assert(/^[a-f0-9]{16}$/.test(p[k]),'Invalid '+k);assert.notEqual(p.saleMessageId,p.transferMessageId);
 for(const k of ['walletStatementId','bankStatementId','paymentReference'])assert(typeof p[k]==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(p[k]),'Invalid '+k);assert.notEqual(p.walletStatementId,p.bankStatementId);assert(typeof p.evidence==='string'&&p.evidence.trim().length>=30&&!/[\r\n]/.test(p.evidence));
 for(const id of [p.originAccount,t.account])assert(s.accounts.some(x=>x.id===id&&!x.closed&&!x.offbudget),'Account unavailable');assert(s.categories.some(x=>x.id===p.incomeCategory&&x.is_income&&!x.hidden),'Income category unavailable');assert(s.payees.some(x=>x.id===p.incomePayee&&!x.transfer_acct),'Income payee unavailable');
 const op=s.payees.filter(x=>x.transfer_acct===p.originAccount),dp=s.payees.filter(x=>x.transfer_acct===t.account);assert.equal(op.length,1);assert.equal(dp.length,1);
 const audit=l.marketplaceSaleTransfers?.[t.id];if(audit){assert.equal(audit.status,'complete','Pending operation requires investigation');eq(audit.candidate,p,'Audit candidate conflict');assert(audit.backup&&audit.verifiedAt&&audit.incomeId&&audit.legId,'Incomplete audit');}
 const ids=[p.settlementSource,p.transferSource,p.saleMessageId,p.transferMessageId];assert(![p.settlementSource,p.saleMessageId].some(id=>t.imported_id===id||t.imported_id===`gmail:${id}`||String(t.notes??'').includes(id)),'Historical credit already claims sale source');
 for(const [group,map] of Object.entries(l)){if(group==='marketplaceSaleTransfers'||!map||typeof map!=='object'||Array.isArray(map))continue;for(const [key,value] of Object.entries(map)){if(value?.status!=='pending')continue;const serialized=JSON.stringify(value.candidate??{});assert(key!==t.id&&!([t.id,...ids].some(id=>serialized.includes(id))),'Conflicting pending audit');}}
 for(const [key,value] of Object.entries(l.records??{}))assert(!ids.some(id=>key===id||(value?.sourceIds??[]).includes(id))&&value?.transactionId!==t.id,'Record source conflict');
 for(const [key,value] of Object.entries(l.cashflows??{}))assert(!ids.some(id=>key===id||(value?.sourceIds??[]).includes(id))&&value?.id!==t.id&&value?.counterpartId!==t.id,'Cashflow source conflict');
 for(const [key,value] of Object.entries(l.marketplaceSaleTransfers??{}))if(key!==t.id)assert(!ids.some(id=>JSON.stringify(value).includes(id)),'Conflicting sale audit');
 for(const x of s.transactions){if([t.id,audit?.incomeId,audit?.legId].includes(x.id))continue;assert(!ids.some(id=>x.imported_id===id||x.imported_id===`gmail:${id}`||String(x.notes??'').includes(id)),'Transaction source conflict');assert(!(dateOK(x.date)&&((x.account===p.originAccount&&((x.amount===t.amount&&days(x.date,p.settlementDate)<=4)||(x.amount===-t.amount&&days(x.date,t.date)<=4)))||(x.account===t.account&&x.amount===t.amount&&days(x.date,t.date)<=4))),'Nearby duplicate requires review');}
 const matches=s.transactions.filter(x=>x.id===t.id);assert.equal(matches.length,1);const action={action:audit?'existing':'reconcile',id:t.id,incomeAmount:t.amount,transferPayee:op[0].id,destinationPayee:dp[0].id};
 if(audit){verifyResult(p,s,action,audit);return {...action,incomeId:audit.incomeId,legId:audit.legId};}eq(matches[0],t,'Historical credit changed');return action;
}
export async function reconcileMarketplaceSaleTransfer(p,commit,d){
 let l=commit?await d.requireRun():await d.readState(),{api}=await d.connect(BUDGETS[p.currency].syncId),before,a,dir;
 try{before=await d.snapshot(api);a=classifyMarketplaceSaleTransfer(p,before,l);if(!commit)return {...a,candidate:p,planHash:hash(p,before,a)};if(a.action==='existing')return {...a,verified:true,backup:l.marketplaceSaleTransfers[p.oldTransaction.id].backup};
 assert(d.expectedPlan===hash(p,before,a),'Preview missing or changed');dir=await d.backup(api,p.currency,before);await d.json(dir+'/marketplace-sale-transfer.json',{candidate:p});await api.sync();eq(await d.snapshot(api),before,'Budget changed');l=await d.requireRun();eq(classifyMarketplaceSaleTransfer(p,before,l),a,'Preview changed');l.marketplaceSaleTransfers??={};l.marketplaceSaleTransfers[p.oldTransaction.id]={status:'pending',candidate:p,backup:dir};await d.save(l);await d.requireRun();
 await api.addTransactions(p.originAccount,[{date:p.settlementDate,amount:p.oldTransaction.amount,payee:p.incomePayee,category:p.incomeCategory,imported_id:p.settlementSource,notes:incomeNotes(p),cleared:false}],{runTransfers:false,learnCategories:false});
 await api.updateTransaction(p.oldTransaction.id,{payee:a.transferPayee,category:null,notes:lines(p)});
 let ready=false;for(let i=0;i<50;i++){const now=await d.snapshot(api),t=now.transactions.find(x=>x.id===p.oldTransaction.id),leg=now.transactions.find(x=>x.id===t?.transfer_id);if(t?.payee===a.transferPayee&&t.notes===lines(p)&&leg?.transfer_id===t.id){ready=true;break}await new Promise(r=>setTimeout(r,100));}assert(ready,'Conversion incomplete: inspect pending audit and backup');await api.sync();
 }finally{await api.shutdown()}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));try{const after=await d.snapshot(api),credit=after.transactions.find(x=>x.id===p.oldTransaction.id),incomeMatches=after.transactions.filter(x=>x.imported_id===p.settlementSource);assert.equal(incomeMatches.length,1);const audit={incomeId:incomeMatches[0].id,legId:credit?.transfer_id};const result=verifyResult(p,after,a,audit);
 for(const key of ['accounts','categories','payees','rules','schedules'])eq(after[key],before[key],'Unrelated '+key+' changed');assert.equal(after.transactions.length,before.transactions.length+2);const byId=new Map(after.transactions.map(x=>[x.id,x]));assert.equal(byId.size,after.transactions.length);for(const x of before.transactions)if(x.id!==p.oldTransaction.id)eq(byId.get(x.id),x,'Other transaction changed');eq(after.balances,before.balances,'Balances changed');await d.json(dir+'/after.json',after);
 l=await d.requireRun();eq(l.marketplaceSaleTransfers?.[p.oldTransaction.id],{status:'pending',candidate:p,backup:dir},'Pending audit changed');l.marketplaceSaleTransfers[p.oldTransaction.id]={status:'complete',candidate:p,backup:dir,...audit,verifiedAt:new Date().toISOString()};await d.save(l);return {...a,...audit,verified:true,backup:dir};
 }finally{await api.shutdown()}
}
