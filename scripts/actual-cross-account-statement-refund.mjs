import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BUDGETS} from './actual-daily-policy.mjs';

const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const eq=(a,b,m)=>assert.deepEqual(canonical(a),canonical(b),m);
const planHash=(candidate,snapshot,action)=>createHash('sha256').update(JSON.stringify(canonical({candidate,snapshot,action}))).digest('hex');
const dateOK=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export const notes=p=>`${p.pendingCategoryReason?'Categoría pendiente: '+p.pendingCategoryReason+'\n':''}${p.evidence}\nhttps://mail.google.com/mail/u/0/#all/${p.merchantMessageId}\nhttps://drive.google.com/file/d/${p.statementId}/view\npaymentReference=${p.paymentReference}\nsource=${p.refundSource}\nrefundOf=${p.original.id}`;
export const merchantRecord=(p,id,verifiedAt,backup)=>({transactionId:id,currency:p.currency,account:p.destinationAccount,date:p.refundDate,amount:p.refundAmount,payee:p.original.payee,category:p.original.category,sourceIds:[p.merchantMessageId],refundOf:p.original.id,status:p.pendingCategoryReason?'pending-category':'registered',...(p.pendingCategoryReason?{reason:p.pendingCategoryReason}:{}),verifiedAt,backup});
function verifyCredit(p,t){
 assert(t&&!t.is_parent&&!t.is_child&&!t.transfer_id&&!t.reconciled&&!t.schedule,'Unexpected refund type');
 for(const [key,value] of Object.entries({account:p.destinationAccount,date:p.refundDate,amount:p.refundAmount,payee:p.original.payee,category:p.original.category,imported_id:p.refundSource,notes:notes(p),cleared:false}))assert.equal(t[key],value,'Refund mismatch: '+key);
}
function checkSourceConflicts(p,s,l,ownId=null){
 const claimed=(map,id,skip)=>Object.entries(map??{}).some(([key,value])=>key!==skip&&(key===id||value?.sourceIds?.includes(id)));
 assert(!claimed(l.records,p.refundSource,null)&&!claimed(l.cashflows,p.refundSource,null)&&!claimed(l.records,p.merchantMessageId,ownId?p.merchantMessageId:null)&&!claimed(l.cashflows,p.merchantMessageId,null),'Refund source already exists in ledger');
 assert(!Object.entries(l.crossAccountStatementRefunds??{}).some(([key,a])=>key!==p.refundSource&&(a?.candidate?.refundSource===p.refundSource||a?.candidate?.merchantMessageId===p.merchantMessageId||(a?.status==='pending'&&a?.candidate?.original?.id===p.original.id))),'Conflicting refund audit');
 assert(!Object.entries(l.statementRefunds??{}).some(([key,a])=>key===p.refundSource||a?.candidate?.refundSource===p.refundSource||(a?.status==='pending'&&a?.candidate?.original?.id===p.original.id)),'Conflicting refund audit');
 assert(!s.transactions.some(x=>x.id!==ownId&&(x.imported_id===p.refundSource||x.imported_id===`gmail:${p.merchantMessageId}`||x.notes?.split('\n').includes(`source=${p.refundSource}`)||x.notes?.includes(`https://mail.google.com/mail/u/0/#all/${p.merchantMessageId}`))),'Refund source already exists');
 const days=(a,b)=>Math.abs(Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000;
 assert(!s.transactions.some(x=>x.id!==ownId&&x.account===p.destinationAccount&&x.amount===p.refundAmount&&dateOK(x.date)&&days(x.date,p.refundDate)<=4),'Nearby matching credit requires investigation');
}
export function classifyCrossAccountStatementRefund(p,s,l){
 eq(Object.keys(p).sort(),['crossAccountStatementRefund','currency','original','originalRecord','purchaseSourceId','destinationAccount','refundDate','refundAmount','refundSource','statementId','merchantMessageId','paymentReference','evidence',...(p.pendingCategoryReason!==undefined?['pendingCategoryReason']:[])].sort(),'Unexpected candidate fields');
 assert.equal(p.crossAccountStatementRefund,true);assert(BUDGETS[p.currency],'Unsupported currency');
 assert(/^bank:[A-Za-z0-9:_-]+$/.test(p.refundSource),'Invalid bank source');
 for(const key of ['statementId','purchaseSourceId','merchantMessageId','paymentReference'])assert(typeof p[key]==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(p[key]),'Invalid '+key);
 assert.notEqual(p.purchaseSourceId,p.merchantMessageId,'Merchant refund must be a separate source');
 assert(typeof p.evidence==='string'&&p.evidence.trim().length>=30&&!/[\r\n]/.test(p.evidence),'Evidence required');
 const t=p.original,r=p.originalRecord;
 assert(Array.isArray(r?.sourceIds)&&r.sourceIds.length&&new Set(r.sourceIds).size===r.sourceIds.length,'Invalid purchase sources');for(const id of r.sourceIds)eq(l.records?.[id],r,'Purchase source ledger mismatch');for(const [key,value] of Object.entries(l.records??{}))if(value?.transactionId===t?.id)assert(r.sourceIds.includes(key),'Unlisted purchase source alias');
 assert(t?.id&&t.account&&dateOK(t.date)&&Number.isSafeInteger(t.amount)&&t.amount<0&&t.payee&&t.imported_id===`gmail:${p.purchaseSourceId}`&&!t.is_parent&&!t.is_child&&!t.transfer_id&&!t.reconciled&&!t.schedule&&!t.subtransactions?.length,'Original must be a simple categorized Gmail purchase');
 assert(p.destinationAccount&&p.destinationAccount!==t.account,'Distinct destination required');
 assert(dateOK(p.refundDate)&&p.refundDate>=t.date,'Invalid refund date');assert(Number.isSafeInteger(p.refundAmount)&&p.refundAmount>0&&p.refundAmount<=-t.amount,'Invalid refund amount');
 for(const id of [t.account,p.destinationAccount])assert(s.accounts.some(a=>a.id===id&&!a.closed&&!a.offbudget),'Account missing');
 if(t.category==null){assert(typeof p.pendingCategoryReason==='string'&&p.pendingCategoryReason.trim().length>=10&&!/[\r\n]/.test(p.pendingCategoryReason),'Pending category reason required');assert(r?.status==='pending-category'&&typeof r.reason==='string'&&r.reason.trim(),'Original pending reason missing')}else{assert(p.pendingCategoryReason===undefined,'Categorized refund cannot have pending reason');assert(s.categories.some(c=>c.id===t.category&&!c.hidden&&!c.is_income),'Category missing');}const payee=s.payees.find(v=>v.id===t.payee&&!v.transfer_acct);assert(payee,'Payee missing');
 assert(r?.transactionId===t.id&&r.currency===p.currency&&r.account===t.account&&r.date===t.date&&r.amount===t.amount&&r.category===t.category&&r.status===(p.pendingCategoryReason?'pending-category':'registered')&&r.verifiedAt&&Array.isArray(r.sourceIds)&&r.sourceIds.includes(p.purchaseSourceId),'Original ledger mismatch');eq(l.records?.[p.purchaseSourceId],r,'Original ledger changed');
 const normalizedName=name=>typeof name==='string'?name.trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US'):'';assert(normalizedName(r.payee)&&normalizedName(r.payee)===normalizedName(payee.name),'Original payee differs from ledger');
 const originals=s.transactions.filter(x=>x.id===t.id);assert.equal(originals.length,1);eq(originals[0],t,'Original changed');
 if(p.pendingCategoryReason){assert(!Object.entries(l.crossAccountStatementRefunds??{}).some(([key,a])=>key!==p.refundSource&&a?.candidate?.original?.id===t.id&&['pending','registered-pending-category'].includes(a?.status)),'Another pending linked refund exists');assert(!s.transactions.some(x=>x.notes?.split('\n').includes(`refundOf=${t.id}`)&&x.imported_id!==p.refundSource),'Another linked refund requires review');}
 const audit=l.crossAccountStatementRefunds?.[p.refundSource];
 if(audit){assert.equal(audit.status,p.pendingCategoryReason?'registered-pending-category':'registered','Pending refund requires investigation');eq(audit.candidate,p,'Refund audit conflict');const found=s.transactions.filter(x=>x.imported_id===p.refundSource);assert.equal(found.length,1);assert.equal(found[0].id,audit.id);verifyCredit(p,found[0]);assert(audit.verifiedAt&&audit.backup,'Incomplete refund audit');eq(l.records?.[p.merchantMessageId],merchantRecord(p,audit.id,audit.verifiedAt,audit.backup),'Refund merchant ledger mismatch');checkSourceConflicts(p,s,l,audit.id);const linked=s.transactions.filter(x=>x.notes?.split('\n').includes(`refundOf=${t.id}`));assert(linked.every(x=>x.category===t.category&&x.amount>0),'Conflicting prior refund');assert(linked.reduce((n,x)=>n+x.amount,0)<=-t.amount,'Refund exceeds original');return {action:'existing',id:audit.id,...(p.pendingCategoryReason?{label:'Actual/Review'}:{})};}
 checkSourceConflicts(p,s,l);
 const prior=s.transactions.filter(x=>x.notes?.split('\n').includes(`refundOf=${t.id}`));assert(prior.every(x=>x.category===t.category&&x.amount>0),'Conflicting prior refund');assert(prior.reduce((n,x)=>n+x.amount,0)+p.refundAmount<=-t.amount,'Refund exceeds original');
 return {action:'create',...(p.pendingCategoryReason?{label:'Actual/Review'}:{}),amount:p.refundAmount,date:p.refundDate,account:p.destinationAccount,category:t.category,originalId:t.id,notes:notes(p)};
}
export async function registerCrossAccountStatementRefund(p,commit,d){
 let l=commit?await d.requireRun():await d.readState();let {api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir;
 try{
  before=await d.snapshot(api);action=classifyCrossAccountStatementRefund(p,before,l);
  if(!commit)return {...action,candidate:p,planHash:planHash(p,before,action)};
  if(action.action==='existing')return {...action,verified:true,backup:l.crossAccountStatementRefunds[p.refundSource].backup};
  assert(typeof d.expectedPlan==='string'&&d.expectedPlan===planHash(p,before,action),'Preview hash missing or budget/candidate changed; rerun plan');
  dir=await d.backup(api,p.currency,before);await d.json(dir+'/cross-account-statement-refund.json',{candidate:p});await api.sync();eq(await d.snapshot(api),before,'Budget changed before refund');
  l=await d.requireRun();eq(classifyCrossAccountStatementRefund(p,before,l),action,'Refund preview changed');l.crossAccountStatementRefunds??={};
  l.crossAccountStatementRefunds[p.refundSource]={status:'pending',candidate:p,backup:dir};await d.save(l);await d.requireRun();
  await api.addTransactions(p.destinationAccount,[{date:p.refundDate,amount:p.refundAmount,payee:p.original.payee,category:p.original.category,imported_id:p.refundSource,notes:notes(p),cleared:false}],{runTransfers:false,learnCategories:false});await api.sync();
 }finally{await api.shutdown()}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));
 try{
  const after=await d.snapshot(api),matches=after.transactions.filter(x=>x.imported_id===p.refundSource);assert.equal(matches.length,1,'Refund missing or duplicated');verifyCredit(p,matches[0]);
  for(const key of ['accounts','categories','payees','rules','schedules'])eq(after[key],before[key],'Unrelated '+key+' changed');
  assert.equal(after.transactions.length,before.transactions.length+1,'Unexpected transaction count');const byId=new Map(after.transactions.map(x=>[x.id,x]));assert.equal(byId.size,after.transactions.length);for(const t of before.transactions)eq(byId.get(t.id),t,'Existing transaction changed');
  eq(Object.keys(after.balances).sort(),Object.keys(before.balances).sort(),'Accounts changed');for(const [id,b] of Object.entries(before.balances))assert.equal(after.balances[id],b+(id===p.destinationAccount?p.refundAmount:0),'Unexpected balance');
  await d.json(dir+'/after.json',after);l=await d.requireRun();eq(l.crossAccountStatementRefunds?.[p.refundSource],{status:'pending',candidate:p,backup:dir},'Refund intent changed');eq(l.records?.[p.purchaseSourceId],p.originalRecord,'Original ledger changed');assert(!l.records?.[p.merchantMessageId],'Refund merchant ledger changed');
  const verifiedAt=new Date().toISOString();l.records[p.merchantMessageId]=merchantRecord(p,matches[0].id,verifiedAt,dir);
  l.crossAccountStatementRefunds[p.refundSource]={status:p.pendingCategoryReason?'registered-pending-category':'registered',candidate:p,backup:dir,id:matches[0].id,verifiedAt};await d.save(l);return {...action,id:matches[0].id,verified:true,backup:dir};
 }finally{await api.shutdown()}
}
