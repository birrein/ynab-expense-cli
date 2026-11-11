import assert from 'node:assert/strict';
import {BUDGETS} from './actual-daily-policy.mjs';

const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const eq=(a,b,m)=>assert.deepEqual(canonical(a),canonical(b),m);
const notes=p=>`${p.evidence}\nhttps://drive.google.com/file/d/${p.statementId}/view\nsource=${p.refundSource}\nrefundOf=${p.original.id}`;
const isDate=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
function verifyCredit(p,t){
 assert(t&&!t.is_parent&&!t.is_child&&!t.transfer_id&&!t.reconciled&&!t.schedule,'Unexpected refund type');
 for(const [key,value] of Object.entries({account:p.original.account,date:p.refundDate,amount:p.refundAmount,payee:p.original.payee,category:p.original.category,imported_id:p.refundSource,notes:notes(p),cleared:false}))assert.equal(t[key],value,'Refund mismatch: '+key);
}
export function classifyStatementRefund(p,s,l){
 eq(Object.keys(p).sort(),['statementRefund','currency','original','originalRecord','refundDate','refundAmount','refundSource','statementId','evidence'].sort(),'Unexpected candidate fields');
 assert.equal(p.statementRefund,true);assert(BUDGETS[p.currency],'Unsupported currency');
 assert(/^bank:[A-Za-z0-9:_-]+$/.test(p.refundSource),'Invalid bank source');
 assert(/^[A-Za-z0-9_-]{8,}$/.test(p.statementId),'Invalid statement ID');
 assert(typeof p.evidence==='string'&&p.evidence.trim().length>=30&&!/[\r\n]/.test(p.evidence),'Evidence required');
 const t=p.original,r=p.originalRecord;
 assert(t?.id&&t.account&&isDate(t.date)&&Number.isSafeInteger(t.amount)&&t.amount<0&&t.payee&&t.category&&/^bank:/.test(t.imported_id)&&!t.is_parent&&!t.is_child&&!t.transfer_id&&!t.reconciled&&!t.schedule&&!t.subtransactions?.length,'Original must be a simple eligible expense');
 assert(isDate(p.refundDate)&&p.refundDate>=t.date,'Invalid refund date');assert(Number.isSafeInteger(p.refundAmount)&&p.refundAmount>0&&p.refundAmount<=-t.amount,'Invalid refund amount');assert.notEqual(t.imported_id,p.refundSource);
 assert(s.accounts.some(a=>a.id===t.account&&!a.closed&&!a.offbudget),'Account missing');assert(s.categories.some(c=>c.id===t.category&&!c.hidden&&!c.is_income),'Category missing');assert(s.payees.some(v=>v.id===t.payee&&!v.transfer_acct),'Payee missing');
 assert(r?.type==='expense'&&r.id===t.id&&r.currency===p.currency&&r.account===t.account&&r.date===t.date&&r.amount===t.amount&&r.category===t.category&&r.status==='registered'&&r.verifiedAt,'Original ledger mismatch');eq(l.cashflows?.[t.imported_id],r,'Original ledger changed');
 const originals=s.transactions.filter(x=>x.id===t.id);assert.equal(originals.length,1);eq(originals[0],t,'Original changed');
 const audit=l.statementRefunds?.[p.refundSource];
 if(audit){assert.equal(audit.status,'registered','Pending refund requires investigation');eq(audit.candidate,p,'Refund audit conflict');const matches=s.transactions.filter(x=>x.imported_id===p.refundSource);assert.equal(matches.length,1,'Audited refund source missing or duplicated');assert.equal(matches[0].id,audit.id);verifyCredit(p,matches[0]);return {action:'existing',id:audit.id};}
 assert(!l.records?.[p.refundSource]&&!l.cashflows?.[p.refundSource],'Refund source already exists in ledger');assert(!s.transactions.some(x=>x.imported_id===p.refundSource),'Refund source already exists');
 const prior=s.transactions.filter(x=>x.notes?.split('\n').includes(`refundOf=${t.id}`));assert(prior.every(x=>x.account===t.account&&x.category===t.category&&x.amount>0),'Conflicting prior refund');assert(prior.reduce((n,x)=>n+x.amount,0)+p.refundAmount<=-t.amount,'Refund exceeds original');
 const days=(a,b)=>Math.abs(Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000;
 assert(!s.transactions.some(x=>x.account===t.account&&x.amount===p.refundAmount&&isDate(x.date)&&days(x.date,p.refundDate)<=4),'Nearby matching credit requires investigation');
 return {action:'create',amount:p.refundAmount,date:p.refundDate,account:t.account,category:t.category,originalId:t.id,notes:notes(p)};
}
export async function registerStatementRefund(p,commit,d){
 let l=commit?await d.requireRun():await d.readState();let {api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir;
 try{
  before=await d.snapshot(api);action=classifyStatementRefund(p,before,l);if(!commit)return {...action,candidate:p};if(action.action==='existing')return {...action,verified:true,backup:l.statementRefunds[p.refundSource].backup};
  dir=await d.backup(api,p.currency,before);await d.json(dir+'/statement-refund.json',{candidate:p});await api.sync();eq(await d.snapshot(api),before,'Budget changed before refund');l=await d.requireRun();eq(classifyStatementRefund(p,before,l),action,'Refund preview changed');
  l.statementRefunds??={};l.statementRefunds[p.refundSource]={status:'pending',candidate:p,backup:dir};await d.save(l);await d.requireRun();
  await api.addTransactions(p.original.account,[{date:p.refundDate,amount:p.refundAmount,payee:p.original.payee,category:p.original.category,imported_id:p.refundSource,notes:notes(p),cleared:false}],{runTransfers:false,learnCategories:false});await api.sync();
 }finally{await api.shutdown()}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));
 try{
  const after=await d.snapshot(api),matches=after.transactions.filter(x=>x.imported_id===p.refundSource);assert.equal(matches.length,1,'Refund missing or duplicated');verifyCredit(p,matches[0]);
  for(const key of ['accounts','categories','payees','rules','schedules'])eq(after[key],before[key],'Unrelated '+key+' changed');
  assert.equal(after.transactions.length,before.transactions.length+1,'Unexpected transaction count');const byId=new Map(after.transactions.map(x=>[x.id,x]));assert.equal(byId.size,after.transactions.length);for(const t of before.transactions)eq(byId.get(t.id),t,'Existing transaction changed');
  eq(Object.keys(after.balances).sort(),Object.keys(before.balances).sort(),'Accounts changed');for(const [id,b] of Object.entries(before.balances))assert.equal(after.balances[id],b+(id===p.original.account?p.refundAmount:0),'Unexpected balance');
  await d.json(dir+'/after.json',after);l=await d.requireRun();eq(l.statementRefunds?.[p.refundSource],{status:'pending',candidate:p,backup:dir},'Refund intent changed');eq(l.cashflows?.[p.original.imported_id],p.originalRecord,'Original ledger changed');l.statementRefunds[p.refundSource]={status:'registered',candidate:p,backup:dir,id:matches[0].id,verifiedAt:new Date().toISOString()};await d.save(l);return {...action,id:matches[0].id,verified:true,backup:dir};
 }finally{await api.shutdown()}
}
